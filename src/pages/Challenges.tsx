import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { api, errorText } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { Seo } from '@/components/Seo';
import { Alert, Select, Skeleton, TableWrap, Td, Th, ButtonLink } from '@/components/ui';
import { ChallengeCard, lowestPrice } from '@/components/ChallengeCard';
import { useSite } from '@/hooks/useSite';
import { drawdownLabel, modelLabel, money, pct } from '@/lib/format';

const yes = (v: boolean) => v ? <span className="inline-flex items-center gap-1 text-brand-300"><Check className="h-4 w-4" aria-hidden />Yes</span> : <span className="inline-flex items-center gap-1 text-slate-500"><X className="h-4 w-4" aria-hidden />No</span>;

export default function Challenges() {
  const [params, setParams] = useSearchParams();
  const model = params.get('model') ?? ''; const minSize = params.get('minSize') ?? ''; const sort = params.get('sort') ?? 'order';
  const qs = new URLSearchParams(); if (model) qs.set('model', model); if (minSize) qs.set('minSize', minSize); if (sort !== 'order') qs.set('sort', sort);
  const { data, isLoading, error } = useQuery({ queryKey: ['challenges', qs.toString()], queryFn: async () => (await api.get<Challenge[]>(`/challenges?${qs}`)).data });
  const { data: site } = useSite();
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }); };
  const hasDraft = useMemo(() => data?.some((c) => c.isDraftTerms), [data]);

  return (
    <div className="container py-12 sm:py-16">
      <Seo title="Forex challenges" description="Compare iSoftStone forex evaluation models by account size, price, profit targets and drawdown rules." path="/challenges" />
      <p className="eyebrow">Challenge marketplace</p>
      <h1 className="mt-3 text-4xl font-extrabold">Forex challenges</h1>
      <p className="mt-3 max-w-2xl text-slate-400">Every challenge is forex-only. Filter by model and account size, then compare the rules side by side.</p>
      {(hasDraft || site?.showDraftOffers) && <Alert tone="warning" className="mt-6" title="Draft terms">Values shown are illustrative placeholders pending final iSoftStone approval. They are not final offers.</Alert>}

      <form className="mt-8 grid gap-4 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Filter challenges">
        <Select id="f-model" label="Model" value={model} onChange={(e) => set('model', e.target.value)}>
          <option value="">All models</option><option value="ONE_STEP">One-step</option><option value="TWO_STEP">Two-step</option><option value="INSTANT">Instant</option>
        </Select>
        <Select id="f-size" label="Minimum account size" value={minSize} onChange={(e) => set('minSize', e.target.value)}>
          <option value="">Any size</option>{[5000, 10000, 25000, 50000, 100000].map((s) => <option key={s} value={s}>{money(s)}+</option>)}
        </Select>
        <Select id="f-sort" label="Sort by" value={sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="order">Featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="size_asc">Account size: small to large</option><option value="size_desc">Account size: large to small</option>
        </Select>
      </form>

      {error && <Alert tone="error" className="mt-8">{errorText(error)}</Alert>}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />) : data?.map((c) => <ChallengeCard key={c.id} c={c} />)}
      </div>
      {!isLoading && !error && data?.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line p-12 text-center">
          <p className="font-semibold text-white">No challenges match these filters.</p>
          <p className="mt-1 text-sm text-slate-400">{params.size ? 'Try removing a filter.' : 'Challenges will appear here once their terms are approved and published.'}</p>
          {params.size > 0 && <button className="mt-4 text-sm font-semibold text-brand-400 hover:underline" onClick={() => setParams({})}>Clear filters</button>}
        </div>
      )}

      {data && data.length > 0 && (
        <section className="mt-16" aria-labelledby="compare">
          <h2 id="compare" className="text-2xl font-extrabold">Compare the rules</h2>
          <p className="mt-2 text-sm text-slate-400">The key differences between models: targets, risk limits and trading conditions. Scroll horizontally on small screens.</p>
          <div className="mt-6">
            <TableWrap caption="Challenge rules comparison">
              <thead><tr><Th>Rule</Th>{data.map((c) => <Th key={c.id}><Link className="text-brand-300 hover:underline" to={`/challenges/${c.slug}`}>{c.name}</Link></Th>)}</tr></thead>
              <tbody>
                {([
                  ['Model', (c: Challenge) => modelLabel(c.model)],
                  ['Stages', (c: Challenge) => c.stages.length || 'None (instant)'],
                  ['Profit target', (c: Challenge) => c.stages.length ? c.stages.map((s) => pct(s.profitTargetPct)).join(' → ') : '—'],
                  ['Minimum trading days', (c: Challenge) => c.stages.length ? c.stages.map((s) => s.minTradingDays).join(' / ') : '—'],
                  ['Daily drawdown', (c: Challenge) => pct(c.rules?.dailyDrawdownPct)],
                  ['Max drawdown', (c: Challenge) => pct(c.rules?.maxDrawdownPct)],
                  ['Drawdown method', (c: Challenge) => c.rules ? drawdownLabel(c.rules.drawdownMethod) : '—'],
                  ['Leverage', (c: Challenge) => c.rules?.leverage ?? '—'],
                  ['Profit split', (c: Challenge) => pct(c.rules?.profitSplitPct)],
                  ['News trading', (c: Challenge) => c.rules ? yes(c.rules.newsTradingAllowed) : '—'],
                  ['Weekend holding', (c: Challenge) => c.rules ? yes(c.rules.weekendHoldingAllowed) : '—'],
                  ['Overnight holding', (c: Challenge) => c.rules ? yes(c.rules.overnightHoldingAllowed) : '—'],
                  ['Expert advisors', (c: Challenge) => c.rules ? yes(c.rules.eaAllowed) : '—'],
                  ['Copy trading', (c: Challenge) => c.rules ? yes(c.rules.copyTradingAllowed) : '—'],
                  ['Price from', (c: Challenge) => { const p = lowestPrice(c); return p === null ? '—' : money(p); }],
                ] as Array<[string, (c: Challenge) => React.ReactNode]>).map(([label, fn]) => (
                  <tr key={label}><Td className="whitespace-nowrap font-semibold text-slate-300">{label}</Td>{data.map((c) => <Td key={c.id} className="text-white">{fn(c)}</Td>)}</tr>
                ))}
                <tr><Td />{data.map((c) => <Td key={c.id}><ButtonLink to={`/challenges/${c.slug}`} size="sm">Select</ButtonLink></Td>)}</tr>
              </tbody>
            </TableWrap>
          </div>
          <ul className="mt-6 grid gap-3 text-sm text-slate-400 md:grid-cols-3">
            <li><strong className="text-slate-200">One-step</strong> — a single evaluation stage with one, higher target.</li>
            <li><strong className="text-slate-200">Two-step</strong> — two stages with lower targets each; takes longer but is less demanding per stage.</li>
            <li><strong className="text-slate-200">Instant</strong> — no evaluation stage, with tighter risk limits from day one.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
