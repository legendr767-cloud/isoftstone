import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const anyErr = err as { type?: string; status?: number };
  if (anyErr?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  if (anyErr?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body too large' } });
  logger.error({ err, path: req.path, method: req.method }, 'unhandled error');
  const message = isProd() ? 'Something went wrong' : (err as Error)?.message ?? 'Internal error';
  res.status(500).json({ error: { code: 'INTERNAL', message } });
}
