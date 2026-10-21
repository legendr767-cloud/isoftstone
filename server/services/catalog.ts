import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getEnv } from '../config/env.js';
import { d2 } from '../lib/money.js';
import { simulatorEnabled } from './payments.js';
import { getTradingProvider } from './trading-provider.js';

export async function getShowDraftOffers(): Promise<boolean> {
  const row = await db.query.siteConfig.findFirst({ where: eq(schema.siteConfig.key, 'showDraftOffers') });
  return row?.value === true;
}

const withAll = {
  stages: { orderBy: asc(schema.challengeStages.stageNumber) },
  rules: true,
  sizes: { orderBy: asc(schema.accountSizeOptions.sortOrder), with: { product: true } },
  instruments: { with: { instrument: true } },
} as const;

type FullChallenge = NonNullable<Awaited<ReturnType<typeof loadChallenge>>>;
async function loadChallenge(where: ReturnType<typeof and>) {
  return db.query.challenges.findFirst({ where, with: withAll });
}

export function toChallengeDto(c: FullChallenge, opts: { admin?: boolean } = {}) {
  return {
    id: c.id, slug: c.slug, name: c.name, model: c.model, tagline: c.tagline, description: c.description,
    status: c.status, isDraftTerms: c.isDraftTerms, approvedAt: c.approvedAt,
    stages: c.stages.map((s) => ({ stageNumber: s.stageNumber, name: s.name, profitTargetPct: d2(s.profitTargetPct), minTradingDays: s.minTradingDays, maxDays: s.maxDays })),
    rules: c.rules && {
      dailyDrawdownPct: d2(c.rules.dailyDrawdownPct), maxDrawdownPct: d2(c.rules.maxDrawdownPct), drawdownMethod: c.rules.drawdownMethod,
      leverage: c.rules.leverage, profitSplitPct: d2(c.rules.profitSplitPct), newsTradingAllowed: c.rules.newsTradingAllowed,
      weekendHoldingAllowed: c.rules.weekendHoldingAllowed, overnightHoldingAllowed: c.rules.overnightHoldingAllowed,
      eaAllowed: c.rules.eaAllowed, copyTradingAllowed: c.rules.copyTradingAllowed, rewardMinAmount: d2(c.rules.rewardMinAmount), notes: c.rules.notes,
    },
    sizes: c.sizes.filter((s) => opts.admin || (s.active && s.product?.active)).map((s) => ({
      id: s.id, accountSize: d2(s.accountSize), currency: s.currency, active: s.active,
      productId: s.product?.id ?? null, sku: s.product?.sku ?? null, price: d2(s.product?.priceAmount),
    })),
    instruments: c.instruments.map((i) => i.instrument.symbol).sort(),
  };
}

export async function listPublicChallenges() {
  const draftOk = await getShowDraftOffers();
  const rows = await db.query.challenges.findMany({
    where: and(eq(schema.challenges.status, 'PUBLISHED'), draftOk ? undefined : isNotNull(schema.challenges.approvedAt)),
    orderBy: asc(schema.challenges.sortOrder), with: withAll,
  });
  return rows.map((r) => toChallengeDto(r));
}

export async function getPublicChallenge(slug: string) {
  const draftOk = await getShowDraftOffers();
  const row = await loadChallenge(and(eq(schema.challenges.slug, slug), eq(schema.challenges.status, 'PUBLISHED'), draftOk ? undefined : isNotNull(schema.challenges.approvedAt)));
  return row ? toChallengeDto(row) : null;
}

export async function getAdminChallenge(id: string) {
  const row = await loadChallenge(eq(schema.challenges.id, id));
  return row ? toChallengeDto(row, { admin: true }) : null;
}

export async function siteInfo() {
  const env = getEnv();
  return {
    brand: 'iSoftStone', supportEmail: env.SUPPORT_EMAIL,
    showDraftOffers: await getShowDraftOffers(),
    payments: { configured: simulatorEnabled(), mode: simulatorEnabled() ? 'simulator' : 'unconfigured' },
    tradingData: { connected: getTradingProvider().name !== 'none', demo: getTradingProvider().isDemo },
    emailDelivery: env.EMAIL_PROVIDER !== 'none',
  };
}
