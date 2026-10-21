import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { csrfCookieName, sessionCookieName } from './auth.js';
import { safeEqual } from '../lib/security.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests:
 *  1. Origin (when present) must match APP_URL.
 *  2. Double-submit token: X-CSRF-Token header must equal the CSRF cookie.
 * Skipped for requests that carry no session cookie (login/register are covered by SameSite=Lax + Origin check).
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  if (req.path.startsWith('/payments/webhook/')) return next(); // authenticated by HMAC signature instead
  const origin = req.headers.origin;
  if (origin) {
    const allowed = new URL(getEnv().APP_URL).origin;
    if (origin !== allowed) return next(new AppError(403, 'CSRF_ORIGIN', 'Cross-origin request blocked'));
  }
  const hasSession = !!req.cookies?.[sessionCookieName()];
  if (hasSession) {
    const cookie = req.cookies?.[csrfCookieName()] as string | undefined;
    const header = req.headers['x-csrf-token'];
    if (!cookie || typeof header !== 'string' || !safeEqual(cookie, header)) {
      return next(new AppError(403, 'CSRF_TOKEN', 'Invalid or missing CSRF token'));
    }
  }
  next();
}

const limiter = (windowMs: number, limit: number, message: string) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  skip: () => getEnv().NODE_ENV === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
});
export const globalLimiter = limiter(15 * 60_000, 600, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60_000, 20, 'Too many attempts. Please try again later.');
export const contactLimiter = limiter(60 * 60_000, 6, 'Too many messages sent. Please try again later.');
export const checkoutLimiter = limiter(10 * 60_000, 30, 'Too many checkout attempts. Please try again later.');
