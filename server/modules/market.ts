import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, parse } from '../lib/http.js';
import { RANGES, SNAPSHOT_PAIRS, getHistory, getSnapshot, type RangeKey } from '../services/market-data.js';

export const marketRouter = Router();
// Public, non-personalised data: safe for shared CDN caching.
const cdn = (res: import('express').Response) => res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600');

marketRouter.get('/market/pairs', (_req, res) => { cdn(res); ok(res, SNAPSHOT_PAIRS); });
marketRouter.get('/market/snapshot', asyncHandler(async (_req, res) => { const d = await getSnapshot(); cdn(res); ok(res, d); }));
marketRouter.get('/market/history', asyncHandler(async (req, res) => {
  const q = parse(z.object({ pair: z.string().max(7), range: z.enum(Object.keys(RANGES) as [RangeKey, ...RangeKey[]]).default('3M') }), req.query);
  const d = await getHistory(q.pair, q.range);
  cdn(res); ok(res, d);
}));
