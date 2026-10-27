export interface Size { id: string; accountSize: string; currency: string; active: boolean; productId: string | null; sku: string | null; price: string | null }
export interface Stage { stageNumber: number; name: string; profitTargetPct: string; minTradingDays: number; maxDays: number | null }
export interface Rules {
  dailyDrawdownPct: string; maxDrawdownPct: string; drawdownMethod: 'BALANCE_BASED' | 'EQUITY_BASED' | 'TRAILING'; leverage: string; profitSplitPct: string;
  newsTradingAllowed: boolean; weekendHoldingAllowed: boolean; overnightHoldingAllowed: boolean; eaAllowed: boolean; copyTradingAllowed: boolean; rewardMinAmount: string; notes: string | null;
}
export interface Challenge {
  id: string; slug: string; name: string; model: 'ONE_STEP' | 'TWO_STEP' | 'THREE_STEP'; tagline: string; description: string; status: string; isDraftTerms: boolean;
  stages: Stage[]; rules: Rules | null; sizes: Size[]; instruments: string[];
}
export interface User {
  id: string; email: string; role: string; status: string; emailVerified: boolean; verificationStatus: string; permissions?: string[];
  profile: { firstName: string; lastName: string; country: string | null; phone: string | null } | null;
}
export interface SiteInfo {
  brand: string; supportEmail: string; showDraftOffers: boolean; payments: { configured: boolean; mode: string };
  tradingData: { connected: boolean; demo: boolean }; emailDelivery: boolean;
}
export interface StatusView {
  profit: string; profitPct: string; targetAmount: string | null; targetProgressPct: number | null; dailyLimit: string; dailyRemaining: string;
  maxLimit: string; maxRemaining: string; tradingDays: number; minTradingDays: number | null; dailyBreached: boolean; maxBreached: boolean; targetReached: boolean;
}
export interface AccountSummary {
  id: string; accountRef: string; status: string; phase: string; startingBalance: string; currency: string; createdAt: string;
  challenge: { name: string; slug: string; model: string };
  rules: { dailyDrawdownPct: string; maxDrawdownPct: string; profitSplitPct: string; leverage: string; drawdownMethod: string } | null;
  stage: { stageNumber: number; name: string; profitTargetPct: string; minTradingDays: number } | null;
  providerConnected: boolean;
  metrics: { balance: string; equity: string; dailyLoss: string; tradingDays: number; source: 'PROVIDER' | 'DEMO_FIXTURE'; capturedAt: string } | null;
  status_view: StatusView | null;
}
