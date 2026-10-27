import { Router } from 'express';
import { z } from 'zod';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { asyncHandler, clientIp, ok, paginationSchema, parse, uuidParam } from '../lib/http.js';
import { AppError, notFound, unprocessable } from '../lib/errors.js';
import { requirePermission } from '../middleware/auth.js';
import { audit, notify } from '../services/audit.js';
import { challengeInputSchema, saveChallenge } from '../services/challenge-admin.js';
import { getAdminChallenge } from '../services/catalog.js';

export const adminRouter = Router();
const P = requirePermission;
const pid = (v: unknown) => parse(uuidParam, v);
const like = (q?: string) => (q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null); // escape LIKE wildcards; Postgres default escape is backslash

adminRouter.get('/overview', P('admin:overview'), asyncHandler(async (_req, res) => {
  const c = async (t: any, w?: any) => (await db.select({ c: count() }).from(t).where(w))[0].c;
  const [customers, orders, paid, failed, published, openTickets, accounts, pendingRewards] = await Promise.all([
    c(schema.users), c(schema.orders), c(schema.orders, eq(schema.orders.status, 'PAID')), c(schema.orders, eq(schema.orders.status, 'FAILED')),
    c(schema.challenges, eq(schema.challenges.status, 'PUBLISHED')), c(schema.supportTickets, eq(schema.supportTickets.status, 'OPEN')),
    c(schema.tradingAccounts), c(schema.rewardRequests, eq(schema.rewardRequests.status, 'PENDING')),
  ]);
  const pendingProvisioning = await c(schema.tradingAccounts, eq(schema.tradingAccounts.status, 'PENDING_PROVISIONING'));
  const recent = await db.select({ id: schema.users.id, email: schema.users.email, createdAt: schema.users.createdAt }).from(schema.users).orderBy(desc(schema.users.createdAt)).limit(5);
  const alerts: string[] = [];
  if (pendingProvisioning) alerts.push(`${pendingProvisioning} account record(s) are awaiting provisioning.`);
  if (pendingRewards) alerts.push(`${pendingRewards} reward request(s) await review.`);
  if (openTickets) alerts.push(`${openTickets} support request(s) are open.`);
  ok(res, { customers, orders, paidOrders: paid, failedOrders: failed, publishedChallenges: published, openTickets, accounts, pendingRewards, recentRegistrations: recent, alerts });
}));

// ───────── challenges ─────────
adminRouter.get('/challenges', P('challenges:manage'), asyncHandler(async (_req, res) => {
  const rows = await db.select().from(schema.challenges).orderBy(asc(schema.challenges.sortOrder));
  ok(res, rows);
}));
adminRouter.get('/challenges/:id', P('challenges:manage'), asyncHandler(async (req, res) => {
  const c = await getAdminChallenge(pid(req.params.id));
  if (!c) throw notFound();
  ok(res, c);
}));
adminRouter.post('/challenges', P('challenges:manage'), asyncHandler(async (req, res) => {
  const input = parse(challengeInputSchema, req.body);
  try { const id = await saveChallenge(null, input, req.auth!.id, clientIp(req)); ok(res, await getAdminChallenge(id), undefined, 201); }
  catch (e: any) { if (e?.code === '23505' || e?.cause?.code === '23505') throw new AppError(409, 'CONFLICT', 'A challenge with this slug already exists.'); throw e; }
}));
adminRouter.put('/challenges/:id', P('challenges:manage'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  if (!(await getAdminChallenge(id))) throw notFound();
  const input = parse(challengeInputSchema, req.body);
  await saveChallenge(id, input, req.auth!.id, clientIp(req));
  ok(res, await getAdminChallenge(id));
}));
adminRouter.post('/challenges/:id/publish', P('challenges:manage'), asyncHandler(async (req, res) => {
  const c = await getAdminChallenge(pid(req.params.id));
  if (!c) throw notFound();
  const problems: string[] = [];
  if (!c.rules) problems.push('Rules are missing.');
  if (!c.sizes.some((s) => s.active && s.price)) problems.push('At least one active, priced account size is required.');
  if (!c.instruments.length) problems.push('At least one forex instrument is required.');
  if (problems.length) throw unprocessable('This challenge is not ready to publish.', problems);
  await db.transaction(async (tx) => {
    await tx.update(schema.challenges).set({ status: 'PUBLISHED' }).where(eq(schema.challenges.id, c.id));
    await audit(tx, { actorId: req.auth!.id, action: 'challenge.published', entityType: 'challenge', entityId: c.id, ip: clientIp(req) });
  });
  ok(res, await getAdminChallenge(c.id));
}));
adminRouter.post('/challenges/:id/unpublish', P('challenges:manage'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  await db.transaction(async (tx) => {
    await tx.update(schema.challenges).set({ status: 'DRAFT' }).where(eq(schema.challenges.id, id));
    await audit(tx, { actorId: req.auth!.id, action: 'challenge.unpublished', entityType: 'challenge', entityId: id, ip: clientIp(req) });
  });
  ok(res, await getAdminChallenge(id));
}));
/** Approving confirms the commercial terms are final (clears the "draft terms" flag). */
adminRouter.post('/challenges/:id/approve', P('challenges:approve'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  await db.transaction(async (tx) => {
    await tx.update(schema.challenges).set({ isDraftTerms: false, approvedAt: new Date(), approvedById: req.auth!.id }).where(eq(schema.challenges.id, id));
    await audit(tx, { actorId: req.auth!.id, action: 'challenge.terms_approved', entityType: 'challenge', entityId: id, ip: clientIp(req) });
  });
  ok(res, await getAdminChallenge(id));
}));

// ───────── customers ─────────
adminRouter.get('/customers', P('customers:read'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const q = like(parse(z.object({ q: z.string().max(100).optional() }), req.query).q);
  const where = q ? or(ilike(schema.users.email, q), ilike(schema.userProfiles.firstName, q), ilike(schema.userProfiles.lastName, q)) : undefined;
  const rows = await db.select({ id: schema.users.id, email: schema.users.email, status: schema.users.status, role: schema.roles.name, verificationStatus: schema.users.verificationStatus,
    emailVerified: schema.users.emailVerifiedAt, createdAt: schema.users.createdAt, firstName: schema.userProfiles.firstName, lastName: schema.userProfiles.lastName })
    .from(schema.users).innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId)).leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
    .where(where).orderBy(desc(schema.users.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ c: count() }).from(schema.users).leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id)).where(where);
  ok(res, rows, { page, pageSize, total: t.c });
}));
adminRouter.get('/customers/:id', P('customers:read'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, id), with: { profile: true, role: true } });
  if (!u) throw notFound();
  const [orders, accounts, tickets] = await Promise.all([
    db.select().from(schema.orders).where(eq(schema.orders.userId, id)).orderBy(desc(schema.orders.createdAt)).limit(50),
    db.select().from(schema.tradingAccounts).where(eq(schema.tradingAccounts.userId, id)).orderBy(desc(schema.tradingAccounts.createdAt)),
    db.select().from(schema.supportTickets).where(eq(schema.supportTickets.userId, id)).orderBy(desc(schema.supportTickets.createdAt)).limit(50),
  ]);
  ok(res, { id: u.id, email: u.email, status: u.status, role: u.role.name, verificationStatus: u.verificationStatus, emailVerified: !!u.emailVerifiedAt, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, profile: u.profile, orders, accounts, tickets });
}));
adminRouter.patch('/customers/:id', P('customers:manage'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  const body = parse(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(), verificationStatus: z.enum(['NOT_STARTED', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional() }), req.body);
  if (id === req.auth!.id && body.status && body.status !== 'ACTIVE') throw unprocessable('You cannot suspend your own account.');
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set(body).where(eq(schema.users.id, id));
    if (body.status && body.status !== 'ACTIVE') await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.userId, id));
    await audit(tx, { actorId: req.auth!.id, action: 'customer.updated', entityType: 'user', entityId: id, detail: body, ip: clientIp(req) });
    if (body.verificationStatus) await notify(tx, id, 'Verification update', `Your verification status is now ${body.verificationStatus.replace('_', ' ').toLowerCase()}.`);
  });
  ok(res, { updated: true });
}));
adminRouter.patch('/customers/:id/role', P('roles:manage'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  const { role } = parse(z.object({ role: z.enum(['customer', 'support', 'admin']) }), req.body);
  if (id === req.auth!.id) throw unprocessable('You cannot change your own role.');
  const r = await db.query.roles.findFirst({ where: eq(schema.roles.name, role) });
  if (!r) throw notFound('Role not found');
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ roleId: r.id }).where(eq(schema.users.id, id));
    await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.userId, id)); // force re-login with new permissions
    await audit(tx, { actorId: req.auth!.id, action: 'admin.role_changed', entityType: 'user', entityId: id, detail: { role }, ip: clientIp(req) });
  });
  ok(res, { updated: true });
}));

// ───────── orders (read-only: payment state can only change via verified webhooks) ─────────
adminRouter.get('/orders', P('orders:read'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const { status } = parse(z.object({ status: z.enum(['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED']).optional() }), req.query);
  const where = status ? eq(schema.orders.status, status) : undefined;
  const rows = await db.select({ id: schema.orders.id, orderNumber: schema.orders.orderNumber, status: schema.orders.status, total: schema.orders.total, currency: schema.orders.currency, createdAt: schema.orders.createdAt, email: schema.users.email })
    .from(schema.orders).innerJoin(schema.users, eq(schema.users.id, schema.orders.userId)).where(where).orderBy(desc(schema.orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ c: count() }).from(schema.orders).where(where);
  ok(res, rows, { page, pageSize, total: t.c });
}));
adminRouter.get('/orders/:id', P('orders:read'), asyncHandler(async (req, res) => {
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, pid(req.params.id)), with: { items: true, events: { orderBy: asc(schema.orderEvents.createdAt) }, attempts: true, user: true } });
  if (!o) throw notFound();
  ok(res, { ...o, user: { id: o.user.id, email: o.user.email } });
}));

// ───────── support ─────────
adminRouter.get('/tickets', P('support:manage'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const f = parse(z.object({ q: z.string().max(100).optional(), status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional() }), req.query);
  const l = like(f.q);
  const where = and(f.status ? eq(schema.supportTickets.status, f.status) : undefined, l ? or(ilike(schema.supportTickets.subject, l), ilike(schema.supportTickets.email, l), ilike(schema.supportTickets.ticketNo, l)) : undefined);
  const rows = await db.select().from(schema.supportTickets).where(where).orderBy(desc(schema.supportTickets.updatedAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ c: count() }).from(schema.supportTickets).where(where);
  ok(res, rows, { page, pageSize, total: t.c });
}));
adminRouter.get('/tickets/:id', P('support:manage'), asyncHandler(async (req, res) => {
  const t = await db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.id, pid(req.params.id)), with: { messages: { orderBy: asc(schema.supportMessages.createdAt) } } });
  if (!t) throw notFound();
  ok(res, t);
}));
adminRouter.post('/tickets/:id/messages', P('support:manage'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  const { body, internal } = parse(z.object({ body: z.string().trim().min(1).max(4000), internal: z.boolean().default(false) }), req.body);
  const t = await db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.id, id) });
  if (!t) throw notFound();
  await db.transaction(async (tx) => {
    await tx.insert(schema.supportMessages).values({ ticketId: id, authorId: req.auth!.id, body, isStaff: true, isInternal: internal });
    if (!internal) {
      await tx.update(schema.supportTickets).set({ status: 'PENDING' }).where(eq(schema.supportTickets.id, id));
      if (t.userId) await notify(tx, t.userId, 'Support replied', `There is a new reply on ${t.ticketNo}.`);
    }
  });
  ok(res, { sent: true }, undefined, 201);
}));
adminRouter.patch('/tickets/:id', P('support:manage'), asyncHandler(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']) }), req.body);
  await db.update(schema.supportTickets).set({ status }).where(eq(schema.supportTickets.id, pid(req.params.id)));
  ok(res, { updated: true });
}));

// ───────── rewards ─────────
const TRANSITIONS: Record<string, string[]> = { PENDING: ['APPROVED', 'REJECTED'], APPROVED: ['PROCESSED', 'REJECTED'], REJECTED: [], PROCESSED: [] };
adminRouter.get('/rewards', P('rewards:review'), asyncHandler(async (_req, res) => {
  const rows = await db.select({ id: schema.rewardRequests.id, amount: schema.rewardRequests.amount, status: schema.rewardRequests.status, createdAt: schema.rewardRequests.createdAt, reviewerNote: schema.rewardRequests.reviewerNote,
    transferRef: schema.rewardRequests.transferRef, email: schema.users.email, accountRef: schema.tradingAccounts.accountRef })
    .from(schema.rewardRequests).innerJoin(schema.users, eq(schema.users.id, schema.rewardRequests.userId)).innerJoin(schema.tradingAccounts, eq(schema.tradingAccounts.id, schema.rewardRequests.accountId))
    .orderBy(desc(schema.rewardRequests.createdAt)).limit(200);
  ok(res, rows);
}));
/** PROCESSED is an internal workflow state. It does not mean funds moved unless a payout integration set transferRef. */
adminRouter.post('/rewards/:id/review', P('rewards:review'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  const body = parse(z.object({ decision: z.enum(['APPROVED', 'REJECTED', 'PROCESSED']), note: z.string().max(500).optional() }), req.body);
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(schema.rewardRequests).where(eq(schema.rewardRequests.id, id)).for('update');
    if (!r) throw notFound();
    if (!TRANSITIONS[r.status].includes(body.decision)) throw new AppError(409, 'CONFLICT', `Cannot move a ${r.status} request to ${body.decision}.`);
    await tx.update(schema.rewardRequests).set({ status: body.decision, reviewerNote: body.note ?? null, reviewedById: req.auth!.id, reviewedAt: new Date() }).where(eq(schema.rewardRequests.id, id));
    await audit(tx, { actorId: req.auth!.id, action: `reward.${body.decision.toLowerCase()}`, entityType: 'reward', entityId: id, detail: { amount: r.amount, note: body.note }, ip: clientIp(req) });
    await notify(tx, r.userId, 'Reward request update', `Your reward request of ${r.amount} is now ${body.decision.toLowerCase()}.`);
  });
  ok(res, { updated: true });
}));

// ───────── accounts ─────────
adminRouter.get('/accounts', P('accounts:manage'), asyncHandler(async (_req, res) => {
  const rows = await db.select({ id: schema.tradingAccounts.id, accountRef: schema.tradingAccounts.accountRef, status: schema.tradingAccounts.status, phase: schema.tradingAccounts.phase, startingBalance: schema.tradingAccounts.startingBalance, createdAt: schema.tradingAccounts.createdAt, email: schema.users.email })
    .from(schema.tradingAccounts).innerJoin(schema.users, eq(schema.users.id, schema.tradingAccounts.userId)).orderBy(desc(schema.tradingAccounts.createdAt)).limit(200);
  ok(res, rows);
}));
adminRouter.patch('/accounts/:id', P('accounts:manage'), asyncHandler(async (req, res) => {
  const id = pid(req.params.id);
  const body = parse(z.object({ status: z.enum(['PENDING_PROVISIONING', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'CLOSED']).optional(), phase: z.enum(['PHASE_1', 'PHASE_2', 'PHASE_3', 'VERIFICATION', 'FUNDED_SIM']).optional(), note: z.string().max(300).optional() }), req.body);
  await db.transaction(async (tx) => {
    const [a] = await tx.select().from(schema.tradingAccounts).where(eq(schema.tradingAccounts.id, id)).for('update');
    if (!a) throw notFound();
    const next = { status: body.status ?? a.status, phase: body.phase ?? a.phase };
    await tx.update(schema.tradingAccounts).set(next).where(eq(schema.tradingAccounts.id, id));
    await tx.insert(schema.accountPhaseHistory).values({ accountId: id, ...next, note: body.note ?? 'Updated by administrator' });
    await audit(tx, { actorId: req.auth!.id, action: 'account.updated', entityType: 'account', entityId: id, detail: { from: { status: a.status, phase: a.phase }, to: next }, ip: clientIp(req) });
    await notify(tx, a.userId, 'Account update', `Account ${a.accountRef} is now ${next.status.replace('_', ' ').toLowerCase()} (${next.phase.replace('_', ' ').toLowerCase()}).`);
  });
  ok(res, { updated: true });
}));

// ───────── audit & site settings ─────────
adminRouter.get('/audit', P('audit:read'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const rows = await db.select({ id: schema.auditLogs.id, action: schema.auditLogs.action, entityType: schema.auditLogs.entityType, entityId: schema.auditLogs.entityId, detail: schema.auditLogs.detail, createdAt: schema.auditLogs.createdAt, actor: schema.users.email })
    .from(schema.auditLogs).leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId)).orderBy(desc(schema.auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ c: count() }).from(schema.auditLogs);
  ok(res, rows, { page, pageSize, total: t.c });
}));
adminRouter.put('/site/show-draft-offers', P('site:manage'), asyncHandler(async (req, res) => {
  const { value } = parse(z.object({ value: z.boolean() }), req.body);
  await db.transaction(async (tx) => {
    await tx.insert(schema.siteConfig).values({ key: 'showDraftOffers', value }).onConflictDoUpdate({ target: schema.siteConfig.key, set: { value } });
    await audit(tx, { actorId: req.auth!.id, action: 'site.show_draft_offers', entityType: 'site', detail: { value }, ip: clientIp(req) });
  });
  ok(res, { value });
}));
export { sql };

// ───────── legal documents (versioned; the newest version is what customers see and accept) ─────────
adminRouter.get('/legal', P('site:manage'), asyncHandler(async (_req, res) => {
  const docs = await db.query.legalDocuments.findMany({ with: { versions: { orderBy: desc(schema.legalVersions.version), limit: 1 } }, orderBy: asc(schema.legalDocuments.title) });
  ok(res, docs.map((d) => ({ slug: d.slug, title: d.title, version: d.versions[0]?.version ?? 0, status: d.versions[0]?.status ?? 'DRAFT', body: d.versions[0]?.body ?? '', updatedAt: d.versions[0]?.createdAt })));
}));
adminRouter.put('/legal/:slug', P('site:manage'), asyncHandler(async (req, res) => {
  const body = parse(z.object({ body: z.string().trim().min(20).max(100_000), status: z.enum(['DRAFT', 'PUBLISHED']) }), req.body);
  const doc = await db.query.legalDocuments.findFirst({ where: eq(schema.legalDocuments.slug, String(req.params.slug)), with: { versions: { orderBy: desc(schema.legalVersions.version), limit: 1 } } });
  if (!doc) throw notFound('Document not found');
  const version = (doc.versions[0]?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(schema.legalVersions).values({ documentId: doc.id, version, body: body.body, status: body.status });
    await audit(tx, { actorId: req.auth!.id, action: 'legal.version_published', entityType: 'legal', entityId: doc.slug, detail: { version, status: body.status }, ip: clientIp(req) });
  });
  ok(res, { slug: doc.slug, version, status: body.status });
}));
