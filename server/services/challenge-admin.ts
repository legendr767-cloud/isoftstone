import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema, type Tx } from '../db/index.js';
import { unprocessable } from '../lib/errors.js';
import { findUnsupportedMarketTerm, isForexSymbol } from './forex.js';
import { audit } from './audit.js';

const pctStr = z.coerce.number().gt(0).max(100).transform((n) => n.toFixed(2));
const moneyStr = z.coerce.number().gt(0).max(100_000_000).transform((n) => n.toFixed(2));

export const challengeInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  name: z.string().trim().min(3).max(80),
  model: z.enum(['ONE_STEP', 'TWO_STEP', 'THREE_STEP']), // instant funding is intentionally not offered
  tagline: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  stages: z.array(z.object({ name: z.string().trim().min(1).max(60), profitTargetPct: pctStr, minTradingDays: z.number().int().min(0).max(60).default(0), maxDays: z.number().int().min(1).max(365).nullable().default(null) })).max(3),
  rules: z.object({
    dailyDrawdownPct: pctStr, maxDrawdownPct: pctStr, drawdownMethod: z.enum(['BALANCE_BASED', 'EQUITY_BASED', 'TRAILING']),
    leverage: z.string().regex(/^1:\d{1,4}$/), profitSplitPct: pctStr,
    newsTradingAllowed: z.boolean(), weekendHoldingAllowed: z.boolean(), overnightHoldingAllowed: z.boolean(),
    eaAllowed: z.boolean(), copyTradingAllowed: z.boolean(), rewardMinAmount: moneyStr.default(50), notes: z.string().max(1000).nullable().default(null),
  }),
  sizes: z.array(z.object({ accountSize: moneyStr, price: moneyStr, active: z.boolean().default(true) })).min(1).max(12),
  instruments: z.array(z.string()).min(1).max(40),
});
export type ChallengeInput = z.infer<typeof challengeInputSchema>;

const EXPECTED_STAGES = { ONE_STEP: 1, TWO_STEP: 2, THREE_STEP: 3 } as const;

/** Business-rule validation (server-side, independent of any UI). */
export async function validateChallenge(input: ChallengeInput) {
  const bad = findUnsupportedMarketTerm(input.slug, input.name, input.tagline, input.description, input.rules.notes);
  if (bad) throw unprocessable(`"${bad}" is not supported. iSoftStone offers forex products only.`);
  if (input.stages.length !== EXPECTED_STAGES[input.model]) throw unprocessable(`A ${input.model} challenge requires exactly ${EXPECTED_STAGES[input.model]} stage(s).`);
  if (Number(input.rules.dailyDrawdownPct) > Number(input.rules.maxDrawdownPct)) throw unprocessable('Daily drawdown cannot exceed maximum drawdown.');
  const sizes = input.sizes.map((s) => s.accountSize);
  if (new Set(sizes).size !== sizes.length) throw unprocessable('Account sizes must be unique.');
  const invalid = input.instruments.filter((s) => !isForexSymbol(s));
  if (invalid.length) throw unprocessable(`Unsupported instruments (forex pairs only): ${invalid.join(', ')}`);
  const found = await db.select().from(schema.instruments).where(and(inArray(schema.instruments.symbol, input.instruments), eq(schema.instruments.active, true)));
  const missing = input.instruments.filter((s) => !found.some((f) => f.symbol === s));
  if (missing.length) throw unprocessable(`Instruments not in the approved list: ${missing.join(', ')}`);
  return found;
}

export async function saveChallenge(id: string | null, input: ChallengeInput, actorId: string, ip?: string) {
  const instruments = await validateChallenge(input);
  return db.transaction(async (tx: Tx) => {
    let challengeId = id;
    if (!id) {
      const [c] = await tx.insert(schema.challenges).values({
        slug: input.slug, name: input.name, model: input.model, tagline: input.tagline, description: input.description, sortOrder: input.sortOrder,
      }).returning();
      challengeId = c.id;
    } else {
      await tx.update(schema.challenges).set({ slug: input.slug, name: input.name, model: input.model, tagline: input.tagline, description: input.description, sortOrder: input.sortOrder, isDraftTerms: true, approvedAt: null, approvedById: null }).where(eq(schema.challenges.id, id));
    }
    const cid = challengeId!;
    await tx.delete(schema.challengeStages).where(eq(schema.challengeStages.challengeId, cid));
    if (input.stages.length) await tx.insert(schema.challengeStages).values(input.stages.map((s, i) => ({ challengeId: cid, stageNumber: i + 1, ...s })));
    const rules = { ...input.rules, challengeId: cid };
    await tx.insert(schema.challengeRules).values(rules).onConflictDoUpdate({ target: schema.challengeRules.challengeId, set: input.rules });
    await tx.delete(schema.challengeInstruments).where(eq(schema.challengeInstruments.challengeId, cid));
    await tx.insert(schema.challengeInstruments).values(instruments.map((i) => ({ challengeId: cid, instrumentId: i.id })));

    const existing = await tx.query.accountSizeOptions.findMany({ where: eq(schema.accountSizeOptions.challengeId, cid), with: { product: true } });
    const priceChanges: unknown[] = [];
    for (const [i, s] of input.sizes.entries()) {
      const prev = existing.find((e) => Number(e.accountSize) === Number(s.accountSize));
      if (prev) {
        await tx.update(schema.accountSizeOptions).set({ active: s.active, sortOrder: i }).where(eq(schema.accountSizeOptions.id, prev.id));
        if (prev.product) {
          if (Number(prev.product.priceAmount) !== Number(s.price)) priceChanges.push({ size: s.accountSize, from: prev.product.priceAmount, to: s.price });
          await tx.update(schema.products).set({ priceAmount: s.price, active: s.active }).where(eq(schema.products.id, prev.product.id));
        }
      } else {
        const [opt] = await tx.insert(schema.accountSizeOptions).values({ challengeId: cid, accountSize: s.accountSize, sortOrder: i, active: s.active }).returning();
        await tx.insert(schema.products).values({ challengeId: cid, sizeOptionId: opt.id, sku: `${input.slug}-${Math.round(Number(s.accountSize))}`.toUpperCase(), priceAmount: s.price, active: s.active });
        priceChanges.push({ size: s.accountSize, from: null, to: s.price });
      }
    }
    // sizes dropped from the form are deactivated, never deleted (orders may reference them)
    for (const e of existing) {
      if (!input.sizes.some((s) => Number(s.accountSize) === Number(e.accountSize))) {
        await tx.update(schema.accountSizeOptions).set({ active: false }).where(eq(schema.accountSizeOptions.id, e.id));
        if (e.product) await tx.update(schema.products).set({ active: false }).where(eq(schema.products.id, e.product.id));
      }
    }
    await audit(tx, { actorId, action: id ? 'challenge.updated' : 'challenge.created', entityType: 'challenge', entityId: cid, ip, detail: { name: input.name, priceChanges, rules: input.rules } });
    return cid;
  });
}
