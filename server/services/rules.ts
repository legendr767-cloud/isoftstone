import { addMoney, cmpMoney, fromCents, pctOfMoney, subMoney, toCents, maxMoney } from '../lib/money.js';

export interface RuleSet {
  dailyDrawdownPct: string;
  maxDrawdownPct: string;
  profitSplitPct: string;
  rewardMinAmount: string;
}
export interface MetricInput {
  startingBalance: string;
  balance: string;
  equity: string;
  dailyLoss: string; // positive number = loss taken today
  tradingDays: number;
}
export interface StageInput { profitTargetPct: string; minTradingDays: number }

export interface AccountStatusView {
  profit: string;
  profitPct: string;
  targetAmount: string | null;
  targetProgressPct: number | null;
  dailyLimit: string;
  dailyRemaining: string;
  maxLimit: string;
  maxRemaining: string;
  tradingDays: number;
  minTradingDays: number | null;
  dailyBreached: boolean;
  maxBreached: boolean;
  targetReached: boolean;
}

/** Percent with 2dp as string, computed in integer arithmetic. */
function pctString(numCents: bigint, denCents: bigint): string {
  if (denCents === 0n) return '0.00';
  const bp = (numCents * 10000n) / denCents; // basis points (truncated toward zero)
  return fromCents(bp);
}

export function computeAccountStatus(m: MetricInput, rule: RuleSet, stage?: StageInput | null): AccountStatusView {
  const profit = subMoney(m.balance, m.startingBalance);
  const dailyLimit = pctOfMoney(m.startingBalance, rule.dailyDrawdownPct);
  const maxLimit = pctOfMoney(m.startingBalance, rule.maxDrawdownPct);
  const dailyRemaining = maxMoney('0.00', subMoney(dailyLimit, m.dailyLoss));
  // overall drawdown measured on equity against the starting balance floor
  const floor = subMoney(m.startingBalance, maxLimit);
  const maxRemaining = maxMoney('0.00', subMoney(m.equity, floor));
  const targetAmount = stage ? pctOfMoney(m.startingBalance, stage.profitTargetPct) : null;
  let progress: number | null = null;
  if (targetAmount && toCents(targetAmount) > 0n) {
    const p = (toCents(profit) * 10000n) / toCents(targetAmount);
    progress = Math.max(0, Math.min(100, Number(p) / 100));
  }
  return {
    profit,
    profitPct: pctString(toCents(profit), toCents(m.startingBalance)),
    targetAmount,
    targetProgressPct: progress,
    dailyLimit, dailyRemaining, maxLimit, maxRemaining,
    tradingDays: m.tradingDays,
    minTradingDays: stage?.minTradingDays ?? null,
    dailyBreached: cmpMoney(m.dailyLoss, dailyLimit) >= 0 && toCents(dailyLimit) > 0n,
    maxBreached: cmpMoney(m.equity, floor) <= 0,
    targetReached: targetAmount ? cmpMoney(profit, targetAmount) >= 0 : false,
  };
}

export interface RewardInput {
  accountStatus: string;
  accountPhase: string;
  userVerification: string;
  metricSource: 'PROVIDER' | 'DEMO_FIXTURE' | null;
  startingBalance: string;
  balance: string;
  rule: RuleSet;
  openRequests: number; // PENDING or APPROVED (not yet processed)
  allowDemoData: boolean;
}
export interface RewardEligibility { eligible: boolean; availableAmount: string; reasons: string[] }

/** Server-side eligibility. The browser never decides this. */
export function evaluateRewardEligibility(i: RewardInput): RewardEligibility {
  const reasons: string[] = [];
  if (i.accountStatus !== 'ACTIVE') reasons.push('The account must be active.');
  if (i.accountPhase !== 'FUNDED_SIM') reasons.push('Rewards are available only on simulated funded accounts.');
  if (i.userVerification !== 'APPROVED') reasons.push('Identity verification must be approved.');
  if (!i.metricSource) reasons.push('No verified account metrics are available yet.');
  else if (i.metricSource === 'DEMO_FIXTURE' && !i.allowDemoData) reasons.push('Only provider-verified metrics can be used for rewards.');
  if (i.openRequests > 0) reasons.push('A previous reward request is still being reviewed.');
  const profit = subMoney(i.balance, i.startingBalance);
  const share = toCents(profit) > 0n ? pctOfMoney(profit, i.rule.profitSplitPct) : '0.00';
  if (toCents(share) <= 0n) reasons.push('There is no eligible profit to request.');
  else if (cmpMoney(share, i.rule.rewardMinAmount) < 0) reasons.push(`The minimum reward request is ${i.rule.rewardMinAmount}.`);
  return { eligible: reasons.length === 0, availableAmount: share, reasons };
}

export { addMoney };
