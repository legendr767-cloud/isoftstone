import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { getEnv } from '../config/env.js';

const g = globalThis as unknown as { __isoftPool?: pg.Pool };

function createPool() {
  const url = getEnv().DATABASE_URL;
  return new pg.Pool({
    connectionString: url,
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
