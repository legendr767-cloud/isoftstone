import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { app, client, createAdmin, PASSWORD, registerUser, uniq } from './helpers';
import { db, schema } from '../../server/db/index.js';
import * as mailer from '../../server/services/mailer.js';

const sent: Array<{ to: string; text: string }> = [];
beforeEach(() => {
  sent.length = 0;
  vi.spyOn(mailer, 'sendMail').mockImplementation(async (m) => { sent.push(m); return { delivered: false }; });
});

describe('registration & login', () => {
  it('registers, sets secure cookies, returns the user without secrets', async () => {
    const c = client();
    const email = `reg_${uniq()}@test.dev`;
    const res = await c.post('/auth/register', { email, password: PASSWORD, firstName: 'Ada', lastName: 'L', country: 'gb', acceptTerms: true });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.profile.country).toBe('GB');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((x) => x.startsWith('isoft_session='))).toMatch(/HttpOnly/i);
    expect(cookies.find((x) => x.startsWith('isoft_session='))).toMatch(/SameSite=Lax/i);
    const me = await c.get('/auth/me');
    expect(me.body.data.email).toBe(email);
    expect(me.body.data.role).toBe('customer');
  });

  it('stores an Argon2id hash and records terms acceptance', async () => {
    const { email, id } = await registerUser();
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    expect(u!.passwordHash.startsWith('$argon2id$')).toBe(true);
    const acc = await db.select().from(schema.legalAcceptances).where(eq(schema.legalAcceptances.userId, id));
    expect(acc.length).toBe(1);
  });

  it.each([
    ['weak password', { password: 'short1' }],
    ['no digit', { password: 'onlyletterspassword' }],
    ['bad email', { email: 'nope' }],
    ['terms not accepted', { acceptTerms: false }],
  ])('rejects %s', async (_n, patch) => {
    const res = await client().post('/auth/register', { email: `x_${uniq()}@test.dev`, password: PASSWORD, firstName: 'A', lastName: 'B', acceptTerms: true, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects duplicate registration', async () => {
    const { email } = await registerUser();
    const res = await client().post('/auth/register', { email, password: PASSWORD, firstName: 'A', lastName: 'B', acceptTerms: true });
    expect(res.status).toBe(409);
  });

  it('logs in with the right password and rejects the wrong one generically', async () => {
    const { email } = await registerUser();
    expect((await client().post('/auth/login', { email, password: PASSWORD })).status).toBe(200);
    const bad = await client().post('/auth/login', { email, password: 'Wrong-Passw0rd' });
    const ghost = await client().post('/auth/login', { email: `ghost_${uniq()}@test.dev`, password: 'Wrong-Passw0rd' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe(ghost.body.error.message); // no account enumeration
  });

  it('locks the account after repeated failures (DB-backed, survives across instances)', async () => {
    const { email } = await registerUser();
    for (let i = 0; i < 5; i++) await client().post('/auth/login', { email, password: 'Wrong-Passw0rd' });
    const res = await client().post('/auth/login', { email, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('logout revokes the session server-side', async () => {
    const { c } = await registerUser();
    expect((await c.post('/auth/logout')).status).toBe(200);
    expect((await c.get('/auth/me')).body.data).toBeNull();
  });
});

describe('email verification & password reset', () => {
  it('verifies email with a single-use token', async () => {
    const { email, c } = await registerUser();
    const token = sent.find((m) => m.to === email)!.text.match(/token=([\w-]+)/)![1];
    expect((await client().post('/auth/verify-email', { token })).status).toBe(200);
    expect((await c.get('/auth/me')).body.data.emailVerified).toBe(true);
    expect((await client().post('/auth/verify-email', { token })).status).toBe(400); // consumed
  });

  it('resets the password, revokes old sessions, and never reveals whether an email exists', async () => {
    const { email, c } = await registerUser();
    const unknown = await client().post('/auth/forgot-password', { email: `nobody_${uniq()}@test.dev` });
    const known = await client().post('/auth/forgot-password', { email });
    expect(unknown.body).toEqual(known.body);
    const token = sent.filter((m) => m.to === email).pop()!.text.match(/token=([\w-]+)/)![1];
    expect((await client().post('/auth/reset-password', { token, password: 'Brand-New-Pass1' })).status).toBe(200);
    expect((await c.get('/auth/me')).body.data).toBeNull(); // old session revoked
    expect((await client().post('/auth/login', { email, password: 'Brand-New-Pass1' })).status).toBe(200);
    expect((await client().post('/auth/reset-password', { token, password: 'Another-Pass12' })).status).toBe(400);
  });
});

describe('CSRF & private caching', () => {
  it('blocks state-changing requests that carry a session but no CSRF token', async () => {
    const { c } = await registerUser();
    const res = await c.postNoCsrf('/me/tickets', { subject: 'Hello there', message: 'This is a long enough message.' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN');
  });
  it('blocks cross-origin state changes', async () => {
    const res = await (await import('supertest')).default(app).post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
  });
  it('marks authenticated responses as no-store', async () => {
    const { c } = await registerUser();
    const res = await c.get('/me/dashboard');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('authorization', () => {
  it('requires auth for private routes and admin permission for admin routes', async () => {
    expect((await client().get('/me/accounts')).status).toBe(401);
    expect((await client().get('/admin/overview')).status).toBe(401);
    const { c } = await registerUser();
    expect((await c.get('/admin/overview')).status).toBe(403);
    expect((await c.get('/admin/customers')).status).toBe(403);
  });
  it('lets staff in according to role permissions only', async () => {
    const support = await createAdmin('support');
    expect((await support.c.get('/admin/overview')).status).toBe(200);
    expect((await support.c.get('/admin/audit')).status).toBe(403); // support lacks audit:read
    expect((await support.c.post('/admin/challenges', {})).status).toBe(403);
    const admin = await createAdmin('admin');
    expect((await admin.c.get('/admin/audit')).status).toBe(200);
  });
  it('does not leak stack traces or internals in errors', async () => {
    const res = await client().get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts|stack/i);
  });
});
