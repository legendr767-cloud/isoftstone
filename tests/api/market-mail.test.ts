import { afterEach, describe, expect, it, vi } from 'vitest';
import { client } from './helpers';
import { _clearMarketCache } from '../../server/services/market-data.js';
import { resetEnvCache } from '../../server/config/env.js';
import { sendMail } from '../../server/services/mailer.js';

afterEach(() => { vi.unstubAllGlobals(); _clearMarketCache(); delete process.env.EMAIL_PROVIDER; delete process.env.RESEND_API_KEY; resetEnvCache(); });

describe('market API', () => {
  it('returns real series through the public endpoints with CDN cache headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rates: { '2026-10-20': { USD: 1.1 }, '2026-10-21': { USD: 1.12 } } }), { status: 200 }), ));
    // supertest talks to the in-process app, so only upstream calls are stubbed
    const h = await client().get('/market/history?pair=EUR%2FUSD&range=1M');
    expect(h.status).toBe(200);
    expect(h.body.data.points).toEqual([{ date: '2026-10-20', rate: 1.1 }, { date: '2026-10-21', rate: 1.12 }]);
    expect(h.headers['cache-control']).toMatch(/s-maxage=900/);
    expect(h.body.data.source.name).toMatch(/European Central Bank/);
  });
  it('rejects non-forex pairs and bad ranges', async () => {
    expect((await client().get('/market/history?pair=BTC%2FUSD')).status).toBe(400);
    expect((await client().get('/market/history?pair=EUR%2FUSD&range=10Y')).status).toBe(400);
  });
  it('reports upstream outages as 503 without leaking details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET secret-host'); }));
    const r = await client().get('/market/history?pair=GBP%2FUSD&range=6M');
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toMatch(/ECONNRESET|secret-host/);
  });
});

describe('email delivery', () => {
  it('sends through Resend with the configured key and sender', async () => {
    process.env.EMAIL_PROVIDER = 'resend'; process.env.RESEND_API_KEY = 're_test_123'; resetEnvCache();
    const f = vi.fn(async () => new Response('{}', { status: 200 })); vi.stubGlobal('fetch', f);
    expect(await sendMail({ to: 'a@b.co', subject: 'Hi', text: 'Body' })).toEqual({ delivered: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_123');
    expect(JSON.parse(String(init.body)).to).toEqual(['a@b.co']);
  });
  it('never throws on provider failure', async () => {
    process.env.EMAIL_PROVIDER = 'resend'; process.env.RESEND_API_KEY = 're_test_123'; resetEnvCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    expect(await sendMail({ to: 'a@b.co', subject: 'Hi', text: 'Body' })).toEqual({ delivered: false });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await sendMail({ to: 'a@b.co', subject: 'Hi', text: 'Body' })).toEqual({ delivered: false });
  });
  it('refuses to start with resend but no API key', async () => {
    process.env.EMAIL_PROVIDER = 'resend'; delete process.env.RESEND_API_KEY; resetEnvCache();
    expect(() => sendMail({ to: 'a@b.co', subject: 's', text: 't' })).rejects.toThrow(/RESEND_API_KEY/);
  });
});
