import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, gt, ilike, or, sql, count } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { asyncHandler, ok, parse } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { randomToken } from '../lib/security.js';
import { contactLimiter } from '../middleware/security.js';
import { getPublicChallenge, listPublicChallenges, siteInfo } from '../services/catalog.js';
import { notify } from '../services/audit.js';
import { sendMail } from '../services/mailer.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export const publicRouter = Router();

publicRouter.get('/health', asyncHandler(async (_req, res) => {
  await db.execute(sql`select 1`);
  ok(res, { status: 'ok', time: new Date().toISOString() });
}));

publicRouter.get('/site', asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  ok(res, await siteInfo());
}));

publicRouter.get('/challenges', asyncHandler(async (req, res) => {
  const q = parse(z.object({
    model: z.enum(['ONE_STEP', 'TWO_STEP', 'INSTANT']).optional(),
    minSize: z.coerce.number().positive().optional(), maxSize: z.coerce.number().positive().optional(),
    sort: z.enum(['order', 'price_asc', 'price_desc', 'size_asc', 'size_desc']).default('order'),
  }), req.query);
  let list = await listPublicChallenges();
  if (q.model) list = list.filter((c) => c.model === q.model);
  if (q.minSize || q.maxSize) {
    list = list.map((c) => ({ ...c, sizes: c.sizes.filter((s) => (!q.minSize || Number(s.accountSize) >= q.minSize) && (!q.maxSize || Number(s.accountSize) <= q.maxSize)) }))
      .filter((c) => c.sizes.length > 0);
  }
  const minPrice = (c: (typeof list)[number]) => Math.min(...c.sizes.map((s) => Number(s.price ?? Infinity)));
  const minSize = (c: (typeof list)[number]) => Math.min(...c.sizes.map((s) => Number(s.accountSize)));
  if (q.sort === 'price_asc') list.sort((a, b) => minPrice(a) - minPrice(b));
  if (q.sort === 'price_desc') list.sort((a, b) => minPrice(b) - minPrice(a));
  if (q.sort === 'size_asc') list.sort((a, b) => minSize(a) - minSize(b));
  if (q.sort === 'size_desc') list.sort((a, b) => minSize(b) - minSize(a));
  res.setHeader('Cache-Control', 'public, max-age=30');
  ok(res, list, { total: list.length });
}));

publicRouter.get('/challenges/:slug', asyncHandler(async (req, res) => {
  const c = await getPublicChallenge(String(req.params.slug));
  if (!c) throw notFound('Challenge not found');
  ok(res, c);
}));

publicRouter.get('/instruments', asyncHandler(async (_req, res) => {
  const rows = await db.select({ symbol: schema.instruments.symbol }).from(schema.instruments).where(eq(schema.instruments.active, true)).orderBy(asc(schema.instruments.symbol));
  ok(res, rows.map((r) => r.symbol));
}));

publicRouter.get('/faq', asyncHandler(async (req, res) => {
  const { q, category } = parse(z.object({ q: z.string().trim().max(100).optional(), category: z.string().max(60).optional() }), req.query);
  const like = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
  const rows = await db.select().from(schema.faqItems).where(and(
    eq(schema.faqItems.published, true),
    category ? eq(schema.faqItems.category, category) : undefined,
    like ? or(ilike(schema.faqItems.question, like), ilike(schema.faqItems.answer, like)) : undefined,
  )).orderBy(asc(schema.faqItems.category), asc(schema.faqItems.sortOrder));
  res.setHeader('Cache-Control', 'public, max-age=60');
  ok(res, rows.map((r) => ({ id: r.id, category: r.category, question: r.question, answer: r.answer })));
}));

publicRouter.get('/legal', asyncHandler(async (_req, res) => {
  const docs = await db.select({ slug: schema.legalDocuments.slug, title: schema.legalDocuments.title }).from(schema.legalDocuments).orderBy(asc(schema.legalDocuments.title));
  ok(res, docs);
}));

publicRouter.get('/legal/:slug', asyncHandler(async (req, res) => {
  const doc = await db.query.legalDocuments.findFirst({
    where: eq(schema.legalDocuments.slug, String(req.params.slug)),
    with: { versions: { orderBy: desc(schema.legalVersions.version), limit: 1 } },
  });
  if (!doc || !doc.versions[0]) throw notFound('Document not found');
  const v = doc.versions[0];
  ok(res, { slug: doc.slug, title: doc.title, version: v.version, status: v.status, body: v.body, updatedAt: v.createdAt });
}));

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).optional(), // honeypot: real users never fill this
});

publicRouter.post('/contact', contactLimiter, asyncHandler(async (req, res) => {
  const body = parse(contactSchema, req.body);
  if (body.website) return ok(res, { ticketNo: 'ISS-T-RECEIVED' }, undefined, 201); // silently drop bots
  // Instance-independent abuse protection: per-email and global ceilings stored in the database.
  const hourAgo = new Date(Date.now() - 3600_000); const minAgo = new Date(Date.now() - 60_000);
  const [[perEmail], [global]] = await Promise.all([
    db.select({ c: count() }).from(schema.supportTickets).where(and(eq(schema.supportTickets.email, body.email), gt(schema.supportTickets.createdAt, hourAgo))),
    db.select({ c: count() }).from(schema.supportTickets).where(gt(schema.supportTickets.createdAt, minAgo)),
  ]);
  if (perEmail.c >= 5 || global.c >= 40) throw new AppError(429, 'RATE_LIMITED', 'Too many requests right now. Please try again later.');
  const ticketNo = `ISS-T-${randomToken(5).toUpperCase().replace(/[-_]/g, 'X')}`;
  await db.transaction(async (tx) => {
    const [t] = await tx.insert(schema.supportTickets).values({
      ticketNo, userId: req.auth?.id ?? null, name: body.name, email: body.email, subject: body.subject,
    }).returning();
    await tx.insert(schema.supportMessages).values({ ticketId: t.id, authorId: req.auth?.id ?? null, body: body.message });
    if (req.auth) await notify(tx, req.auth.id, 'Support request received', `We received your request ${ticketNo}.`);
  });
  if (getEnv().SUPPORT_EMAIL) void sendMail({ to: getEnv().SUPPORT_EMAIL, subject: `[${ticketNo}] ${body.subject}`, text: `New support request from ${body.name} <${body.email}>\n\n${body.message}` });
  ok(res, { ticketNo }, undefined, 201);
}));
