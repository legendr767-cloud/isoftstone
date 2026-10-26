import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { getEnv } from '../config/env.js';

const g = globalThis as unknown as { __isoftPool?: pg.Pool };

function createPool() {
  const { DATABASE_URL: url, DATABASE_CA: ca } = getEnv();
  return new pg.Pool({
    connectionString: url,
    // With DATABASE_CA set, the server certificate is fully verified. Otherwise the URL's sslmode applies.
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    max: 5, // small pool: serverless-friendly
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export const pool = g.__isoftPool ?? (g.__isoftPool = createPool());
export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export { schema };
