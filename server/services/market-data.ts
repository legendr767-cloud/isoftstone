import { isForexSymbol } from './forex.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Real market data for charts. Source: Frankfurter, which republishes the European Central Bank's euro foreign
 * exchange reference rates (daily, working days, ~16:00 CET). No API key. These are REFERENCE rates for information;
 * they are not tradable quotes and are not the prices used by any trading account.
 * The provider is isolated so an intraday vendor (Twelve Data, OANDA, …) can replace it without touching routes.
 */
export const MARKET_SOURCE = { name: 'European Central Bank reference rates via Frankfurter', url: 'https://frankfurter.dev', frequency: 'Daily (working days)' } as const;
export const SNAPSHOT_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD'] as const;
export const RANGES = { '1M': 31, '3M': 92, '6M': 183, '1Y': 366 } as const;
export type RangeKey = keyof typeof RANGES;

export interface RatePoint { date: string; rate: number }
const HOSTS = ['https://api.frankfurter.dev/v1', 'https://api.frankfurter.app'];
const TTL_MS = 15 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

export function assertPair(pair: string): [string, string] {
  if (!isForexSymbol(pair)) throw new AppError(400, 'BAD_REQUEST', 'Unsupported pair. Only approved forex pairs are available.');
  return pair.split('/') as [string, string];
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function getJson(path: string): Promise<any> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  logger.warn({ err: lastErr, path }, 'market data upstream failed');
  throw new AppError(503, 'MARKET_DATA_UNAVAILABLE', 'Market data is temporarily unavailable. Please try again shortly.');
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value as T; // serve last good data if the upstream is down
    throw e;
  }
}

export async function getHistory(pair: string, range: RangeKey) {
  const [base, quote] = assertPair(pair);
  return cached(`h:${pair}:${range}`, async () => {
    const end = new Date(); const start = new Date(end.getTime() - RANGES[range] * 86_400_000);
    const json = await getJson(`/${iso(start)}..${iso(end)}?base=${base}&symbols=${quote}`);
    const points: RatePoint[] = Object.entries(json.rates as Record<string, Record<string, number>>)
      .map(([date, r]) => ({ date, rate: r[quote] })).filter((p) => typeof p.rate === 'number').sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) throw new AppError(503, 'MARKET_DATA_UNAVAILABLE', 'No market data was returned for this period.');
    return { pair, range, points: thin(points, 260), source: MARKET_SOURCE, asOf: points[points.length - 1].date };
  });
}

/** keep payloads small for long ranges while preserving first/last points */
function thin(points: RatePoint[], max: number): RatePoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out = Array.from({ length: max }, (_, i) => points[Math.floor(i * step)]);
  out[out.length - 1] = points[points.length - 1];
  return out;
}

export async function getSnapshot(pairs: readonly string[] = SNAPSHOT_PAIRS) {
  const items = await Promise.all(pairs.map(async (pair) => {
    try {
      const h = await getHistory(pair, '1M');
      const pts = h.points; const last = pts[pts.length - 1]; const prev = pts[pts.length - 2] ?? last;
      const change = last.rate - prev.rate;
      return { pair, rate: last.rate, previous: prev.rate, change, changePct: prev.rate ? (change / prev.rate) * 100 : 0, asOf: last.date, spark: pts.slice(-30).map((p) => p.rate) };
    } catch { return null; }
  }));
  const rows = items.filter((x): x is NonNullable<typeof x> => x !== null);
  if (rows.length === 0) throw new AppError(503, 'MARKET_DATA_UNAVAILABLE', 'Market data is temporarily unavailable. Please try again shortly.');
  return { items: rows, source: MARKET_SOURCE };
}

export function _clearMarketCache() { cache.clear(); }
