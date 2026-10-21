import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32, 'PAYMENT_WEBHOOK_SECRET must be at least 32 characters'),
  PAYMENT_PROVIDER: z.enum(['none', 'dev_simulator']).default('none'),
  ALLOW_PAYMENT_SIMULATOR: bool,
  TRADING_PROVIDER: z.enum(['none', 'demo']).default('none'),
  EMAIL_PROVIDER: z.enum(['none']).default('none'),
  EMAIL_FROM: z.string().default('iSoftStone <no-reply@example.com>'),
  SUPPORT_EMAIL: z.string().default('support@example.com'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.TRADING_PROVIDER === 'demo') throw new Error('TRADING_PROVIDER=demo is not permitted in production');
    if (env.PAYMENT_PROVIDER === 'dev_simulator' && !env.ALLOW_PAYMENT_SIMULATOR) {
      throw new Error('PAYMENT_PROVIDER=dev_simulator requires ALLOW_PAYMENT_SIMULATOR=true in production (demo deployments only)');
    }
  }
  cached = env;
  return env;
}
export function resetEnvCache() { cached = undefined; }
export const isProd = () => getEnv().NODE_ENV === 'production';
