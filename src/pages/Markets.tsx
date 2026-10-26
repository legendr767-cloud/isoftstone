import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorText } from '@/lib/api';
import { Seo } from '@/components/Seo';
import { Alert, Card, PageLoader } from '@/components/ui';
import { digitsFor } from '@/components/MarketSnapshot';
import { cn } from '@/lib/utils';

const PriceChart = lazy(() => import('@/components/PriceChart'));
const RANGES = ['1M', '3M', '6M', '1Y'] as const;
interface History { pair: string; range: string; points: Array<{ date: string; rate: number }>; asOf: string; source: { name: string; url: string; frequency: string } }

export default function Markets() {
  const [params, setParams] = useSearchParams();
  const pair = params.get('pair') ?? 'EUR/USD'; const range = (RANGES as readonly string[]).includes(params.get('range') ?? '') ? params.get('range')! : '3M';
  const pairs = useQuery({ queryKey: ['market', 'pairs'], queryFn: async () => (await api.get<string[]>('/market/pairs')).data, staleTime: Infinity });
  const { data, isLoading, error } = useQuery({ queryKey: ['market', 'history', pair, range], queryFn: async () => (await api.get<History>(`/market/history?pair=${encodeURIComponent(pair)}&range=${range}`)).data, staleTime: 5 * 60_000, retry: 1, placeholderData: (p) => p });
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); n.set(k, v); setParams(n, { replace: true }); };
  const pts = data?.points ?? []; const first = pts[0]?.rate; const last = pts[pts.length - 1]?.rate;
  const chg = first && last ? ((last - first) / first) * 100 : null;
  const hi = pts.length ? Math.max(...pts.map((p) => p.rate)) : null; const lo = pts.length ? Math.min(...pts.map((p) => p.rate)) : null;
  const d = digitsFor(pair);
  return (
    <div className="container py-12 sm:py-16">
      <Seo title="Forex markets" description="Daily reference-rate charts for the major forex pairs offered on iSoftStone." path="/markets" />
      <p className="eyebrow">Markets</p><h1 className="mt-3 text-4xl font-extrabold">Forex price charts</h1>
      <p className="mt-3 max-w-2xl text-slate-400">Real daily reference rates for the pairs available on iSoftStone challenges. Use them for context while you plan your trading.</p>
      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Currency pair">
        {(pairs.data ?? ['EUR/USD']).map((p) => <button key={p} aria-pressed={p === pair} onClick={() => set('pair', p)} className={cn('rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors', p === pair ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-line text-slate-300 hover:border-slate-500')}>{p}</button>)}
      </div>
      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm text-slate-400">{pair} · latest reference rate</p><p className="font-display text-4xl font-extrabold">{last ? last.toFixed(d) : '—'}</p>
            {chg !== null && <p className={cn('mt-1 text-sm font-semibold', chg >= 0 ? 'text-brand-400' : 'text-red-300')}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}% over {range}</p>}</div>
          <div role="group" aria-label="Time range" className="flex gap-1 rounded-lg border border-line p-1">{RANGES.map((r) => <button key={r} aria-pressed={r === range} onClick={() => set('range', r)} className={cn('rounded-md px-3 py-1.5 text-sm font-semibold', r === range ? 'bg-brand-500 text-ink-950' : 'text-slate-300 hover:bg-ink-600')}>{r}</button>)}</div>
        </div>
        <div className="mt-6">
          {error ? <Alert tone="error">{errorText(error)}</Alert> : isLoading && !data ? <PageLoader /> : <Suspense fallback={<PageLoader />}><PriceChart points={pts} pair={pair} /></Suspense>}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-4">
          {[['Period high', hi?.toFixed(d)], ['Period low', lo?.toFixed(d)], ['Period start', first?.toFixed(d)], ['As of', data?.asOf]].map(([k, v]) => <div key={k as string}><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-white">{v ?? '—'}</dd></div>)}
        </dl>
      </Card>
      <p className="mt-4 text-xs leading-5 text-slate-500">Source: <a className="underline hover:text-slate-300" href={data?.source.url ?? 'https://frankfurter.dev'} rel="noopener noreferrer" target="_blank">{data?.source.name ?? 'European Central Bank reference rates via Frankfurter'}</a>. {data?.source.frequency ?? 'Daily'} reference rates published once per working day; they are not live, tradable quotes and are not the prices used on any trading account. Past performance is not indicative of future results.</p>
    </div>
  );
}
