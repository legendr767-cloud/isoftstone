import { describe, expect, it } from 'vitest';
import { handler } from '../../netlify/functions/api';

/** Exercises the Netlify Function wrapper with Lambda-style events, as Netlify delivers them. */
type Res = { statusCode: number; body: string; headers?: Record<string, string>; multiValueHeaders?: Record<string, string[]> };
const call = (event: Record<string, unknown>) => (handler as unknown as (e: unknown, c: unknown) => Promise<Res>)(
  { headers: {}, multiValueHeaders: {}, queryStringParameters: null, isBase64Encoded: false, body: null, ...event }, {});

describe('Netlify function wrapper', () => {
  it.each(['/api/v1/health', '/.netlify/functions/api/v1/health'])('serves the API at %s', async (path) => {
    const r = await call({ httpMethod: 'GET', path });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).data.status).toBe('ok');
  });
  it('passes JSON bodies, query strings and returns Set-Cookie headers', async () => {
    const q = await call({ httpMethod: 'GET', path: '/api/v1/challenges', queryStringParameters: { model: 'THREE_STEP' } });
    expect(JSON.parse(q.body).data).toHaveLength(1);
    const email = `nf_${Math.random().toString(36).slice(2, 8)}@test.dev`;
    const r = await call({ httpMethod: 'POST', path: '/api/v1/auth/register', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email, password: 'Str0ng-Passw0rd!', firstName: 'N', lastName: 'F', acceptTerms: true }) });
    expect(r.statusCode).toBe(201);
    const cookies = ([] as string[]).concat(r.multiValueHeaders?.['set-cookie'] ?? r.headers?.['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('isoft_session=') && /HttpOnly/i.test(c))).toBe(true);
  });
  it('returns JSON 404s for unknown API routes', async () => {
    const r = await call({ httpMethod: 'GET', path: '/api/v1/nope' });
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body).error.code).toBe('NOT_FOUND');
  });
});
