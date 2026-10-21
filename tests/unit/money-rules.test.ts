import { describe, expect, it } from 'vitest';
import { addMoney, cmpMoney, fromCents, pctOfMoney, subMoney, toCents } from '../../server/lib/money';
import { computeAccountStatus, evaluateRewardEligibility } from '../../server/services/rules';
import { findUnsupportedMarketTerm, isForexSymbol } from '../../server/services/forex';
import { signPayload, verifySignature } from '../../server/services/payments';

describe('decimal-safe money', () => {
  it('never drifts like floating point', () => {
    expect(addMoney('0.10', '0.20')).toBe('0.30'); // 0.1+0.2 !== 0.3 in floats
    expect(subMoney('100.00', '33.33')).toBe('66.67');
  });
  it('computes percentages with half-up rounding', () => {
    expect(pctOfMoney('100000.00', '8.00')).toBe('8000.00');
    expect(pctOfMoney('99.99', '33.33')).toBe('33.33');
    expect(pctOfMoney('0.05', '50.00')).toBe('0.03');
  });
  it('round-trips cents and handles negatives', () => {
    expect(fromCents(toCents('-12.30'))).toBe('-12.30');
    expect(cmpMoney('10.00', '10.00')).toBe(0);
    expect(() => toCents('abc')).toThrow();
  });
});

describe('account rule engine', () => {
  const rule = { dailyDrawdownPct: '5.00', maxDrawdownPct: '10.00', profitSplitPct: '80.00', rewardMinAmount: '50.00' };
  const stage = { profitTargetPct: '8.00', minTradingDays: 4 };
  it('computes target progress and remaining drawdown', () => {
    const v = computeAccountStatus({ startingBalance: '100000.00', balance: '104000.00', equity: '103500.00', dailyLoss: '1000.00', tradingDays: 3 }, rule, stage);
    expect(v.profit).toBe('4000.00');
    expect(v.targetAmount).toBe('8000.00');
    expect(v.targetProgressPct).toBe(50);
    expect(v.dailyRemaining).toBe('4000.00');
    expect(v.maxRemaining).toBe('13500.00'); // equity above the 90,000 floor
    expect(v.targetReached).toBe(false);
    expect(v.dailyBreached || v.maxBreached).toBe(false);
  });
  it('flags breaches', () => {
    const d = computeAccountStatus({ startingBalance: '10000.00', balance: '9400.00', equity: '9400.00', dailyLoss: '600.00', tradingDays: 1 }, rule, stage);
    expect(d.dailyBreached).toBe(true);
    const m = computeAccountStatus({ startingBalance: '10000.00', balance: '8900.00', equity: '8900.00', dailyLoss: '0.00', tradingDays: 1 }, rule, stage);
    expect(m.maxBreached).toBe(true);
    expect(m.maxRemaining).toBe('0.00');
  });
});

describe('reward eligibility (server-side)', () => {
  const base = { accountStatus: 'ACTIVE', accountPhase: 'FUNDED_SIM', userVerification: 'APPROVED', metricSource: 'PROVIDER' as const, startingBalance: '10000.00', balance: '11000.00',
    rule: { dailyDrawdownPct: '5', maxDrawdownPct: '10', profitSplitPct: '80.00', rewardMinAmount: '50.00' }, openRequests: 0, allowDemoData: false };
  it('allows an eligible request and applies the profit split', () => {
    const r = evaluateRewardEligibility(base);
    expect(r.eligible).toBe(true);
    expect(r.availableAmount).toBe('800.00');
  });
  it.each([
    ['unverified user', { userVerification: 'NOT_STARTED' }],
    ['evaluation account', { accountPhase: 'PHASE_1' }],
    ['inactive account', { accountStatus: 'BREACHED' }],
    ['demo data in production', { metricSource: 'DEMO_FIXTURE' as const }],
    ['open request', { openRequests: 1 }],
    ['no profit', { balance: '10000.00' }],
    ['below minimum', { balance: '10050.00' }],
    ['no metrics', { metricSource: null }],
  ])('rejects: %s', (_n, patch) => {
    expect(evaluateRewardEligibility({ ...base, ...patch }).eligible).toBe(false);
  });
});

describe('forex-only guard', () => {
  it('accepts approved forex pairs only', () => {
    for (const s of ['EUR/USD', 'GBP/JPY', 'AUD/CAD']) expect(isForexSymbol(s)).toBe(true);
    for (const s of ['ES', 'NQ1!', 'BTC/USD', 'XAU/USD', 'EUR/EUR', 'eur/usd', 'USD/XXX']) expect(isForexSymbol(s)).toBe(false);
  });
  it('blocks futures and other markets in product text', () => {
    expect(findUnsupportedMarketTerm('Elite E-mini Futures Challenge')).toBeTruthy();
    expect(findUnsupportedMarketTerm('CME micro contracts')).toBeTruthy();
    expect(findUnsupportedMarketTerm('Bitcoin plan')).toBeTruthy();
    expect(findUnsupportedMarketTerm('One-Step Forex Evaluation', 'EUR/USD focus')).toBeNull();
  });
});

describe('webhook signatures', () => {
  const secret = 'x'.repeat(40);
  const body = '{"id":"evt_1"}';
  it('verifies a fresh valid signature', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifySignature(body, signPayload(body, t, secret), secret)).toBe(true);
  });
  it('rejects tampering, wrong secret, missing header, and replays', () => {
    const t = Math.floor(Date.now() / 1000);
    const sig = signPayload(body, t, secret);
    expect(verifySignature(body + ' ', sig, secret)).toBe(false);
    expect(verifySignature(body, sig, 'y'.repeat(40))).toBe(false);
    expect(verifySignature(body, undefined, secret)).toBe(false);
    expect(verifySignature(body, signPayload(body, t - 3600, secret), secret)).toBe(false);
  });
});
