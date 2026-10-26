import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { getEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { attachSession } from './middleware/auth.js';
import { csrfProtection, globalLimiter } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth.js';
import { publicRouter } from './modules/public.js';
import { customerRouter } from './modules/customer.js';
import { checkoutRouter, webhookRouter } from './modules/checkout.js';
import { adminRouter } from './modules/admin.js';
import { marketRouter } from './modules/market.js';
import { openApiDocument } from './openapi.js';

export function createApp() {
  const env = getEnv();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(pinoHttp({ logger, genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(), autoLogging: env.NODE_ENV !== 'test' }));
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: new URL(env.APP_URL).origin, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'] }));

  const v1 = express.Router();
  v1.use(webhookRouter); // raw-body route must precede the JSON parser
  v1.use(express.json({ limit: '100kb' }));
  v1.use(cookieParser());
  v1.use(globalLimiter);
  v1.use(attachSession);
  v1.use(csrfProtection);

  // Private responses must never be cached by shared caches
  v1.use((req, res, next) => { if (req.method !== 'GET' || req.auth) res.setHeader('Cache-Control', 'no-store'); next(); });

  v1.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  v1.use('/auth', authRouter);
  v1.use('/admin', adminRouter);
  v1.use('/me', customerRouter);
  v1.use('/', marketRouter);
  v1.use('/', publicRouter);
  v1.use('/', checkoutRouter);

  app.use('/api/v1', v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
