import { Router } from 'express';
import { z } from 'zod';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { asyncHandler, ok, paginationSchema, parse, uuidParam } from '../lib/http.js';
import { AppError, notFound, unprocessable } from '../lib/errors.js';
import { d2 } from '../lib/money.js';
import { randomToken } from '../lib/security.js';
import { requireAuth } from '../middleware/auth.js';
import { getEnv } from '../config/env.js';
import { computeAccountStatus, evaluateRewardEligibility } from '../services/rules.js';
import { getTradingProvider } from '../services/trading-provider.js';
import { audit } from '../services/audit.js';

export const customerRouter = Router();
customerRouter.use(requireAuth);

const id = (v: unknown) => parse(uuidParam, v);

// ───────── profile ─────────
customerRouter.get('/profile', asyncHandler(async (req, res) => {
  const p = await db.query.userProfiles.findFirst({ where: eq(schema.userProfiles.userId, req.auth!.id) });
  ok(res, { email: req.auth!.email, firstName: p?.firstName, lastName: p?.lastName, country: p?.country, phone: p?.phone, emailVerified: req.auth!.emailVerified, verificationStatus: req.auth!.verificationStatus });
}));
customerRouter.patch('/profile', asyncHandler(async (req, res) => {
  const body = parse(z.object({
    firstName: z.string().trim().min(1).max(60).optional(), lastName: z.string().trim().min(1).max(60).optional(),
    country: z.string().trim().length(2).toUpperCase().nullable().optional(), phone: z.string().trim().max(30).nullable().optional(),
  }), req.body);
  await db.update(schema.userProfiles).set(body).where(eq(schema.userProfiles.userId, req.auth!.id));
  ok(res, { updated: true });
}));

// ───────── dashboard summary ─────────
customerRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const uid = req.auth!.id;
  const [[a], [o], [n]] = await Promise.all([
    db.select({ c: count() }).from(schema.tradingAccounts).where(eq(schema.tradingAccounts.userId, uid)),
    db.select({ c: count() }).from(schema.orders).where(eq(schema.orders.userId, uid)),
    db.select({ c: count() }).from(schema.notifications).where(and(eq(schema.notifications.userId, uid), isNull(schema.notifications.readAt))),
  ]);
  const recentOrders = await db.select({ id: schema.orders.id, orderNumber: schema.orders.orderNumber, status: schema.orders.status, total: schema.orders.total, currency: schema.orders.currency, createdAt: schema.orders.createdAt })
    .from(schema.orders).where(eq(schema.orders.userId, uid)).orderBy(desc(schema.orders.createdAt)).limit(5);
  ok(res, { accounts: a.c, orders: o.c, unreadNotifications: n.c, recentOrders });
}));

// ───────── accounts (always scoped to the signed-in user: no IDOR) ─────────
async function ownedAccount(userId: string, accountId: string) {
  const acct = await db.query.tradingAccounts.findFirst({
    where: and(eq(schema.tradingAccounts.id, accountId), eq(schema.tradingAccounts.userId, userId)),
    with: { product: { with: { challenge: { with: { stages: true, rules: true } } } } },
  });
  if (!acct) throw notFound('Account not found'); // same response whether it exists or belongs to someone else
  return acct;
}

async function latestMetric(accountId: string) {
  const [m] = await db.select().from(schema.accountMetricSnapshots).where(eq(schema.accountMetricSnapshots.accountId, accountId)).orderBy(desc(schema.accountMetricSnapshots.capturedAt)).limit(1);
  return m ?? null;
}

async function syncFromProvider(acct: { id: string; accountRef: string; startingBalance: string }) {
  const provider = getTradingProvider();
  if (provider.name === 'none') return;
  const last = await latestMetric(acct.id);
  if (last && Date.now() - last.capturedAt.getTime() < 60_000) return;
  const m = await provider.getMetrics(acct);
  if (!m) return;
  const source: 'PROVIDER' | 'DEMO_FIXTURE' = provider.isDemo ? 'DEMO_FIXTURE' : 'PROVIDER';
  await db.insert(schema.accountMetricSnapshots).values({ accountId: acct.id, ...m, source });
  const [{ c }] = await db.select({ c: count() }).from(schema.tradeRecords).where(eq(schema.tradeRecords.accountId, acct.id));
  if (c === 0) {
    const trades = await provider.getTrades(acct);
    if (trades.length) await db.insert(schema.tradeRecords).values(trades.map((t) => ({ accountId: acct.id, ...t, source })));
  }
}

function currentStage(acct: Awaited<ReturnType<typeof ownedAccount>>) {
  const n = acct.phase === 'PHASE_1' ? 1 : acct.phase === 'PHASE_2' ? 2 : null;
  return n ? acct.product.challenge.stages.find((s) => s.stageNumber === n) ?? null : null;
}

function accountView(acct: Awaited<ReturnType<typeof ownedAccount>>, metric: Awaited<ReturnType<typeof latestMetric>>) {
  const rules = acct.product.challenge.rules;
  const stage = currentStage(acct);
  return {
    id: acct.id, accountRef: acct.accountRef, status: acct.status, phase: acct.phase,
    startingBalance: acct.startingBalance, currency: acct.currency, createdAt: acct.createdAt,
    challenge: { name: acct.product.challenge.name, slug: acct.product.challenge.slug, model: acct.product.challenge.model },
    rules: rules && { dailyDrawdownPct: d2(rules.dailyDrawdownPct), maxDrawdownPct: d2(rules.maxDrawdownPct), profitSplitPct: d2(rules.profitSplitPct), leverage: rules.leverage, drawdownMethod: rules.drawdownMethod },
    stage: stage && { stageNumber: stage.stageNumber, name: stage.name, profitTargetPct: d2(stage.profitTargetPct), minTradingDays: stage.minTradingDays },
    providerConnected: getTradingProvider().name !== 'none',
    metrics: metric && { balance: metric.balance, equity: metric.equity, dailyLoss: metric.dailyLoss, tradingDays: metric.tradingDays, source: metric.source, capturedAt: metric.capturedAt },
    status_view: metric && rules ? computeAccountStatus({ startingBalance: acct.startingBalance, balance: metric.balance, equity: metric.equity, dailyLoss: metric.dailyLoss, tradingDays: metric.tradingDays },
      { dailyDrawdownPct: d2(rules.dailyDrawdownPct), maxDrawdownPct: d2(rules.maxDrawdownPct), profitSplitPct: d2(rules.profitSplitPct), rewardMinAmount: d2(rules.rewardMinAmount) }, stage && { profitTargetPct: d2(stage.profitTargetPct), minTradingDays: stage.minTradingDays }) : null,
  };
}

customerRouter.get('/accounts', asyncHandler(async (req, res) => {
  const accts = await db.query.tradingAccounts.findMany({
    where: eq(schema.tradingAccounts.userId, req.auth!.id), orderBy: desc(schema.tradingAccounts.createdAt),
    with: { product: { with: { challenge: { with: { stages: true, rules: true } } } } },
  });
  const out = [];
  for (const a of accts) { await syncFromProvider(a); out.push(accountView(a, await latestMetric(a.id))); }
  ok(res, out);
}));

customerRouter.get('/accounts/:id', asyncHandler(async (req, res) => {
  const acct = await ownedAccount(req.auth!.id, id(req.params.id));
  await syncFromProvider(acct);
  const metric = await latestMetric(acct.id);
  const [history, trades, curve, rewards] = await Promise.all([
    db.select().from(schema.accountPhaseHistory).where(eq(schema.accountPhaseHistory.accountId, acct.id)).orderBy(desc(schema.accountPhaseHistory.createdAt)),
    getTradingProvider().name === 'none' ? Promise.resolve([]) : db.select().from(schema.tradeRecords).where(eq(schema.tradeRecords.accountId, acct.id)).orderBy(desc(schema.tradeRecords.openedAt)).limit(50),
    db.select({ balance: schema.accountMetricSnapshots.balance, equity: schema.accountMetricSnapshots.equity, capturedAt: schema.accountMetricSnapshots.capturedAt }).from(schema.accountMetricSnapshots)
      .where(eq(schema.accountMetricSnapshots.accountId, acct.id)).orderBy(asc(schema.accountMetricSnapshots.capturedAt)).limit(200),
    db.select().from(schema.rewardRequests).where(eq(schema.rewardRequests.accountId, acct.id)).orderBy(desc(schema.rewardRequests.createdAt)),
  ]);
  ok(res, { ...accountView(acct, metric), history, trades, curve, rewards });
}));

// ───────── rewards ─────────
async function eligibilityFor(userId: string, acct: Awaited<ReturnType<typeof ownedAccount>>, verification: string) {
  const metric = await latestMetric(acct.id);
  const rules = acct.product.challenge.rules;
  if (!rules) return { eligible: false, availableAmount: '0.00', reasons: ['Challenge rules are unavailable.'] };
  const open = await db.select({ c: count() }).from(schema.rewardRequests).where(and(eq(schema.rewardRequests.accountId, acct.id), inArray(schema.rewardRequests.status, ['PENDING', 'APPROVED'])));
  return evaluateRewardEligibility({
    accountStatus: acct.status, accountPhase: acct.phase, userVerification: verification, metricSource: metric?.source ?? null,
    startingBalance: acct.startingBalance, balance: metric?.balance ?? acct.startingBalance,
    rule: { dailyDrawdownPct: d2(rules.dailyDrawdownPct), maxDrawdownPct: d2(rules.maxDrawdownPct), profitSplitPct: d2(rules.profitSplitPct), rewardMinAmount: d2(rules.rewardMinAmount) },
    openRequests: open[0].c, allowDemoData: getEnv().NODE_ENV !== 'production' && getTradingProvider().isDemo,
  });
}

customerRouter.get('/accounts/:id/reward-eligibility', asyncHandler(async (req, res) => {
  const acct = await ownedAccount(req.auth!.id, id(req.params.id));
  ok(res, await eligibilityFor(req.auth!.id, acct, req.auth!.verificationStatus));
}));

customerRouter.get('/rewards', asyncHandler(async (req, res) => {
  const rows = await db.query.rewardRequests.findMany({ where: eq(schema.rewardRequests.userId, req.auth!.id), orderBy: desc(schema.rewardRequests.createdAt), with: { account: true } });
  ok(res, rows.map((r) => ({ id: r.id, accountRef: r.account.accountRef, amount: r.amount, status: r.status, createdAt: r.createdAt, reviewerNote: r.reviewerNote, transferRef: r.transferRef })));
}));

customerRouter.post('/rewards', asyncHandler(async (req, res) => {
  const { accountId } = parse(z.object({ accountId: uuidParam }), req.body);
  const result = await db.transaction(async (tx) => {
    // lock the account row so concurrent requests cannot both pass the "no open request" check
    await tx.execute(sql`select id from trading_accounts where id = ${accountId} and user_id = ${req.auth!.id} for update`);
    const acct = await ownedAccount(req.auth!.id, accountId);
    const elig = await eligibilityFor(req.auth!.id, acct, req.auth!.verificationStatus);
    if (!elig.eligible) throw unprocessable('This account is not currently eligible for a reward request.', elig.reasons);
    const [r] = await tx.insert(schema.rewardRequests).values({ userId: req.auth!.id, accountId, amount: elig.availableAmount }).returning();
    await audit(tx, { actorId: req.auth!.id, action: 'reward.requested', entityType: 'reward', entityId: r.id, detail: { amount: elig.availableAmount } });
    return r;
  });
  ok(res, { id: result.id, amount: result.amount, status: result.status }, undefined, 201);
}));

// ───────── orders (read) ─────────
customerRouter.get('/orders', asyncHandler(async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const rows = await db.query.orders.findMany({
    where: eq(schema.orders.userId, req.auth!.id), orderBy: desc(schema.orders.createdAt), limit: pageSize, offset: (page - 1) * pageSize, with: { items: true },
  });
  const [t] = await db.select({ c: count() }).from(schema.orders).where(eq(schema.orders.userId, req.auth!.id));
  ok(res, rows.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, total: o.total, currency: o.currency, createdAt: o.createdAt, paidAt: o.paidAt, items: o.items.map((i) => i.description) })), { page, pageSize, total: t.c });
}));

customerRouter.get('/orders/:id', asyncHandler(async (req, res) => {
  const o = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, id(req.params.id)), eq(schema.orders.userId, req.auth!.id)),
    with: { items: true, events: { orderBy: asc(schema.orderEvents.createdAt) }, attempts: true },
  });
  if (!o) throw notFound('Order not found');
  ok(res, {
    id: o.id, orderNumber: o.orderNumber, status: o.status, subtotal: o.subtotal, total: o.total, currency: o.currency, createdAt: o.createdAt, paidAt: o.paidAt,
    items: o.items.map((i) => ({ id: i.id, description: i.description, unitPrice: i.unitPrice, quantity: i.quantity, addons: i.addons })),
    events: o.events.map((e) => ({ type: e.type, detail: e.detail, createdAt: e.createdAt })),
    latestAttemptId: o.attempts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.id ?? null,
  });
}));

// ───────── support tickets ─────────
customerRouter.get('/tickets', asyncHandler(async (req, res) => {
  const rows = await db.select().from(schema.supportTickets).where(eq(schema.supportTickets.userId, req.auth!.id)).orderBy(desc(schema.supportTickets.updatedAt));
  ok(res, rows.map((t) => ({ id: t.id, ticketNo: t.ticketNo, subject: t.subject, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt })));
}));

customerRouter.post('/tickets', asyncHandler(async (req, res) => {
  const body = parse(z.object({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(10).max(4000) }), req.body);
  const profile = await db.query.userProfiles.findFirst({ where: eq(schema.userProfiles.userId, req.auth!.id) });
  const ticketNo = `ISS-T-${randomToken(5).toUpperCase().replace(/[-_]/g, 'X')}`;
  const t = await db.transaction(async (tx) => {
    const [t] = await tx.insert(schema.supportTickets).values({ ticketNo, userId: req.auth!.id, name: `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || req.auth!.email, email: req.auth!.email, subject: body.subject }).returning();
    await tx.insert(schema.supportMessages).values({ ticketId: t.id, authorId: req.auth!.id, body: body.message });
    return t;
  });
  ok(res, { id: t.id, ticketNo }, undefined, 201);
}));

async function ownedTicket(userId: string, ticketId: string) {
  const t = await db.query.supportTickets.findFirst({ where: and(eq(schema.supportTickets.id, ticketId), eq(schema.supportTickets.userId, userId)) });
  if (!t) throw notFound('Ticket not found');
  return t;
}

customerRouter.get('/tickets/:id', asyncHandler(async (req, res) => {
  const t = await ownedTicket(req.auth!.id, id(req.params.id));
  const msgs = await db.select({ id: schema.supportMessages.id, body: schema.supportMessages.body, isStaff: schema.supportMessages.isStaff, createdAt: schema.supportMessages.createdAt })
    .from(schema.supportMessages).where(and(eq(schema.supportMessages.ticketId, t.id), eq(schema.supportMessages.isInternal, false))).orderBy(asc(schema.supportMessages.createdAt));
  ok(res, { id: t.id, ticketNo: t.ticketNo, subject: t.subject, status: t.status, messages: msgs });
}));

customerRouter.post('/tickets/:id/messages', asyncHandler(async (req, res) => {
  const { body } = parse(z.object({ body: z.string().trim().min(1).max(4000) }), req.body);
  const t = await ownedTicket(req.auth!.id, id(req.params.id));
  if (t.status === 'CLOSED') throw new AppError(409, 'CONFLICT', 'This ticket is closed. Please open a new request.');
  await db.transaction(async (tx) => {
    await tx.insert(schema.supportMessages).values({ ticketId: t.id, authorId: req.auth!.id, body });
    await tx.update(schema.supportTickets).set({ status: 'OPEN' }).where(eq(schema.supportTickets.id, t.id));
  });
  ok(res, { sent: true }, undefined, 201);
}));

// ───────── notifications ─────────
customerRouter.get('/notifications', asyncHandler(async (req, res) => {
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, req.auth!.id)).orderBy(desc(schema.notifications.createdAt)).limit(100);
  ok(res, rows);
}));
customerRouter.post('/notifications/read-all', asyncHandler(async (req, res) => {
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.userId, req.auth!.id), isNull(schema.notifications.readAt)));
  ok(res, { updated: true });
}));
customerRouter.post('/notifications/:id/read', asyncHandler(async (req, res) => {
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.id, id(req.params.id)), eq(schema.notifications.userId, req.auth!.id)));
  ok(res, { updated: true });
}));
