/**
 * Provision (or promote) an administrator from environment variables.
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-unique-passphrase' npm run admin:create
 * Credentials are never stored in the repository.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as s from '../server/db/schema.js';
import { hashPassword } from '../server/lib/security.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!process.env.DATABASE_URL || !email || !password) { console.error('DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required'); process.exit(1); }
if (password.length < 12) { console.error('ADMIN_PASSWORD must be at least 12 characters'); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const db = drizzle(pool, { schema: s });
const [role] = await db.select().from(s.roles).where(eq(s.roles.name, 'admin'));
if (!role) { console.error('Run `npm run db:seed` first (admin role missing).'); process.exit(1); }
const passwordHash = await hashPassword(password);
const existing = await db.query.users.findFirst({ where: eq(s.users.email, email) });
await db.transaction(async (tx) => {
  let id = existing?.id;
  if (existing) await tx.update(s.users).set({ roleId: role.id, passwordHash, status: 'ACTIVE', emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), failedLoginCount: 0, lockedUntil: null }).where(eq(s.users.id, existing.id));
  else {
    const [u] = await tx.insert(s.users).values({ email, passwordHash, roleId: role.id, emailVerifiedAt: new Date() }).returning();
    id = u.id;
    await tx.insert(s.userProfiles).values({ userId: u.id, firstName: 'Admin', lastName: 'iSoftStone' });
  }
  await tx.insert(s.auditLogs).values({ action: existing ? 'admin.promoted' : 'admin.provisioned', entityType: 'user', entityId: id, detail: { via: 'cli' } });
});
await pool.end();
console.log(`✔ administrator ready: ${email}`);
