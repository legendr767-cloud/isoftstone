import { execSync } from 'node:child_process';
import pg from 'pg';

/** Rebuilds the isolated test database from migrations + base seed. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://isoft:isoft_dev_pw@localhost:5432/isoftstone_test';
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await pool.end();
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx tsx scripts/migrate.ts', { env, stdio: 'pipe' });
  execSync('npx tsx scripts/seed.ts', { env: { ...env, SEED_DEMO: 'true' }, stdio: 'pipe' });
}
