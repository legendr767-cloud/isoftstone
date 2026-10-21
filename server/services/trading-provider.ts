import { getEnv } from '../config/env.js';

export interface ProviderMetrics { balance: string; equity: string; dailyLoss: string; tradingDays: number }
export interface ProviderTrade {
  symbol: string; side: 'BUY' | 'SELL'; volume: string; openPrice: string; closePrice: string | null;
  profit: string | null; openedAt: Date; closedAt: Date | null;
}

/**
 * Abstraction for the real trading platform / broker / account-management system.
 * No provider is connected by default. `none` returns null so the UI can say "not connected".
 */
export interface TradingProvider {
  readonly name: 'none' | 'demo';
  readonly isDemo: boolean;
  getMetrics(account: { accountRef: string; startingBalance: string }): Promise<ProviderMetrics | null>;
  getTrades(account: { accountRef: string; startingBalance: string }): Promise<ProviderTrade[]>;
}

class NullProvider implements TradingProvider {
  name = 'none' as const; isDemo = false;
  async getMetrics() { return null; }
  async getTrades() { return []; }
}

/** Deterministic demonstration fixtures. Development only — refused by env validation in production. */
class DemoProvider implements TradingProvider {
  name = 'demo' as const; isDemo = true;
  private seed(ref: string) { let h = 0; for (const c of ref) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  async getMetrics(a: { accountRef: string; startingBalance: string }): Promise<ProviderMetrics> {
    const s = this.seed(a.accountRef);
    const start = Number(a.startingBalance);
    const pctGain = ((s % 700) - 100) / 100; // -1.00% .. +6.00%
    const balance = (start * (1 + pctGain / 100)).toFixed(2);
    const equity = (Number(balance) - (s % 300)).toFixed(2);
    return { balance, equity, dailyLoss: String((s % 150)), tradingDays: 1 + (s % 9) };
  }
  async getTrades(a: { accountRef: string; startingBalance: string }): Promise<ProviderTrade[]> {
    const s = this.seed(a.accountRef);
    const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'];
    return Array.from({ length: 5 }, (_, i) => {
      const opened = new Date(Date.now() - (i + 1) * 3600_000 * 7);
      const pnl = (((s >> i) % 400) - 120).toFixed(2);
      return { symbol: pairs[(s + i) % pairs.length], side: (i % 2 ? 'SELL' : 'BUY') as 'BUY' | 'SELL', volume: '0.50',
        openPrice: '1.08450', closePrice: '1.08720', profit: pnl, openedAt: opened, closedAt: new Date(opened.getTime() + 3600_000) };
    });
  }
}

export function getTradingProvider(): TradingProvider {
  return getEnv().TRADING_PROVIDER === 'demo' ? new DemoProvider() : new NullProvider();
}
