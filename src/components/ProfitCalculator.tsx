import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { Alert, Card, Input, Select } from '@/components/ui';
import { money } from '@/lib/format';

/** Integer-cent arithmetic so results never carry floating-point drift. */
export function calcProfit(accountSize: number, returnPct: number, splitPct: number) {
  const sizeCents = Math.round(accountSize * 100);
  const retBp = Math.round(returnPct * 100); // basis points
  const splitBp = Math.round(splitPct * 100);
  const gross = Math.round((sizeCents * retBp) / 10000);
  const trader = Math.round((gross * splitBp) / 10000);
  return { gross: gross / 100, trader: trader / 100, firm: (gross - trader) / 100 };
}

const FALLBACK_SIZES = [5000, 10000, 25000, 50000, 100000];

export function ProfitCalculator({ compact = false }: { compact?: boolean }) {
  const { data: challenges } = useQuery({ queryKey: ['challenges'], queryFn: async () => (await api.get<Challenge[]>('/challenges')).data });
  const [slug, setSlug] = useState('');
  const chosen = challenges?.find((c) => c.slug === slug) ?? challenges?.[0];
  const sizes = useMemo(() => (chosen?.sizes.length ? chosen.sizes.map((s) => Number(s.accountSize)).sort((a, b) => a - b) : FALLBACK_SIZES), [chosen]);
  const [size, setSize] = useState<number | null>(null);
  const [ret, setRet] = useState('8');
  const [splitOverride, setSplitOverride] = useState<string | null>(null);
  const activeSize = size && sizes.includes(size) ? size : sizes[Math.min(2, sizes.length - 1)];
  const split = splitOverride ?? (chosen?.rules ? String(Number(chosen.rules.profitSplitPct)) : '80');

  const retN = Number(ret); const splitN = Number(split);
  const retErr = ret === '' || Number.isNaN(retN) || retN < 0 || retN > 100 ? 'Enter a return between 0 and 100' : undefined;
  const splitErr = split === '' || Number.isNaN(splitN) || splitN <= 0 || splitN > 100 ? 'Enter a split between 1 and 100' : undefined;
  const out = !retErr && !splitErr ? calcProfit(activeSize, retN, splitN) : null;

  return (
    <Card className="p-6 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          {challenges && challenges.length > 1 && (
            <Select id="calc-challenge" label="Challenge (sets the default split)" value={chosen?.slug ?? ''} onChange={(e) => { setSlug(e.target.value); setSplitOverride(null); }}>
              {challenges.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
          )}
          <Select id="calc-size" label="Account size" value={activeSize} onChange={(e) => setSize(Number(e.target.value))}>
            {sizes.map((s) => <option key={s} value={s}>{money(s)}</option>)}
          </Select>
          <Input id="calc-return" label="Hypothetical return (%)" type="number" inputMode="decimal" min={0} max={100} step="0.1" value={ret} onChange={(e) => setRet(e.target.value)} error={retErr} />
          <Input id="calc-split" label="Trader profit split (%)" type="number" inputMode="decimal" min={1} max={100} step="1" value={split} onChange={(e) => setSplitOverride(e.target.value)} error={splitErr}
            hint={chosen?.rules ? `Default from "${chosen.name}"${chosen.isDraftTerms ? ' (draft terms)' : ''}` : undefined} />
        </div>
        <div aria-live="polite" className="flex flex-col justify-between rounded-xl border border-line bg-ink-900/60 p-6">
          <div className="space-y-4">
            {[['Hypothetical gross profit', out?.gross], ['Trader share', out?.trader], ['Firm share', out?.firm]].map(([l, v], i) => (
              <div key={String(l)} className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-3 last:border-0">
                <span className="text-sm text-slate-400">{l}</span>
                <span className={i === 1 ? 'font-display text-3xl font-extrabold text-brand-400' : 'font-display text-xl font-bold text-white'}>{out ? money(v as number, 'USD', 2) : '—'}</span>
              </div>
            ))}
          </div>
          <Alert tone="warning" className="mt-6">Hypothetical illustration only. It is not a promise, forecast or guarantee of earnings, and simulated results do not reflect live trading.{!compact && ' Rewards depend on the published rules, verification and review.'}</Alert>
        </div>
      </div>
    </Card>
  );
}
