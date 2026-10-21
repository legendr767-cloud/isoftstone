import { Router, raw } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getEnv } from '../config/env.js';
import { asyncHandler, clientIp, ok, parse, uuidParam } from '../lib/http.js';
import { AppError, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { addMoney, d2, fromCents, pctOfMoney, toCents } from '../lib/money.js';
import { randomToken } from '../lib/security.js';
import { requireAuth } from '../middleware/auth.js';
import { checkoutLimiter } from '../middleware/security.js';
import { getShowDraftOffers } from '../services/catalog.js';
import { getPaymentProvider, processWebhook, signPayload, simulatorEnabled } from '../services/payments.js';

export const checkoutRouter = Router();

/** Webhook: raw body is required for signature verification. Authenticated by HMAC, not cookies. */
export const webhookRouter = Router();
webhookRouter.post('/payments/webhook/:provider', raw({ type: '*/*', limit: '100kb' }), asyncHandler(async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const result = await processWebhook(String(req.params.provider), rawBody, req.headers['x-isoft-signature'] as string | undefined);
  ok(res, { received: true, duplicate: 'duplicate' in result ? result.duplicate : false });
}));

checkoutRouter.use(['/orders', '/payments/simulator'], requireAuth);

const createOrderSchema = z.object({
  items: z.array(z.object({ productId: uuidParam, addonCodes: z.array(z.string().max(40)).max(10).default([]) })).min(1).max(5),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Conditions to continue' }) }),
});

/** Prices are ALWAYS computed here from the database. The client only chooses products. */
checkoutRouter.post('/orders', checkoutLimiter, asyncHandler(async (req, res) => {
  const body = parse(createOrderSchema, req.body);
  const env = getEnv();
  if (env.EMAIL_PROVIDER !== 'none' && !req.auth!.emailVerified) throw forbidden('Please verify your email before purchasing.');
  const draftVisible = await getShowDraftOffers();
  const sandbox = simulatorEnabled();

  const lines: Array<{ productId: string; description: string; unitPrice: string; addons: Array<{ code: string; name: string; price: string }>; currency: string }> = [];
  for (const item of body.items) {
    const product = await db.query.products.findFirst({ where: eq(schema.products.id, item.productId), with: { challenge: true, sizeOption: true } });
    if (!product || !product.active || !product.sizeOption.active) throw unprocessable('A selected product is not available.');
    const ch = product.challenge;
    const visible = ch.status === 'PUBLISHED' && (ch.approvedAt || draftVisible);
    if (!visible) throw unprocessable('A selected challenge is not available.');
    if (ch.isDraftTerms && !sandbox) throw unprocessable('This offer is not yet available for purchase. Its terms are awaiting final approval.');

    const basePrice = d2(product.priceAmount);
    const codes = [...new Set(item.addonCodes)];
    const addonRows = codes.length ? await db.select().from(schema.productAddons).where(and(inArray(schema.productAddons.code, codes), eq(schema.productAddons.active, true), eq(schema.productAddons.approved, true))) : [];
    if (addonRows.length !== codes.length) throw unprocessable('A selected add-on is not available.');
    const addons = addonRows.map((a) => ({ code: a.code, name: a.name, price: a.priceType === 'PERCENT' ? pctOfMoney(basePrice, a.priceValue) : fromCents(toCents(a.priceValue)) }));
    const unitPrice = addons.reduce((sum, a) => addMoney(sum, a.price), basePrice);
    lines.push({ productId: product.id, description: `${ch.name} — ${Number(d2(product.sizeOption.accountSize)).toLocaleString('en-US')} ${product.currency}`, unitPrice, addons, currency: product.currency });
  }
  if (new Set(lines.map((l) => l.currency)).size > 1) throw unprocessable('Mixed-currency orders are not supported.');
  const total = lines.reduce((s, l) => addMoney(s, l.unitPrice), '0.00');

  const terms = await db.query.legalDocuments.findFirst({ where: eq(schema.legalDocuments.slug, 'terms'), with: { versions: { orderBy: desc(schema.legalVersions.version), limit: 1 } } });
  const orderNumber = `ISS-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomToken(4).toUpperCase().replace(/[-_]/g, 'X')}`;

  const order = await db.transaction(async (tx) => {
    const [o] = await tx.insert(schema.orders).values({
      orderNumber, userId: req.auth!.id, status: getPaymentProvider() ? 'AWAITING_PAYMENT' : 'PENDING',
      subtotal: total, total, currency: lines[0].currency, termsVersionId: terms?.versions[0]?.id ?? null,
    }).returning();
    await tx.insert(schema.orderItems).values(lines.map((l) => ({ orderId: o.id, productId: l.productId, description: l.description, unitPrice: l.unitPrice, addons: l.addons })));
    await tx.insert(schema.orderEvents).values({ orderId: o.id, type: 'ORDER_CREATED', detail: 'Order created; price verified on the server.' });
    if (terms?.versions[0]) await tx.insert(schema.legalAcceptances).values({ userId: req.auth!.id, versionId: terms.versions[0].id, ip: clientIp(req) });
    return o;
  });
  ok(res, { id: order.id, orderNumber, total, currency: order.currency, status: order.status, paymentsAvailable: !!getPaymentProvider() }, undefined, 201);
}));

async function ownedOrder(userId: string, orderId: string) {
  const o = await db.query.orders.findFirst({ where: and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)) });
  if (!o) throw notFound('Order not found');
  return o;
}

checkoutRouter.post('/orders/:id/pay', checkoutLimiter, asyncHandler(async (req, res) => {
  const order = await ownedOrder(req.auth!.id, parse(uuidParam, req.params.id));
  const provider = getPaymentProvider();
  if (!provider) throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not configured yet. Your order has been saved; no payment was taken.');
  if (!['PENDING', 'AWAITING_PAYMENT', 'FAILED'].includes(order.status)) throw new AppError(409, 'CONFLICT', `Order is ${order.status.toLowerCase()} and cannot be paid.`);

  const idemKey = (req.headers['idempotency-key'] as string | undefined)?.slice(0, 100) ?? `${order.id}:${randomToken(8)}`;
  const existing = await db.query.paymentAttempts.findFirst({ where: eq(schema.paymentAttempts.idempotencyKey, idemKey) });
  if (existing) {
    if (existing.orderId !== order.id) throw new AppError(409, 'CONFLICT', 'Idempotency key already used');
    return ok(res, { attemptId: existing.id, provider: existing.provider, nextPath: existing.status === 'INITIATED' ? `/checkout/simulate/${existing.id}` : null });
  }
  const attempt = await db.transaction(async (tx) => {
    const [a] = await tx.insert(schema.paymentAttempts).values({ orderId: order.id, provider: provider.name, amount: order.total, currency: order.currency, idempotencyKey: idemKey }).returning();
    await tx.update(schema.orders).set({ status: 'AWAITING_PAYMENT' }).where(eq(schema.orders.id, order.id));
    return a;
  });
  const init = await provider.initiate({ attemptId: attempt.id, amount: order.total, currency: order.currency });
  await db.update(schema.paymentAttempts).set({ providerRef: init.providerRef }).where(eq(schema.paymentAttempts.id, attempt.id));
  await db.insert(schema.orderEvents).values({ orderId: order.id, type: 'PAYMENT_INITIATED', detail: `Payment initiated with ${provider.name}` });
  ok(res, { attemptId: attempt.id, provider: provider.name, nextPath: init.nextPath }, undefined, 201);
}));

// ───────── Development / preview payment simulator (never active in production unless explicitly allowed) ─────────
async function ownedAttempt(userId: string, attemptId: string) {
  const a = await db.query.paymentAttempts.findFirst({ where: eq(schema.paymentAttempts.id, attemptId), with: { order: true } });
  if (!a || a.order.userId !== userId) throw notFound('Payment not found');
  return a;
}

checkoutRouter.get('/payments/simulator/:attemptId', asyncHandler(async (req, res) => {
  if (!simulatorEnabled()) throw notFound();
  const a = await ownedAttempt(req.auth!.id, parse(uuidParam, req.params.attemptId));
  ok(res, { attemptId: a.id, status: a.status, amount: a.amount, currency: a.currency, orderId: a.orderId, orderNumber: a.order.orderNumber, orderStatus: a.order.status, simulator: true });
}));

checkoutRouter.post('/payments/simulator/:attemptId/complete', asyncHandler(async (req, res) => {
  if (!simulatorEnabled()) throw notFound();
  const { outcome } = parse(z.object({ outcome: z.enum(['success', 'failure']) }), req.body);
  const a = await ownedAttempt(req.auth!.id, parse(uuidParam, req.params.attemptId));
  if (!a.providerRef) throw new AppError(409, 'CONFLICT', 'Payment was not initiated');
  // The simulator behaves like a gateway: it POSTs a SIGNED event through the same webhook pipeline real providers use.
  const rawBody = JSON.stringify({ id: `evt_${randomToken(10)}`, type: outcome === 'success' ? 'payment.succeeded' : 'payment.failed', providerRef: a.providerRef, amount: a.amount, currency: a.currency });
  const sig = signPayload(rawBody, Math.floor(Date.now() / 1000), getEnv().PAYMENT_WEBHOOK_SECRET);
  await processWebhook('dev_simulator', rawBody, sig);
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, a.orderId) });
  ok(res, { orderId: a.orderId, orderStatus: o?.status });
}));
