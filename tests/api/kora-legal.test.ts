import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { app, client, createAdmin, firstProduct, registerUser, uniq } from './helpers';
import { db, schema } from '../../server/db/index.js';
import { resetEnvCache } from '../../server/config/env.js';

const KEY = 'sk_test_unit_secret_key';
const sign = (data: object) => createHmac('sha256', KEY).update(JSON.stringify(data)).digest('hex');
const hook = (event: string, data: object, sig = sign(data)) =>
  request(app).post('/api/v1/payments/webhook/kora').set('Content-Type', 'application/json').set('x-korapay-signature', sig).send(JSON.stringify({ event, data }));

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => { process.env.PAYMENT_PROVIDER = 'kora'; process.env.KORA_SECRET_KEY = KEY; resetEnvCache(); });
afterEach(() => { vi.unstubAllGlobals(); process.env.PAYMENT_PROVIDER = 'dev_simulator'; delete process.env.KORA_SECRET_KEY; resetEnvCache(); });

async function start(fetchImpl: Fetch) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  const u = await registerUser(); const { product } = await firstProduct();
  const o = await u.c.post('/orders', { items: [{ productId: product.productId }], acceptTerms: true });
  const pay = await u.c.post(`/orders/${o.body.data.id}/pay`);
  return { u, product, orderId: o.body.data.id as string, total: o.body.data.total as string, pay };
}
const checkoutOk: Fetch = async () => json({ status: true, data: { reference: 'x', checkout_url: 'https://checkout.korapay.com/KPY-123/pay' } });

describe('Kora payments', () => {
  it('creates a hosted checkout with the verified server-side amount and returns its URL', async () => {
    const f = vi.fn(checkoutOk);
    const { pay, total, orderId } = await start(f);
    expect(pay.status).toBe(201);
    expect(pay.body.data.nextPath).toBe('https://checkout.korapay.com/KPY-123/pay');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.korapay.com/merchant/api/v1/charges/initialize');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ amount: Number(total), currency: 'USD', merchant_bears_cost: false });
    expect(sent.reference).toMatch(/^isoft-/);
    expect(sent.notification_url).toBe('http://localhost:5173/api/v1/payments/webhook/kora');
    expect(sent.redirect_url).toBe(`http://localhost:5173/dashboard/orders/${orderId}`);
    expect(JSON.stringify(sent)).not.toContain(KEY);
  });

  it('fulfils only after a valid signature AND an API confirmation; duplicates are no-ops', async () => {
    let confirmStatus = 'success'; let paid = 0;
    const { u, orderId, total } = await start(async (url) => (String(url).includes('/charges/initialize') ? checkoutOk(url) : json({ data: { status: confirmStatus, amount: paid, currency: 'USD' } })));
    paid = Number(total);
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(schema.paymentAttempts.orderId, orderId) });
    const data = { reference: attempt!.providerRef, currency: 'USD', amount: Number(total), fee: 1.2, status: 'success' };

    expect((await hook('charge.success', data, 'f'.repeat(64))).status).toBe(400); // forged signature
    expect((await u.c.get(`/me/orders/${orderId}`)).body.data.status).toBe('AWAITING_PAYMENT');

    confirmStatus = 'processing'; // signature fine but Kora's API does not confirm success
    expect((await hook('charge.success', data)).status).toBe(502);
    expect((await u.c.get(`/me/orders/${orderId}`)).body.data.status).toBe('AWAITING_PAYMENT');

    confirmStatus = 'success';
    expect((await hook('charge.success', data)).status).toBe(200);
    expect((await u.c.get(`/me/orders/${orderId}`)).body.data.status).toBe('PAID');
    const again = await hook('charge.success', data);
    expect(again.body.data.duplicate).toBe(true);
    expect((await u.c.get('/me/accounts')).body.data).toHaveLength(1);
  });

  it('marks the order failed on charge.failed and ignores unrelated events', async () => {
    const { u, orderId, total } = await start(checkoutOk);
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(schema.paymentAttempts.orderId, orderId) });
    const data = { reference: attempt!.providerRef, currency: 'USD', amount: Number(total), status: 'failed' };
    expect((await hook('charge.failed', data)).status).toBe(200);
    expect((await u.c.get(`/me/orders/${orderId}`)).body.data.status).toBe('FAILED');
    expect((await hook('transfer.success', { reference: 'other', amount: 1, currency: 'USD' })).status).toBe(200);
  });

  it('does not fulfil when the paid amount differs from the order', async () => {
    const { u, orderId, total } = await start(async (url) => (String(url).includes('initialize') ? checkoutOk(url) : json({ data: { status: 'success', amount: 1, currency: 'USD' } })));
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(schema.paymentAttempts.orderId, orderId) });
    expect((await hook('charge.success', { reference: attempt!.providerRef, currency: 'USD', amount: 1, status: 'success' })).status).toBe(200);
    const o = (await u.c.get(`/me/orders/${orderId}`)).body.data;
    expect(o.status).toBe('AWAITING_PAYMENT');
    expect(o.events.some((e: any) => e.type === 'PAYMENT_MISMATCH')).toBe(true);
    expect(Number(total)).toBeGreaterThan(1);
  });

  it('reports a gateway failure cleanly and lets the customer retry', async () => {
    const { u, orderId, pay } = await start(async () => json({ status: false, message: 'Invalid key' }, 401));
    expect(pay.status).toBe(502);
    expect(JSON.stringify(pay.body)).not.toMatch(/Invalid key|sk_test/); // provider detail is not leaked
    vi.stubGlobal('fetch', vi.fn(checkoutOk));
    expect((await u.c.post(`/orders/${orderId}/pay`)).status).toBe(201);
  });

  it('is reported in /site as the active gateway, and the simulator endpoints are off', async () => {
    vi.stubGlobal('fetch', vi.fn(checkoutOk));
    expect((await client().get('/site')).body.data.payments).toEqual({ configured: true, mode: 'kora' });
    const u = await registerUser();
    expect((await u.c.get('/payments/simulator/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});

describe('100% profit-split add-on', () => {
  it('is priced on the server and raises the reward split for that account only', async () => {
    process.env.PAYMENT_PROVIDER = 'dev_simulator'; resetEnvCache();
    const buy = async (codes: string[]) => {
      const u = await registerUser(); const { product } = await firstProduct();
      const o = await u.c.post('/orders', { items: [{ productId: product.productId, addonCodes: codes }], acceptTerms: true });
      const pay = await u.c.post(`/orders/${o.body.data.id}/pay`);
      await u.c.post(`/payments/simulator/${pay.body.data.attemptId}/complete`, { outcome: 'success' });
      return { u, total: o.body.data.total as string, price: product.price };
    };
    const plain = await buy([]); const plus = await buy(['profit-split-100']);
    expect(Number(plus.total)).toBeCloseTo(Number(plus.price) * 1.15, 2);
    const admin = await createAdmin();
    const amountFor = async (b: Awaited<ReturnType<typeof buy>>) => {
      const acct = (await b.u.c.get('/me/accounts')).body.data[0];
      const me = (await b.u.c.get('/auth/me')).body.data;
      await admin.c.patch(`/admin/accounts/${acct.id}`, { status: 'ACTIVE', phase: 'FUNDED_SIM' });
      await admin.c.patch(`/admin/customers/${me.id}`, { verificationStatus: 'APPROVED' });
      await db.insert(schema.accountMetricSnapshots).values({ accountId: acct.id, balance: '6000.00', equity: '6000.00', dailyLoss: '0', tradingDays: 10, source: 'PROVIDER', capturedAt: new Date(Date.now() + 9000) });
      await db.delete(schema.accountMetricSnapshots).where(eq(schema.accountMetricSnapshots.source, 'DEMO_FIXTURE'));
      return (await b.u.c.get(`/me/accounts/${acct.id}/reward-eligibility`)).body.data;
    };
    expect((await amountFor(plain)).availableAmount).toBe('800.00'); // 80% of 1,000 profit
    expect((await amountFor(plus)).availableAmount).toBe('1000.00'); // 100% with the add-on
  });
});

describe('legal documents', () => {
  it('lets only authorised staff publish a new version, which customers then see and accept', async () => {
    const user = await registerUser();
    expect((await user.c.put('/admin/legal/terms', { body: 'x'.repeat(40), status: 'PUBLISHED' })).status).toBe(403);
    const support = await createAdmin('support');
    expect((await support.c.put('/admin/legal/terms', { body: 'x'.repeat(40), status: 'PUBLISHED' })).status).toBe(403);
    const admin = await createAdmin();
    const text = `## Heading ${uniq()}\nThis is the reviewed text of the terms.`;
    expect((await admin.c.put('/admin/legal/terms', { body: text, status: 'PUBLISHED' })).body.data.version).toBeGreaterThan(1);
    const pub = (await client().get('/legal/terms')).body.data;
    expect(pub.status).toBe('PUBLISHED'); expect(pub.body).toBe(text);
    const late = await registerUser(); // new registrations record acceptance of the newest version
    const acc = await db.select().from(schema.legalAcceptances).where(eq(schema.legalAcceptances.userId, late.id));
    expect(acc).toHaveLength(1);
    expect((await admin.c.put('/admin/legal/nope', { body: text, status: 'PUBLISHED' })).status).toBe(404);
    const log = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'legal.version_published'));
    expect(log.length).toBeGreaterThan(0);
  });
});
