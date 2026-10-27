import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, createAdmin, registerUser, uniq } from './helpers';
import { db, schema } from '../../server/db/index.js';

const validInput = (over: Record<string, unknown> = {}) => ({
  slug: `test-fx-${uniq()}`, name: 'Test Forex Evaluation', model: 'ONE_STEP', tagline: 'A forex test challenge', description: 'Forex-only evaluation used by the test suite.',
  stages: [{ name: 'Evaluation', profitTargetPct: 10, minTradingDays: 3 }],
  rules: { dailyDrawdownPct: 4, maxDrawdownPct: 8, drawdownMethod: 'BALANCE_BASED', leverage: '1:100', profitSplitPct: 80, newsTradingAllowed: true, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false },
  sizes: [{ accountSize: 10000, price: 99 }, { accountSize: 25000, price: 199 }],
  instruments: ['EUR/USD', 'GBP/USD'], ...over,
});

describe('public catalogue', () => {
  it('lists published challenges with rules, stages, sizes, prices and forex instruments', async () => {
    const res = await client().get('/challenges');
    expect(res.status).toBe(200);
    const one = res.body.data.find((c: any) => c.slug === 'one-step-forex');
    expect(one.rules.dailyDrawdownPct).toBe('4.00');
    expect(one.stages).toHaveLength(1);
    expect(one.sizes[0].price).toBeTruthy();
    expect(one.instruments).toContain('EUR/USD');
    expect(one.instruments.every((s: string) => /^[A-Z]{3}\/[A-Z]{3}$/.test(s))).toBe(true);
  });
  it('filters by model and size and sorts by price', async () => {
    const two = await client().get('/challenges?model=TWO_STEP');
    expect(two.body.data.every((c: any) => c.model === 'TWO_STEP')).toBe(true);
    const big = await client().get('/challenges?minSize=50000');
    expect(big.body.data.every((c: any) => c.sizes.every((s: any) => Number(s.accountSize) >= 50000))).toBe(true);
    const sorted = await client().get('/challenges?sort=price_desc');
    const mins = sorted.body.data.map((c: any) => Math.min(...c.sizes.map((s: any) => Number(s.price))));
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect((await client().get('/challenges?model=FUTURES')).status).toBe(400);
  });
  it('lists the six approved forex models and no instant funding', async () => {
    const res = await client().get('/challenges');
    const slugs = res.body.data.map((c: any) => c.slug);
    expect(slugs).toEqual(['one-step-forex', 'two-step-forex', 'two-step-standard', 'two-step-pro', 'three-step-forex', 'blitz-forex']);
    expect(res.body.data.every((c: any) => c.model !== 'INSTANT' && !c.isDraftTerms)).toBe(true);
    const three = res.body.data.find((c: any) => c.slug === 'three-step-forex');
    expect(three.stages.map((s: any) => s.profitTargetPct)).toEqual(['6.00', '6.00', '6.00']);
    expect((await client().get('/challenges?model=INSTANT')).status).toBe(400);
    expect((await client().get('/challenges?model=THREE_STEP')).body.data).toHaveLength(1);
  });
  it('keeps a new challenge hidden until its terms are approved (draft switch off), then shows it', async () => {
    const admin = await createAdmin();
    await admin.c.put('/admin/site/show-draft-offers', { value: false });
    const created = await admin.c.post('/admin/challenges', validInput({ slug: `hidden-${uniq()}` }));
    await admin.c.post(`/admin/challenges/${created.body.data.id}/publish`);
    const visible = async () => (await client().get('/challenges')).body.data.some((c: any) => c.slug === created.body.data.slug);
    expect(await visible()).toBe(false);
    await admin.c.post(`/admin/challenges/${created.body.data.id}/approve`);
    expect(await visible()).toBe(true);
    await admin.c.post(`/admin/challenges/${created.body.data.id}/unpublish`);
    expect(await visible()).toBe(false);
  });
  it('serves FAQ search and labelled draft legal documents', async () => {
    const faq = await client().get('/faq?q=drawdown');
    expect(faq.body.data.length).toBeGreaterThan(0);
    const terms = await client().get('/legal/terms');
    expect(terms.body.data.status).toBe('DRAFT'); // until counsel-reviewed text is published
    expect(terms.body.data.body).toMatch(/pending review by qualified legal counsel/);
    expect(terms.body.data.body).toMatch(/Kora/);
  });
  it('contains no futures offering anywhere in seeded content', async () => {
    const [ch, faq] = await Promise.all([client().get('/challenges'), client().get('/faq')]);
    const text = JSON.stringify(ch.body.data).toLowerCase();
    expect(text).not.toMatch(/\bfutures?\b|\bcme\b|e-?mini/);
    // FAQ may state that futures are NOT offered, but must never advertise them
    for (const item of faq.body.data) expect(item.answer.toLowerCase()).not.toMatch(/futures (account|challenge|plan)/);
  });
});

describe('admin challenge management', () => {
  it('creates, edits, approves and publishes a forex challenge, with an audit trail', async () => {
    const { c } = await createAdmin();
    const created = await c.post('/admin/challenges', validInput());
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.isDraftTerms).toBe(true);
    expect(created.body.data.status).toBe('DRAFT');

    const upd = validInput({ slug: created.body.data.slug, sizes: [{ accountSize: 10000, price: 129 }, { accountSize: 25000, price: 199 }] });
    const edited = await c.put(`/admin/challenges/${id}`, upd);
    expect(edited.status).toBe(200);
    expect(edited.body.data.sizes.find((s: any) => s.accountSize === '10000.00').price).toBe('129.00');

    expect((await c.post(`/admin/challenges/${id}/publish`)).body.data.status).toBe('PUBLISHED');
    expect((await c.post(`/admin/challenges/${id}/approve`)).body.data.isDraftTerms).toBe(false);
    const audit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, id));
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['challenge.created', 'challenge.updated', 'challenge.published', 'challenge.terms_approved']));
    const upd2 = audit.find((a) => a.action === 'challenge.updated')!;
    expect(JSON.stringify(upd2.detail)).toContain('129.00'); // price change recorded
  });

  it('rejects futures and non-forex content on the server', async () => {
    const { c } = await createAdmin();
    for (const body of [
      validInput({ name: 'E-mini Futures Challenge' }),
      validInput({ description: 'Trade CME futures contracts with us.' }),
      validInput({ instruments: ['ES', 'EUR/USD'] }),
      validInput({ instruments: ['BTC/USD'] }),
      validInput({ instruments: ['XAU/USD'] }),
    ]) {
      const res = await c.post('/admin/challenges', body);
      expect(res.status).toBe(422);
    }
    expect((await c.post('/admin/challenges', validInput({ model: 'FUTURES' }))).status).toBe(400);
  });

  it('enforces stage counts per model, drawdown ordering, and unique sizes', async () => {
    const { c } = await createAdmin();
    expect((await c.post('/admin/challenges', validInput({ model: 'TWO_STEP' }))).status).toBe(422);
    expect((await c.post('/admin/challenges', validInput({ model: 'THREE_STEP' }))).status).toBe(422);
    expect((await c.post('/admin/challenges', validInput({ model: 'INSTANT' }))).status).toBe(400); // instant funding is not offered
    const r = validInput().rules as any;
    expect((await c.post('/admin/challenges', validInput({ rules: { ...r, dailyDrawdownPct: 9, maxDrawdownPct: 5 } }))).status).toBe(422);
    expect((await c.post('/admin/challenges', validInput({ sizes: [{ accountSize: 5000, price: 50 }, { accountSize: 5000, price: 60 }] }))).status).toBe(422);
  });

  it('refuses to publish an incomplete challenge', async () => {
    const { c } = await createAdmin();
    const created = await c.post('/admin/challenges', validInput({ sizes: [{ accountSize: 10000, price: 99, active: false }] }));
    const res = await c.post(`/admin/challenges/${created.body.data.id}/publish`);
    expect(res.status).toBe(422);
  });

  it('does not let a customer or support agent manage products', async () => {
    const { c } = await registerUser();
    expect((await c.post('/admin/challenges', validInput())).status).toBe(403);
    const support = await createAdmin('support');
    expect((await support.c.post('/admin/challenges', validInput())).status).toBe(403);
  });
});

describe('contact & support', () => {
  it('stores a validated request, ignores bots, hides internal notes from customers', async () => {
    const res = await client().post('/contact', { name: 'Visitor', email: 'v@test.dev', subject: 'Question', message: 'How do the rules work exactly?' });
    expect(res.status).toBe(201);
    const row = await db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.ticketNo, res.body.data.ticketNo) });
    expect(row?.email).toBe('v@test.dev');
    const bot = await client().post('/contact', { name: 'Bot', email: 'b@test.dev', subject: 'Spam', message: 'Buy my product now please', website: 'http://spam' });
    expect(bot.status).toBe(201);
    expect(await db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.email, 'b@test.dev') })).toBeUndefined();
    expect((await client().post('/contact', { name: 'x', email: 'bad', subject: '', message: 'short' })).status).toBe(400);

    const user = await registerUser();
    const t = await user.c.post('/me/tickets', { subject: 'Need help', message: 'I need help with my account.' });
    const staff = await createAdmin('support');
    await staff.c.post(`/admin/tickets/${t.body.data.id}/messages`, { body: 'INTERNAL: check fraud flags', internal: true });
    await staff.c.post(`/admin/tickets/${t.body.data.id}/messages`, { body: 'We are looking into it.' });
    const thread = await user.c.get(`/me/tickets/${t.body.data.id}`);
    const bodies = thread.body.data.messages.map((m: any) => m.body);
    expect(bodies).toContain('We are looking into it.');
    expect(bodies.join(' ')).not.toMatch(/INTERNAL/);
  });
});
