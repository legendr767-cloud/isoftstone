import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../server/app.js';
import { db, schema } from '../../server/db/index.js';
import { hashPassword } from '../../server/lib/security.js';

export const app = createApp();
export const PASSWORD = 'Str0ng-Passw0rd!';
export const uniq = () => Math.random().toString(36).slice(2, 10);

/** supertest agent that keeps cookies and automatically sends the CSRF header like the SPA does. */
export function client() {
  const agent = request.agent(app);
  let csrf = '';
  const capture = (res: request.Response) => {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    const c = raw?.find((x) => x.startsWith('isoft_csrf='));
    if (c) csrf = c.split(';')[0].split('=')[1];
    return res;
  };
  const wrap = (m: 'post' | 'put' | 'patch' | 'delete') => (url: string, body?: object) =>
    agent[m](`/api/v1${url}`).set('Origin', 'http://localhost:5173').set('X-CSRF-Token', csrf).send(body ?? {}).then(capture);
  return {
    get: (url: string) => agent.get(`/api/v1${url}`).then(capture),
    post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete'),
    postNoCsrf: (url: string, body?: object) => agent.post(`/api/v1${url}`).set('Origin', 'http://localhost:5173').send(body ?? {}).then(capture),
  };
}

export async function registerUser(email = `u_${uniq()}@test.dev`) {
  const c = client();
  const res = await c.post('/auth/register', { email, password: PASSWORD, firstName: 'Test', lastName: 'Trader', country: 'GB', acceptTerms: true });
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`);
  return { c, email, id: res.body.data.id as string };
}

export async function createAdmin(roleName: 'admin' | 'support' = 'admin') {
  const email = `${roleName}_${uniq()}@test.dev`;
  const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, roleName) });
  const [u] = await db.insert(schema.users).values({ email, passwordHash: await hashPassword(PASSWORD), roleId: role!.id, emailVerifiedAt: new Date() }).returning();
  await db.insert(schema.userProfiles).values({ userId: u.id, firstName: 'Staff', lastName: roleName });
  const c = client();
  const res = await c.post('/auth/login', { email, password: PASSWORD });
  if (res.status !== 200) throw new Error('admin login failed');
  return { c, email, id: u.id };
}

export async function firstProduct() {
  const list = (await client().get('/challenges')).body.data as Array<{ slug: string; sizes: Array<{ productId: string; price: string; accountSize: string }> }>;
  const ch = list.find((x) => x.slug === 'one-step-forex')!;
  return { challenge: ch, product: ch.sizes[0] };
}

/** Buys a product through the simulator pipeline; returns the order id. */
export async function purchase(c: ReturnType<typeof client>, productId: string) {
  const o = await c.post('/orders', { items: [{ productId }], acceptTerms: true });
  if (o.status !== 201) throw new Error(`order failed ${o.status} ${JSON.stringify(o.body)}`);
  const pay = await c.post(`/orders/${o.body.data.id}/pay`);
  const done = await c.post(`/payments/simulator/${pay.body.data.attemptId}/complete`, { outcome: 'success' });
  return { orderId: o.body.data.id as string, attemptId: pay.body.data.attemptId as string, status: done.body.data.orderStatus as string };
}
