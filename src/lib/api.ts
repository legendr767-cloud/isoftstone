export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Array<{ path: string; message: string }> | string[]) {
    super(message);
  }
}

const csrfCookie = () => document.cookie.split('; ').find((c) => c.startsWith('isoft_csrf=') || c.startsWith('__Host-isoft_csrf='))?.split('=')[1] ?? '';

export interface Envelope<T> { data: T; meta?: { page: number; pageSize: number; total: number } & Record<string, unknown> }

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method, credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': decodeURIComponent(csrfCookie()) } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error. Please check your connection and try again.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong', e?.details);
  }
  return json as Envelope<T>;
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b?: unknown, h?: Record<string, string>) => request<T>('POST', p, b ?? {}, h),
  put: <T,>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  patch: <T,>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
};

/** Human-readable message including field-level details when present. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details as Array<{ path?: string; message?: string } | string> | undefined;
    if (d?.length) return `${e.message}: ${d.map((x) => (typeof x === 'string' ? x : `${x.path ? x.path + ' ' : ''}${x.message}`)).join('; ')}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
