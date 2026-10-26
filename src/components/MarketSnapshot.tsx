import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Alert, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface SnapshotItem { pair: string; rate: number; change: number; changePct: number; asOf: string; spark: number[] }
export interface Snapshot { items: SnapshotItem[]; source: { name: string; url: string; frequency: string } }
export const digitsFor = (pair: string) => (pair.includes('JPY') ? 3 : 5);

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data); const max = Math.max(...data); const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 26 - 1}`).join(' ');
  return <svg viewBox="0 0 100 28" className="h-8 w-full" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke={up ? '#10B981' : '#F87171'} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}

export function useSnapshot() {
  return useQuery({ queryKey: ['market', 'snapshot'], queryFn: async () => (await api.get<Snapshot>('/market/snapshot')).data, staleTime: 5 * 60_000, retry: 1 });
}

export function MarketSnapshot() {
  const { data, isLoading, error } = useSnapshot();
  if (isLoading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (error || !data) return <Alert tone="warning">Market data is temporarily unavailable.</Alert>;
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.items.map((i) => {
          const up = i.change >= 0;
          return (
            <li key={i.pair}>
              <Link to={`/markets?pair=${encodeURIComponent(i.pair)}`} className="card block p-4 transition-colors hover:border-brand-500/60">
                <div className="flex items-center justify-between"><span className="font-bold text-white">{i.pair}</span>
                  <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-brand-400' : 'text-red-300')}>{up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}{up ? '+' : ''}{i.changePct.toFixed(2)}%</span></div>
                <p className="mt-1 font-display text-2xl font-extrabold">{i.rate.toFixed(digitsFor(i.pair))}</p>
                <Spark data={i.spark} up={up} />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">{data.source.frequency} reference rates · latest {data.items[0]?.asOf} · Source: <a className="underline hover:text-slate-300" href={data.source.url} rel="noopener noreferrer" target="_blank">{data.source.name}</a>. For information only; not tradable quotes.</p>
    </>
  );
}
