/**
 * Decimal-safe money helpers. All arithmetic is done on integer cents (BigInt),
 * never on floating-point numbers.
 */
/** Normalise a NUMERIC value to a fixed 2-decimal string. Drizzle relational queries return nested numerics as JSON numbers. */
export function d2(v: string | number): string;
export function d2(v: string | number | null | undefined): string | null;
export function d2(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === 'number' ? v.toFixed(2) : v;
}

export function toCents(value: string | number): bigint {
  const s = typeof value === 'number' ? value.toFixed(2) : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid money value: ${s}`);
  const neg = s.startsWith('-');
  const [whole, frac = ''] = s.replace('-', '').split('.');
  const cents = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
  const round = frac.length > 2 && Number(frac[2]) >= 5 ? 1n : 0n; // round half up
  return neg ? -(cents + round) : cents + round;
}
export function fromCents(c: bigint): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const s = `${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}
export const addMoney = (a: string | number, b: string | number) => fromCents(toCents(a) + toCents(b));
export const subMoney = (a: string | number, b: string | number) => fromCents(toCents(a) - toCents(b));
export const cmpMoney = (a: string | number, b: string | number) => { const d = toCents(a) - toCents(b); return d === 0n ? 0 : d > 0n ? 1 : -1; };
/** percentage (e.g. "80" or "7.5") of an amount, rounded half-up to cents */
export function pctOfMoney(amount: string | number, pct: string | number): string {
  const [pw, pf = ''] = d2(pct).split('.');
  const basis = BigInt(pw) * 100n + BigInt((pf + '00').slice(0, 2)); // basis points
  const num = toCents(amount) * basis;
  const den = 10000n;
  const q = num / den;
  const r = num % den;
  const rounded = (r < 0n ? -r : r) * 2n >= den ? (num < 0n ? q - 1n : q + 1n) : q;
  return fromCents(rounded);
}
export const maxMoney = (a: string, b: string) => (cmpMoney(a, b) >= 0 ? a : b);
export const minMoney = (a: string, b: string) => (cmpMoney(a, b) <= 0 ? a : b);
