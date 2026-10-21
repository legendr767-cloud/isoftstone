import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';

// Argon2id with OWASP-aligned parameters (19 MiB, 2 iterations, 1 lane).
const ARGON_OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, ARGON_OPTS);
export async function verifyPassword(hashed: string, pw: string): Promise<boolean> {
  try { return await verify(hashed, pw); } catch { return false; }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
export const hmacSha256 = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');
