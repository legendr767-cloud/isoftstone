export const money = (v: string | number | null | undefined, currency = 'USD', fractionDigits?: number) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: fractionDigits ?? (Number.isInteger(n) ? 0 : 2), maximumFractionDigits: fractionDigits ?? 2 }).format(n);
};
export const compactMoney = (v: string | number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));
export const pct = (v: string | number | null | undefined) => (v === null || v === undefined ? '—' : `${Number(v)}%`);
export const date = (v: string | Date | null | undefined) => (v ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(v)) : '—');
export const dateTime = (v: string | Date | null | undefined) => (v ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—');
export const label = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const modelLabel = (m: string) => ({ ONE_STEP: 'One-step', TWO_STEP: 'Two-step', INSTANT: 'Instant' } as Record<string, string>)[m] ?? m;
export const drawdownLabel = (m: string) => ({ BALANCE_BASED: 'Balance-based', EQUITY_BASED: 'Equity-based', TRAILING: 'Trailing' } as Record<string, string>)[m] ?? m;
