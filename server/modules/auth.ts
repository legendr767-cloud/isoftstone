import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, gt, isNull, lt, ne } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getEnv } from '../config/env.js';
import { asyncHandler, clientIp, ok, parse } from '../lib/http.js';
import { AppError, conflict, unauthorized } from '../lib/errors.js';
import { hashPassword, randomToken, sha256, verifyPassword } from '../lib/security.js';
import { clearAuthCookies, createSession, csrfCookieName, requireAuth, setCsrfCookie } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { sendMail } from '../services/mailer.js';
import { audit } from '../services/audit.js';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number');

const registerSchema = z.object({
  email: emailSchema, password: passwordSchema,
  firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60),
  country: z.string().trim().length(2).toUpperCase().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Conditions' }) }),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;
let dummyHash: Promise<string> | undefined;

async function issueToken(table: 'verify' | 'reset', userId: string, ttlMs: number) {
  const token = randomToken(32);
  const values = { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) };
  if (table === 'verify') await db.insert(schema.emailVerificationTokens).values(values);
  else await db.insert(schema.passwordResetTokens).values(values);
  return token;
}

async function userPayload(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId), with: { profile: true, role: true } });
  if (!u) return null;
  return {
    id: u.id, email: u.email, role: u.role.name, status: u.status, emailVerified: !!u.emailVerifiedAt,
    verificationStatus: u.verificationStatus, createdAt: u.createdAt,
    profile: u.profile ? { firstName: u.profile.firstName, lastName: u.profile.lastName, country: u.profile.country, phone: u.profile.phone } : null,
  };
}

authRouter.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const body = parse(registerSchema, req.body);
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  if (existing) throw conflict('An account with this email may already exist. Try signing in or resetting your password.');
  const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'customer') });
  if (!role) throw new AppError(503, 'NOT_SEEDED', 'Platform is not initialised. Run the database seed.');
  const passwordHash = await hashPassword(body.password);

  const user = await db.transaction(async (tx) => {
    const [u] = await tx.insert(schema.users).values({ email: body.email, passwordHash, roleId: role.id }).returning();
    await tx.insert(schema.userProfiles).values({ userId: u.id, firstName: body.firstName, lastName: body.lastName, country: body.country });
    const terms = await tx.query.legalDocuments.findFirst({ where: eq(schema.legalDocuments.slug, 'terms'), with: { versions: { orderBy: desc(schema.legalVersions.version), limit: 1 } } });
    if (terms?.versions[0]) await tx.insert(schema.legalAcceptances).values({ userId: u.id, versionId: terms.versions[0].id, ip: clientIp(req) });
    await audit(tx, { actorId: u.id, action: 'user.registered', entityType: 'user', entityId: u.id, ip: clientIp(req) });
    return u;
  });

  const token = await issueToken('verify', user.id, 24 * 3600_000);
  await sendMail({ to: user.email, subject: 'Verify your iSoftStone email', text: `Welcome to iSoftStone. Verify your email: ${getEnv().APP_URL}/verify-email?token=${token}` });
  await createSession(res, user.id, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
  ok(res, await userPayload(user.id), undefined, 201);
}));

authRouter.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  const generic = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  if (!user) {
    dummyHash ??= hashPassword('not-a-real-password-1');
    await verifyPassword(await dummyHash, body.password); // equalise timing
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in a few minutes.');
  const valid = await verifyPassword(user.passwordHash, body.password);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db.update(schema.users).set({ failedLoginCount: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS) : null }).where(eq(schema.users.id, user.id));
    throw generic;
  }
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is not active. Contact support.');
  await db.update(schema.users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession(res, user.id, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
  // housekeeping: purge long-expired sessions and spent tokens (cheap, indexed)
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  void Promise.all([
    db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, cutoff)),
    db.delete(schema.emailVerificationTokens).where(lt(schema.emailVerificationTokens.expiresAt, cutoff)),
    db.delete(schema.passwordResetTokens).where(lt(schema.passwordResetTokens.expiresAt, cutoff)),
  ]).catch(() => undefined);
  ok(res, await userPayload(user.id));
}));


authRouter.post('/logout', asyncHandler(async (req, res) => {
  if (req.auth) await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, req.auth.sessionId));
  clearAuthCookies(res);
  ok(res, { loggedOut: true });
}));

authRouter.get('/me', asyncHandler(async (req, res) => {
  if (!req.auth) return ok(res, null);
  if (!req.cookies?.[csrfCookieName()]) setCsrfCookie(res);
  const payload = await userPayload(req.auth.id);
  ok(res, payload && { ...payload, permissions: [...req.auth.permissions] });
}));

authRouter.post('/verify-email', authLimiter, asyncHandler(async (req, res) => {
  const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  const row = await db.query.emailVerificationTokens.findFirst({
    where: and(eq(schema.emailVerificationTokens.tokenHash, sha256(token)), isNull(schema.emailVerificationTokens.consumedAt), gt(schema.emailVerificationTokens.expiresAt, new Date())),
  });
  if (!row) throw new AppError(400, 'INVALID_TOKEN', 'This verification link is invalid or has expired.');
  await db.transaction(async (tx) => {
    await tx.update(schema.emailVerificationTokens).set({ consumedAt: new Date() }).where(eq(schema.emailVerificationTokens.id, row.id));
    await tx.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, row.userId));
  });
  ok(res, { verified: true });
}));

authRouter.post('/resend-verification', authLimiter, requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth!.emailVerified) {
    const token = await issueToken('verify', req.auth!.id, 24 * 3600_000);
    await sendMail({ to: req.auth!.email, subject: 'Verify your iSoftStone email', text: `Verify your email: ${getEnv().APP_URL}/verify-email?token=${token}` });
  }
  ok(res, { sent: true });
}));

authRouter.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const { email } = parse(z.object({ email: emailSchema }), req.body);
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (user && user.status === 'ACTIVE') {
    const token = await issueToken('reset', user.id, 3600_000);
    await sendMail({ to: user.email, subject: 'Reset your iSoftStone password', text: `Reset your password (valid 1 hour): ${getEnv().APP_URL}/reset-password?token=${token}` });
  }
  ok(res, { message: 'If an account exists for that email, a reset link has been sent.' }); // no account enumeration
}));

authRouter.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(10).max(200), password: passwordSchema }), req.body);
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(eq(schema.passwordResetTokens.tokenHash, sha256(token)), isNull(schema.passwordResetTokens.consumedAt), gt(schema.passwordResetTokens.expiresAt, new Date())),
  });
  if (!row) throw new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired.');
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(schema.passwordResetTokens).set({ consumedAt: new Date() }).where(eq(schema.passwordResetTokens.id, row.id));
    await tx.update(schema.users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null }).where(eq(schema.users.id, row.userId));
    await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.userId, row.userId), isNull(schema.sessions.revokedAt)));
    await audit(tx, { actorId: row.userId, action: 'user.password_reset', entityType: 'user', entityId: row.userId, ip: clientIp(req) });
  });
  ok(res, { reset: true });
}));

authRouter.post('/change-password', authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = parse(z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }), req.body);
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.auth!.id) });
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) throw unauthorized('Current password is incorrect');
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id));
    await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, req.auth!.sessionId), isNull(schema.sessions.revokedAt)));
    await audit(tx, { actorId: user.id, action: 'user.password_changed', entityType: 'user', entityId: user.id, ip: clientIp(req) });
  });
  ok(res, { changed: true });
}));
