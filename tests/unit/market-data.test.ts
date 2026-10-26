import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RANGES, _clearMarketCache, assertPair, getHistory, getSnapshot } from '../../server/services/market-data';

const series = (quote: string, n: number, start = 1.08) => ({ base: 'EUR', rates: Object.fromEntries(Array.from({ length: n }, (_, i) => [new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), { [quote]: +(start + i * 0.001).toFixed(4) }])) });
const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => _clearMarketCache());
afterEach(() => vi.unstubAllGlobals());

describe('market data', () => {
  it('validates pairs before any network call (no SSRF / arbitrary upstream paths)', () => {
    expect(assertPair('EUR/USD')).toEqual(['EUR', 'USD']);
    for (const bad of ['../etc/passwd', 'EUR/XYZ', 'BTC/USD', 'ES/NQ', 'EURUSD', 'EUR/USD?x=1']) expect(() => assertPair(bad)).toThrow();
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    return expect(getHistory('BTC/USD', '1M')).rejects.toMatchObject({ status: 400 }).then(() => expect(f).not.toHaveBeenCalled());
  });

  it('parses upstream series into sorted points and caches the result', async () => {
    const f = vi.fn(async () => okJson(series('USD', 20))); vi.stubGlobal('fetch', f);
    const a = await getHistory('EUR/USD', '1M');
    expect(a.points).toHaveLength(20);
    expect(a.points[0].date < a.points[19].date).toBe(true);
    expect(a.asOf).toBe(a.points[19].date);
    expect(String((f.mock.calls as unknown as string[][])[0][0])).toContain('base=EUR&symbols=USD');
    await getHistory('EUR/USD', '1M');
    expect(f).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it('thins long histories but keeps the latest point', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson(series('USD', 400))));
    const h = await getHistory('EUR/USD', '1Y');
    expect(h.points.length).toBeLessThanOrEqual(260);
    expect(h.points[h.points.length - 1].rate).toBe(+(1.08 + 399 * 0.001).toFixed(4));
  });

  it('falls back to the secondary host, then to a clear 503', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(okJson(series('JPY', 5, 150)));
    vi.stubGlobal('fetch', f);
    expect((await getHistory('USD/JPY', '1M')).points).toHaveLength(5);
    expect(String((f.mock.calls as unknown as string[][])[1][0])).toContain('api.frankfurter.app');
    _clearMarketCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    await expect(getHistory('GBP/USD', '1M')).rejects.toMatchObject({ status: 503, code: 'MARKET_DATA_UNAVAILABLE' });
  });

  it('serves the last good data when the upstream later fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson(series('USD', 10))));
    await getHistory('EUR/USD', '3M');
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 60 * 60_000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect((await getHistory('EUR/USD', '3M')).points).toHaveLength(10);
    vi.useRealTimers();
  });

  it('builds a snapshot with change %, and tolerates individual pair failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (String(u).includes('symbols=CHF') ? new Response('x', { status: 500 }) : okJson(series(String(u).match(/symbols=(\w+)/)![1], 30)))));
    const s = await getSnapshot(['EUR/USD', 'USD/CHF', 'GBP/USD']);
    expect(s.items.map((i) => i.pair)).toEqual(['EUR/USD', 'GBP/USD']);
    const e = s.items[0];
    expect(e.change).toBeCloseTo(0.001, 4);
    expect(e.changePct).toBeGreaterThan(0);
    expect(e.spark).toHaveLength(30);
    expect(RANGES['1Y']).toBe(366);
  });
});
