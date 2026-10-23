import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Badge, ButtonLink } from '@/components/ui';
import type { Challenge } from '@/lib/types';
import { drawdownLabel, modelLabel, money, pct } from '@/lib/format';

export const lowestPrice = (c: Challenge) => c.sizes.reduce<number | null>((m, s) => (s.price && (m === null || Number(s.price) < m) ? Number(s.price) : m), null);
export const sizeRange = (c: Challenge) => { const v = c.sizes.map((s) => Number(s.accountSize)); return v.length ? [Math.min(...v), Math.max(...v)] : null; };

export const Flag = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className="flex items-center gap-2 text-sm text-slate-300">
    {ok ? <Check className="h-4 w-4 text-brand-400" aria-label="Allowed" /> : <X className="h-4 w-4 text-slate-500" aria-label="Not allowed" />}{children}
  </li>
);

export function DraftBadge({ show }: { show: boolean }) {
  return show ? <Badge tone="amber">Draft terms — pending approval</Badge> : null;
}

export function ChallengeCard({ c }: { c: Challenge }) {
  const price = lowestPrice(c); const range = sizeRange(c);
  const r = c.rules;
  return (
    <article className="card flex flex-col p-6 transition-colors hover:border-brand-500/50">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{modelLabel(c.model)}</Badge><DraftBadge show={c.isDraftTerms} /></div>
      <h3 className="mt-4 text-xl font-bold">{c.name}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{c.tagline}</p>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-slate-500">Profit target</dt><dd className="font-semibold text-white">{c.stages.length ? c.stages.map((s) => pct(s.profitTargetPct)).join(' / ') : 'None'}</dd></div>
        <div><dt className="text-slate-500">Profit split</dt><dd className="font-semibold text-white">{pct(r?.profitSplitPct)}</dd></div>
        <div><dt className="text-slate-500">Daily drawdown</dt><dd className="font-semibold text-white">{pct(r?.dailyDrawdownPct)}</dd></div>
        <div><dt className="text-slate-500">Max drawdown</dt><dd className="font-semibold text-white">{pct(r?.maxDrawdownPct)} <span className="text-xs font-normal text-slate-500">{r && drawdownLabel(r.drawdownMethod)}</span></dd></div>
      </dl>
      <div className="mt-6 flex items-end justify-between border-t border-line pt-5">
        <div>
          <p className="text-xs text-slate-500">{range ? `${money(range[0])} – ${money(range[1])} accounts` : 'Account sizes'}</p>
          <p className="mt-0.5 text-sm text-slate-400">From <span className="font-display text-2xl font-extrabold text-white">{price !== null ? money(price) : '—'}</span></p>
        </div>
        <ButtonLink to={`/challenges/${c.slug}`} size="sm">View details</ButtonLink>
      </div>
      <Link to={`/challenges/${c.slug}`} className="sr-only">Details for {c.name}</Link>
    </article>
  );
}
