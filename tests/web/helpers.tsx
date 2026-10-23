import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/components/Toast';
import { vi } from 'vitest';

type Routes = Record<string, unknown | ((init: RequestInit | undefined) => { status?: number; body: unknown })>;

/** Mocks fetch for the API client. Keys are "METHOD /path" (without /api/v1). */
export function mockApi(routes: Routes) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace('/api/v1', '').split('?')[0]}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[key];
    if (r === undefined) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: `no mock for ${key}` } }), { status: 404 });
    const out = typeof r === 'function' ? (r as (i: RequestInit | undefined) => { status?: number; body: unknown })(init) : { body: { data: r } };
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200 });
  }));
  return calls;
}

export function renderApp(ui: ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><ToastProvider><AuthProvider>{ui}</AuthProvider></ToastProvider></MemoryRouter></QueryClientProvider></HelmetProvider>,
  );
}
