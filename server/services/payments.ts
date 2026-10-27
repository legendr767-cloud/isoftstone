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
  id: string; type: 'payment.succeeded' | 'payment.failed' | 'ignore';
  providerRef: string; amount: string; currency: string;
}

export interface InitiateInput {
  attemptId: string; orderId: string; orderNumber: string; amount: string; currency: string;
  customer: { name: string; email: string };
}

/**
 * Payment provider abstraction. A real gateway implements:
 *  - initiate(): create a payment session with the gateway (returns where to send the customer)
 *  - verifyWebhook(): authenticate an inbound webhook and normalise it
 *  - confirm() (optional): ask the gateway's API to confirm the transaction before fulfilment
 * Orders are NEVER marked paid from a browser redirect — only from a verified webhook.
 */
export interface PaymentProvider {
  readonly name: string;
  initiate(a: InitiateInput): Promise<{ providerRef: string; nextPath: string | null }>;
  verifyWebhook(rawBody: string, signatureHeader: string | undefined): PaymentEvent;
  confirm?(event: PaymentEvent): Promise<void>;
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

const KORA_BASE = 'https://api.korapay.com/merchant/api/v1';

/** Kora (formerly Korapay) hosted checkout. https://developers.korapay.com */
export class KoraProvider implements PaymentProvider {
  name = 'kora';
  private key() { return getEnv().KORA_SECRET_KEY!; }
  async initiate(a: InitiateInput) {
    const env = getEnv(); const reference = `isoft-${a.attemptId}`;
    let res: Response;
    try {
      res = await fetch(`${KORA_BASE}/charges/initialize`, {
        method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${this.key()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference, amount: Number(a.amount), currency: env.KORA_CURRENCY, narration: `iSoftStone order ${a.orderNumber}`,
          redirect_url: `${env.APP_URL}/dashboard/orders/${a.orderId}`, notification_url: `${env.APP_URL}/api/v1/payments/webhook/kora`,
          customer: { name: a.customer.name, email: a.customer.email }, merchant_bears_cost: false,
        }),
      });
    } catch (err) { logger.error({ err }, 'kora initialize failed'); throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not reach the payment provider. Please try again.'); }
    const json = await res.json().catch(() => null) as { status?: boolean; message?: string; data?: { checkout_url?: string } } | null;
    if (!res.ok || !json?.status || !json.data?.checkout_url) {
      logger.error({ status: res.status, message: json?.message }, 'kora rejected initialize');
      throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'The payment provider could not start this payment. Please try again.');
    }
    return { providerRef: reference, nextPath: json.data.checkout_url };
  }
  /** Kora signs ONLY the `data` object: HMAC-SHA256(secret_key, JSON.stringify(data)) in `x-korapay-signature`. */
  verifyWebhook(rawBody: string, header: string | undefined): PaymentEvent {
    let body: { event?: string; data?: { reference?: string; amount?: number | string; currency?: string } };
    try { body = JSON.parse(rawBody); } catch { throw new AppError(400, 'BAD_JSON', 'Malformed webhook body'); }
    if (!body?.data || !header || !safeEqual(hmacSha256(this.key(), JSON.stringify(body.data)), header)) {
      throw new AppError(400, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
    }
    const d = body.data;
    const type = body.event === 'charge.success' ? 'payment.succeeded' : body.event === 'charge.failed' ? 'payment.failed' : 'ignore';
    return { id: `${body.event}:${d.reference}`, type, providerRef: String(d.reference), amount: d2(Number(d.amount)), currency: String(d.currency ?? '') };
  }
  /** Second line of defence: confirm the transaction with Kora's API before any value is delivered. */
  async confirm(event: PaymentEvent) {
    if (event.type !== 'payment.succeeded') return;
    let res: Response;
    try { res = await fetch(`${KORA_BASE}/charges/${encodeURIComponent(event.providerRef)}`, { signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${this.key()}` } }); }
    catch { throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not confirm the transaction'); }
    const json = await res.json().catch(() => null) as { data?: { status?: string; amount?: number | string; currency?: string } } | null;
    const d = json?.data;
    if (!res.ok || d?.status !== 'success' || cmpMoney(d2(Number(d.amount)), event.amount) !== 0 || d.currency !== event.currency) {
      logger.warn({ ref: event.providerRef, status: d?.status }, 'kora transaction confirmation failed');
      throw new AppError(502, 'PAYMENT_NOT_CONFIRMED', 'Transaction could not be confirmed with the provider');
    }
  }
}

class DevSimulatorProvider implements PaymentProvider {
  name = 'dev_simulator';
  async initiate(a: InitiateInput) {
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
  const p = getEnv().PAYMENT_PROVIDER;
  if (p === 'kora') return new KoraProvider();
  return p === 'dev_simulator' && simulatorEnabled() ? new DevSimulatorProvider() : null;
}

/** Idempotent webhook processing. Safe to call repeatedly with the same event. */
export async function processWebhook(providerName: string, rawBody: string, signature: string | undefined) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== providerName) throw new AppError(404, 'NOT_FOUND', 'Unknown payment provider');

  let event: PaymentEvent;
  try {
    event = provider.verifyWebhook(rawBody, signature);
    if (event.type === 'ignore') return { duplicate: false as const, ignored: 'event_type' as const };
    await provider.confirm?.(event);
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
