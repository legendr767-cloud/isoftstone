/**
 * Idempotent seed: roles, permissions, forex instruments, FAQ, legal documents, add-ons and the forex challenge
 * catalogue (existing challenges are never overwritten, so administrator edits survive redeploys).
 * No customers, orders, payments, testimonials or payout history are ever seeded.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import * as s from '../server/db/schema.js';
import { ADDONS, CHALLENGES, FAQ, INSTRUMENTS, LEGAL, PERMISSIONS, ROLES } from './seed-data.js';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, max: 1, ...(process.env.DATABASE_CA ? { ssl: { ca: process.env.DATABASE_CA, rejectUnauthorized: true } } : {}) });
const db = drizzle(pool, { schema: s });

await db.transaction(async (tx) => {
  for (const key of PERMISSIONS) await tx.insert(s.permissions).values({ key }).onConflictDoNothing();
  for (const [name, perms] of Object.entries(ROLES)) {
    await tx.insert(s.roles).values({ name }).onConflictDoNothing();
    const [role] = await tx.select().from(s.roles).where(eq(s.roles.name, name));
    for (const key of perms) {
      const [p] = await tx.select().from(s.permissions).where(eq(s.permissions.key, key));
      await tx.insert(s.rolePermissions).values({ roleId: role.id, permissionId: p.id }).onConflictDoNothing();
    }
  }
  for (const sym of INSTRUMENTS) {
    const [base, quote] = sym.split('/');
    await tx.insert(s.instruments).values({ symbol: sym, baseCcy: base, quoteCcy: quote }).onConflictDoNothing();
  }
  const faqCount = await tx.select({ c: sql<number>`count(*)::int` }).from(s.faqItems);
  if (faqCount[0].c === 0) await tx.insert(s.faqItems).values(FAQ.map(([category, question, answer], i) => ({ category, question, answer, sortOrder: i })));
  for (const [slug, title, body] of LEGAL) {
    await tx.insert(s.legalDocuments).values({ slug, title }).onConflictDoNothing();
    const [doc] = await tx.select().from(s.legalDocuments).where(eq(s.legalDocuments.slug, slug));
    await tx.insert(s.legalVersions).values({ documentId: doc.id, version: 1, body, status: 'DRAFT' }).onConflictDoNothing();
  }
  await tx.insert(s.siteConfig).values({ key: 'showDraftOffers', value: false }).onConflictDoNothing();

  const allInstruments = await tx.select().from(s.instruments);
  for (const a of ADDONS) await tx.insert(s.productAddons).values(a).onConflictDoNothing();
  for (const c of CHALLENGES) {
    const exists = await tx.query.challenges.findFirst({ where: eq(s.challenges.slug, c.slug) });
    if (exists) continue; // never overwrite terms an administrator may have edited
    const [ch] = await tx.insert(s.challenges).values({ slug: c.slug, name: c.name, model: c.model, tagline: c.tagline, description: c.description, sortOrder: c.sortOrder,
      status: 'PUBLISHED', isDraftTerms: false, approvedAt: new Date() }).returning();
    await tx.insert(s.challengeStages).values(c.stages.map((st, i) => ({ challengeId: ch.id, stageNumber: i + 1, ...st })));
    await tx.insert(s.challengeRules).values({ challengeId: ch.id, ...c.rules });
    await tx.insert(s.challengeInstruments).values(allInstruments.map((i) => ({ challengeId: ch.id, instrumentId: i.id })));
    for (const [i, [size, price]] of c.sizes.entries()) {
      const [opt] = await tx.insert(s.accountSizeOptions).values({ challengeId: ch.id, accountSize: size.toFixed(2), sortOrder: i }).returning();
      await tx.insert(s.products).values({ challengeId: ch.id, sizeOptionId: opt.id, sku: `${c.slug}-${size}`.toUpperCase(), priceAmount: price.toFixed(2) });
    }
  }
});
await pool.end();
console.log('✔ seed complete');
