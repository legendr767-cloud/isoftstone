/**
 * Forex-only enforcement. Used by admin validation and (via a DB CHECK) by the schema.
 * iSoftStone offers forex ONLY — futures, indices, commodities, equities and crypto are out of scope.
 */
export const FX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'] as const;
export const FOREX_SYMBOL_RE = /^[A-Z]{3}\/[A-Z]{3}$/;

export function isForexSymbol(symbol: string): boolean {
  if (!FOREX_SYMBOL_RE.test(symbol)) return false;
  const [base, quote] = symbol.split('/');
  return base !== quote && (FX_CURRENCIES as readonly string[]).includes(base) && (FX_CURRENCIES as readonly string[]).includes(quote);
}

const FORBIDDEN_TERMS = /\b(futures?|cme|cbot|nymex|comex|e-?mini|micro\s*e-?mini|nasdaq\s*100|s&p\s*500|crude\s*oil|bitcoin|crypto(currenc(y|ies))?|equities|stocks?)\b/i;

/** Returns the offending term if marketing/product text references an unsupported market. */
export function findUnsupportedMarketTerm(...texts: Array<string | null | undefined>): string | null {
  for (const t of texts) {
    const m = t ? FORBIDDEN_TERMS.exec(t) : null;
    if (m) return m[0];
  }
  return null;
}
