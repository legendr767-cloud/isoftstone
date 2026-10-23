import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Seo } from '@/components/Seo';
import { Input, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Item { id: string; category: string; question: string; answer: string }

export default function Faq() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['faq', debounced], queryFn: async () => (await api.get<Item[]>(`/faq?q=${encodeURIComponent(debounced)}`)).data, placeholderData: (p) => p });
  const { data: all } = useQuery({ queryKey: ['faq', ''], queryFn: async () => (await api.get<Item[]>('/faq')).data });
  const cats = useMemo(() => [...new Set((all ?? []).map((i) => i.category))], [all]);
  const shown = (data ?? []).filter((i) => !cat || i.category === cat);
  const groups = useMemo(() => shown.reduce<Record<string, Item[]>>((a, i) => ((a[i.category] ??= []).push(i), a), {}), [shown]);
  return (
    <div className="container max-w-4xl py-12 sm:py-16">
      <Seo title="FAQ and help center" description="Answers about iSoftStone forex challenges, drawdown rules, verification, rewards and payments." path="/faq"
        jsonLd={all ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: all.slice(0, 20).map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })) } : undefined} />
      <p className="eyebrow">Help center</p><h1 className="mt-3 text-4xl font-extrabold">Frequently asked questions</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Input id="faq-search" label="Search questions" type="search" value={q} placeholder="e.g. drawdown, payments, EAs" onChange={(e) => { setQ(e.target.value); window.clearTimeout((window as any).__faqT); (window as any).__faqT = window.setTimeout(() => setDebounced(e.target.value.trim()), 250); }} className="pl-10" />
          <Search className="pointer-events-none absolute bottom-3 left-3.5 h-4 w-4 text-slate-500" aria-hidden />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {['', ...cats].map((c) => <button key={c || 'all'} aria-pressed={cat === c} onClick={() => setCat(c)} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', cat === c ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-line text-slate-300 hover:border-slate-500')}>{c || 'All'}</button>)}
      </div>
      <div className="mt-8 space-y-8" aria-live="polite">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        {!isLoading && shown.length === 0 && <p className="rounded-xl border border-dashed border-line p-10 text-center text-slate-400">No questions match your search. Try different words or <a className="text-brand-400 hover:underline" href="/contact">contact support</a>.</p>}
        {Object.entries(groups).map(([c, items]) => (
          <section key={c} aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="text-lg font-bold text-brand-300">{c}</h2>
            <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-ink-800/60">
              {items.map((i) => <details key={i.id} className="group px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white"><span>{i.question}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden /></summary><p className="mt-3 text-sm leading-7 text-slate-300">{i.answer}</p></details>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
