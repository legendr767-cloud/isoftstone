import { and, eq, sql } from 'drizzle-orm';
import { db, schema, type Tx } from '../db/index.js';
import { getEnv, isProd } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { cmpMoney, d2 } from '../lib/money.js';
import { hmacSha256, randomToken, safeEqual } from '../lib/security.js';
import { audit, notify } from './audit.js';
import { logger } from '../lib/logger.js';

export const SIGNATURE_TOLERANCE_SEC = 300;

export interface PaymentEvent {
  id: string; type: 'payment.succeeded' | 'payment.failed';
  providerRef: string; amount: string; currency: string;
}

/**
 * Payment provider abstraction. A real gateway implements the same two operations:
 *  - initiate(): create a payment session with the gateway
 *  - verifyWebhook(): authenticate an inbound webhook and normalise it
 * Orders are NEVER marked paid from a browser redirect — only from a verified webhook.
 */
export interface PaymentProvider {
  readonly name: string;
  initiate(a: { attemptId: string; amount: string; currency: string }): Promise<{ providerRef: string; nextPath: string | null }>;
  verifyWebhook(rawBody: string, signatureHeader: string | undefined): PaymentEvent;
}

export function signPayload(rawBody: string, timestamp: number, secret: string) {
  return `t=${timestamp},v1=${hmacSha256(secret, `${timestamp}.${rawBody}`)}`;
}

export function verifySignature(rawBody: string, header: string | undefined, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(now / 1000 - t) > SIGNATURE_TOLERANCE_SEC) return false; // replay protection
  return safeEqual(parts.v1, hmacSha256(secret, `${t}.${rawBody}`));
}

class DevSimulatorProvider implements PaymentProvider {
  name = 'dev_simulator';
  async initiate(a: { attemptId: string }) {
    return { providerRef: `sim_${randomToken(12)}`, nextPath: `/checkout/simulate/${a.attemptId}` };
  }
  verifyWebhook(rawBody: string, header: string | undefined): PaymentEvent {
    if (!verifySignature(rawBody, header, getEnv().PAYMENT_WEBHOOK_SECRET)) {
      throw new AppError(400, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
    }
    return JSON.parse(rawBody) as PaymentEvent;
  }
}

export function simulatorEnabled(): boolean {
  const e = getEnv();
  return e.PAYMENT_PROVIDER === 'dev_simulator' && (!isProd() || e.ALLOW_PAYMENT_SIMULATOR);
}

export function getPaymentProvider(): PaymentProvider | null {
  return getEnv().PAYMENT_PROVIDER === 'dev_simulator' && simulatorEnabled() ? new DevSimulatorProvider() : null;
}

/** Idempotent webhook processing. Safe to call repeatedly with the same event. */
export async function processWebhook(providerName: string, rawBody: string, signature: string | undefined) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== providerName) throw new AppError(404, 'NOT_FOUND', 'Unknown payment provider');

  let event: PaymentEvent;
  try {
    event = provider.verifyWebhook(rawBody, signature);
  } catch (e) {
    logger.warn({ provider: providerName }, 'rejected webhook with invalid signature');
    throw e;
  }

  return db.transaction(async (tx) => {
    // idempotency: unique(provider,event_id)
    const inserted = await tx.insert(schema.paymentWebhookEvents)
      .values({ provider: providerName, eventId: event.id, type: event.type, payload: event as never, signatureValid: true })
      .onConflictDoNothing().returning({ id: schema.paymentWebhookEvents.id });
    if (inserted.length === 0) return { duplicate: true as const };

    const [attempt] = await tx.select().from(schema.paymentAttempts)
      .where(and(eq(schema.paymentAttempts.provider, providerName), eq(schema.paymentAttempts.providerRef, event.providerRef))).limit(1);
    if (!attempt) throw new AppError(404, 'NOT_FOUND', 'Unknown payment reference');

    // serialise concurrent events for the same order
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, attempt.orderId)).for('update');

    if (cmpMoney(event.amount, order.total) !== 0 || event.currency !== order.currency) {
      await tx.update(schema.paymentWebhookEvents).set({ error: 'amount_or_currency_mismatch', processedAt: new Date() })
        .where(and(eq(schema.paymentWebhookEvents.provider, providerName), eq(schema.paymentWebhookEvents.eventId, event.id)));
      await tx.insert(schema.orderEvents).values({ orderId: order.id, type: 'PAYMENT_MISMATCH', detail: 'Webhook amount/currency did not match order total; ignored.' });
      return { duplicate: false as const, ignored: 'mismatch' as const };
    }

    if (event.type === 'payment.succeeded') {
      if (order.status === 'PAID') return { duplicate: true as const };
      await tx.update(schema.paymentAttempts).set({ status: 'SUCCEEDED' }).where(eq(schema.paymentAttempts.id, attempt.id));
      await tx.update(schema.orders).set({ status: 'PAID', paidAt: new Date() }).where(eq(schema.orders.id, order.id));
      await tx.insert(schema.orderEvents).values({ orderId: order.id, type: 'PAYMENT_CONFIRMED', detail: `Confirmed by verified ${providerName} webhook` });
      await fulfilOrder(tx, order.id, order.userId);
    } else {
      await tx.update(schema.paymentAttempts).set({ status: 'FAILED' }).where(eq(schema.paymentAttempts.id, attempt.id));
      if (order.status !== 'PAID') await tx.update(schema.orders).set({ status: 'FAILED' }).where(eq(schema.orders.id, order.id));
      await tx.insert(schema.orderEvents).values({ orderId: order.id, type: 'PAYMENT_FAILED', detail: 'Payment failed at provider' });
      await notify(tx, order.userId, 'Payment failed', `Your payment for order ${order.orderNumber} did not complete. You can try again from your orders page.`);
    }
    await tx.update(schema.paymentWebhookEvents).set({ processedAt: new Date() })
      .where(and(eq(schema.paymentWebhookEvents.provider, providerName), eq(schema.paymentWebhookEvents.eventId, event.id)));
    return { duplicate: false as const };
  });
}

/**
 * Fulfilment creates account RECORDS in PENDING_PROVISIONING. It does not issue trading credentials:
 * that requires a tested provisioning integration with the broker/platform.
 */
async function fulfilOrder(tx: Tx, orderId: string, userId: string) {
  const items = await tx.query.orderItems.findMany({ where: eq(schema.orderItems.orderId, orderId), with: { product: { with: { sizeOption: true } } } });
  for (const item of items) {
    for (let n = 0; n < item.quantity; n++) {
      const [acct] = await tx.insert(schema.tradingAccounts).values({
        accountRef: `ISS-${randomToken(6).toUpperCase().replace(/[-_]/g, 'X')}`,
        userId, productId: item.productId, orderItemId: item.id,
        startingBalance: d2(item.product.sizeOption.accountSize), currency: item.product.currency,
      }).onConflictDoNothing().returning();
      if (acct) await tx.insert(schema.accountPhaseHistory).values({ accountId: acct.id, phase: 'PHASE_1', status: 'PENDING_PROVISIONING', note: 'Order paid. Awaiting provisioning.' });
    }
  }
  const [order] = await tx.select({ n: schema.orders.orderNumber }).from(schema.orders).where(eq(schema.orders.id, orderId));
  await notify(tx, userId, 'Payment confirmed', `Order ${order.n} is confirmed. Your account record is pending provisioning; we will notify you when it is ready.`);
  await audit(tx, { actorId: null, action: 'order.fulfilled', entityType: 'order', entityId: orderId });
}

export { sql };
