import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { Seo } from '@/components/Seo';
import { Alert, Badge, Button, Card, PageLoader } from '@/components/ui';
import { Flag, DraftBadge } from '@/components/ChallengeCard';
import { drawdownLabel, modelLabel, money, pct } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ChallengeDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { data: c, isLoading, error } = useQuery({ queryKey: ['challenge', slug], queryFn: async () => (await api.get<Challenge>(`/challenges/${slug}`)).data, retry: false });
  const [selected, setSelected] = useState<string | null>(null);
  if (isLoading) return <div className="container py-12"><PageLoader /></div>;
  if (error || !c) return (
    <div className="container py-24 text-center"><Seo title="Challenge not found" noindex />
      <h1 className="text-3xl font-extrabold">{error instanceof ApiError && error.status === 404 ? 'Challenge not found' : 'Unable to load this challenge'}</h1>
      <p className="mt-3 text-slate-400">It may have been unpublished.</p><Link to="/challenges" className="mt-6 inline-block font-semibold text-brand-400 hover:underline">Back to all challenges</Link></div>
  );
  const sizes = [...c.sizes].sort((a, b) => Number(a.accountSize) - Number(b.accountSize));
  const active = sizes.find((s) => s.productId === selected) ?? sizes[0];
  const r = c.rules!;
  return (
    <div className="container py-12 sm:py-16">
      <Seo title={c.name} description={c.tagline} path={`/challenges/${c.slug}`} />
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link to="/challenges" className="hover:text-white">Challenges</Link> <span aria-hidden>/</span> <span className="text-slate-200">{c.name}</span></nav>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-2"><Badge tone="blue">{modelLabel(c.model)}</Badge><DraftBadge show={c.isDraftTerms} /></div>
          <h1 className="mt-4 text-4xl font-extrabold">{c.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">{c.description}</p>
          {c.isDraftTerms && <Alert tone="warning" className="mt-6" title="Draft terms">These values are illustrative placeholders pending final iSoftStone approval.</Alert>}

          <h2 className="mt-10 text-2xl font-bold">Trading conditions</h2>
          <Card className="mt-4 divide-y divide-line">
            {[
              ['Evaluation stages', c.stages.length ? `${c.stages.length} — ${c.stages.map((s) => `${s.name} (${pct(s.profitTargetPct)} target, ${s.minTradingDays} min. days${s.maxDays ? `, ${s.maxDays} days max` : ''})`).join('; ')}` : 'None — simulated funded from the start'],
              ['Daily drawdown limit', pct(r.dailyDrawdownPct)], ['Maximum overall drawdown', pct(r.maxDrawdownPct)], ['Drawdown calculation', drawdownLabel(r.drawdownMethod)],
              ['Leverage', r.leverage], ['Profit split', pct(r.profitSplitPct)], ['Minimum reward request', money(r.rewardMinAmount, 'USD', 2)],
            ].map(([k, v]) => <div key={k as string} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:justify-between"><dt className="text-sm text-slate-400">{k}</dt><dd className="font-semibold text-white sm:text-right">{v}</dd></div>)}
          </Card>
          <h3 className="mt-8 text-lg font-bold">Trading policies</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <Flag ok={r.newsTradingAllowed}>News trading</Flag><Flag ok={r.weekendHoldingAllowed}>Weekend holding</Flag><Flag ok={r.overnightHoldingAllowed}>Overnight holding</Flag>
            <Flag ok={r.eaAllowed}>Expert advisors (EAs)</Flag><Flag ok={r.copyTradingAllowed}>Copy trading</Flag>
          </ul>
          <h3 className="mt-8 text-lg font-bold">Available forex instruments</h3>
          <ul className="mt-3 flex flex-wrap gap-2">{c.instruments.map((s) => <li key={s} className="rounded-md border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold">{s}</li>)}</ul>
          <p className="mt-3 text-xs text-slate-500">Instruments are subject to iSoftStone's broker and platform arrangements. Forex only — no futures or other asset classes.</p>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="text-lg font-bold">Choose your account size</h2>
            <div role="radiogroup" aria-label="Account size" className="mt-4 grid grid-cols-2 gap-2">
              {sizes.map((s) => (
                <button key={s.id} role="radio" aria-checked={s.productId === active?.productId} onClick={() => setSelected(s.productId)}
                  className={cn('rounded-lg border px-3 py-3 text-left transition-colors', s.productId === active?.productId ? 'border-brand-500 bg-brand-500/10' : 'border-line hover:border-slate-500')}>
                  <span className="block font-display text-lg font-extrabold text-white">{money(s.accountSize)}</span><span className="text-xs text-slate-400">{money(s.price)}</span>
                </button>
              ))}
            </div>
            {active && (
              <div className="mt-6 border-t border-line pt-5">
                <div className="flex items-baseline justify-between"><span className="text-sm text-slate-400">One-time fee</span><span className="font-display text-3xl font-extrabold text-white">{money(active.price, 'USD', 2)}</span></div>
                <Button size="lg" className="mt-5 w-full" onClick={() => nav(`/checkout/${active.productId}`)}>Continue to checkout</Button>
                <p className="mt-3 text-center text-xs text-slate-500">You will review the rules and accept the terms before paying. Price is verified on the server.</p>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
