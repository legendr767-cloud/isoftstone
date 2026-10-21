import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { isProd } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/security.js';

export const SESSION_TTL_MS = 7 * 24 * 3600_000;
export const sessionCookieName = () => (isProd() ? '__Host-isoft_session' : 'isoft_session');
export const csrfCookieName = () => (isProd() ? '__Host-isoft_csrf' : 'isoft_csrf');

export interface AuthUser {
  id: string; email: string; role: string; permissions: Set<string>;
  emailVerified: boolean; verificationStatus: string; sessionId: string;
}
declare module 'express-serve-static-core' {
  interface Request { auth?: AuthUser }
}

const cookieBase = () => ({ secure: isProd(), sameSite: 'lax' as const, path: '/' });

export async function createSession(res: Response, userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = randomToken(32);
  await db.insert(schema.sessions).values({
    userId, tokenHash: sha256(token), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(sessionCookieName(), token, { ...cookieBase(), httpOnly: true, maxAge: SESSION_TTL_MS });
  setCsrfCookie(res);
}
export function setCsrfCookie(res: Response) {
  res.cookie(csrfCookieName(), randomToken(24), { ...cookieBase(), httpOnly: false, maxAge: SESSION_TTL_MS });
}
export function clearAuthCookies(res: Response) {
  res.clearCookie(sessionCookieName(), cookieBase());
  res.clearCookie(csrfCookieName(), cookieBase());
}

/** Loads the session (if any) from the opaque cookie. Authorization is always re-checked server-side. */
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[sessionCookieName()] as string | undefined;
    if (!token) return next();
    const rows = await db.select({
      sid: schema.sessions.id, uid: schema.users.id, email: schema.users.email, status: schema.users.status,
      verified: schema.users.emailVerifiedAt, vstatus: schema.users.verificationStatus, roleId: schema.users.roleId, roleName: schema.roles.name,
    }).from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
      .where(and(eq(schema.sessions.tokenHash, sha256(token)), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row || row.status !== 'ACTIVE') return next();
    const perms = await db.select({ key: schema.permissions.key }).from(schema.rolePermissions)
      .innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
      .where(eq(schema.rolePermissions.roleId, row.roleId));
    req.auth = {
      id: row.uid, email: row.email, role: row.roleName, permissions: new Set(perms.map((p) => p.key)),
      emailVerified: !!row.verified, verificationStatus: row.vstatus, sessionId: row.sid,
    };
    next();
  } catch (e) { next(e); }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}
export const requirePermission = (...keys: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(unauthorized());
  if (!keys.every((k) => req.auth!.permissions.has(k))) return next(forbidden());
  next();
};
