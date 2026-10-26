/** Applies versioned SQL migrations from ./drizzle. Safe to run repeatedly. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }
const ca = process.env.DATABASE_CA;
const pool = new pg.Pool({ connectionString: url, max: 1, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) });
await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
await pool.end();
console.log('✔ migrations applied');
