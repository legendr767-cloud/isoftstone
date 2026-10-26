import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardCheck, CreditCard, FileText, Gauge, ListChecks, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { api } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { Seo } from '@/components/Seo';
import { ButtonLink, Card, Skeleton, Alert } from '@/components/ui';
import { ChallengeCard } from '@/components/ChallengeCard';
import { ProfitCalculator } from '@/components/ProfitCalculator';
import { MarketSnapshot } from '@/components/MarketSnapshot';
import { useSite } from '@/hooks/useSite';

function HeroVisual() {
  const reduce = useReducedMotion();
  const bars = [38, 52, 44, 66, 58, 79, 72, 94];
  return (
    <motion.div animate={reduce ? undefined : { y: [0, -8, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand-500/10 blur-3xl" aria-hidden />
      <div className="card relative p-5 shadow-glow" role="img" aria-label="Illustration of the iSoftStone trader dashboard. Example interface only; the figures are not real account data.">
        <div className="flex items-center justify-between text-xs"><span className="font-bold text-slate-300">Account overview</span><span className="rounded bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-200">Illustration</span></div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[['Balance', '$108,000'], ['Target', '72%'], ['Days', '9']].map(([k, v]) => <div key={k} className="rounded-lg bg-ink-900/70 p-3"><p className="text-[0.65rem] uppercase tracking-wider text-slate-500">{k}</p><p className="mt-1 font-display text-lg font-extrabold text-white">{v}</p></div>)}
        </div>
        <div className="mt-4 flex h-32 items-end gap-2 rounded-lg bg-ink-900/70 p-3" aria-hidden>
          {bars.map((h, i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${h}%` }} />)}
        </div>
        <div className="mt-4 space-y-3 text-xs">
          {[['Daily drawdown remaining', 82], ['Overall drawdown remaining', 91]].map(([k, v]) => (
            <div key={k as string}><div className="mb-1 flex justify-between text-slate-400"><span>{k}</span><span>{v}%</span></div><div className="h-1.5 rounded-full bg-ink-600"><div className="h-full rounded-full bg-brand-500" style={{ width: `${v}%` }} /></div></div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const benefits = [
  { icon: ShieldCheck, title: 'Forex only, by design', text: 'Every product, rule and instrument is built around currency pairs. No futures, no side markets.' },
  { icon: FileText, title: 'Rules you can read first', text: 'Targets, drawdown limits and trading conditions are shown in full before you check out.' },
  { icon: LockKeyhole, title: 'Verified at the server', text: 'Prices, eligibility and payments are checked on our servers, never trusted from your browser.' },
  { icon: Gauge, title: 'Clear progress tracking', text: 'Your dashboard shows profit target progress and the drawdown allowance you have left.' },
];
const steps = [
  { icon: ListChecks, t: 'Choose a challenge', d: 'Compare forex evaluation models and account sizes.' },
  { icon: UserPlus, t: 'Register', d: 'Create your account and verify your email.' },
  { icon: ClipboardCheck, t: 'Review the rules', d: 'Read targets, drawdown and trading conditions.' },
  { icon: CreditCard, t: 'Check out', d: 'Price is verified on the server; payment is confirmed by a signed webhook.' },
  { icon: BarChart3, t: 'Trade and progress', d: 'Track your evaluation, then request eligible rewards under the published rules.' },
];

export default function Home() {
  const { data, isLoading } = useQuery({ queryKey: ['challenges'], queryFn: async () => (await api.get<Challenge[]>('/challenges')).data });
  const { data: instruments } = useQuery({ queryKey: ['instruments'], queryFn: async () => (await api.get<string[]>('/instruments')).data });
  const { data: site } = useSite();
  return (
    <>
      <Seo path="/" jsonLd={{ '@context': 'https://schema.org', '@type': 'Organization', name: 'iSoftStone', url: typeof window !== 'undefined' ? window.location.origin : undefined, logo: '/logo.svg' }} />
      <section className="relative overflow-hidden border-b border-line/60">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div className="container relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="eyebrow">Forex proprietary trading evaluations</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">Prove your forex edge. <span className="text-brand-400">On clear, published rules.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">iSoftStone offers simulated forex evaluations with transparent targets and risk limits. Compare challenges, read every rule up front, and start when you are ready.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/challenges" size="lg">Explore challenges <ArrowRight className="h-5 w-5" aria-hidden /></ButtonLink>
              <ButtonLink to="/how-it-works" variant="secondary" size="lg">How funding works</ButtonLink>
            </div>
            <p className="mt-6 max-w-xl text-xs leading-5 text-slate-500">Simulated trading accounts. Not a brokerage service. Reward eligibility depends on the published rules, verification and review; nothing here guarantees earnings.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="section" aria-labelledby="why">
        <div className="container">
          <p className="eyebrow">Why iSoftStone</p>
          <h2 id="why" className="mt-3 max-w-2xl text-3xl font-extrabold sm:text-4xl">Built for traders who want clarity, not fine print</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: I, title, text }) => (
              <Card key={title} className="p-6"><I className="h-7 w-7 text-brand-400" aria-hidden /><h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-y border-line/60 bg-ink-950/60" aria-labelledby="models">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">Challenge models</p><h2 id="models" className="mt-3 text-3xl font-extrabold sm:text-4xl">Pick the path that fits your style</h2></div>
            <Link to="/challenges" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline">Compare all <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          {site?.showDraftOffers && <Alert tone="warning" className="mt-6" title="Draft terms">Prices and rules shown are illustrative placeholders pending final iSoftStone approval and are not yet final offers.</Alert>}
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />) : data?.length ? data.map((c) => <ChallengeCard key={c.id} c={c} />) : (
              <p className="col-span-full rounded-xl border border-dashed border-line p-10 text-center text-slate-400">Challenges will appear here once their terms are approved and published.</p>
            )}
          </div>
        </div>
      </section>

      <section className="section border-b border-line/60" aria-labelledby="mkts">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">Markets</p><h2 id="mkts" className="mt-3 text-3xl font-extrabold sm:text-4xl">Today's forex reference rates</h2></div>
            <Link to="/markets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline">Open price charts <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="mt-8"><MarketSnapshot /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="steps">
        <div className="container">
          <p className="eyebrow">How it works</p><h2 id="steps" className="mt-3 text-3xl font-extrabold sm:text-4xl">From selection to tracking</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-5">
            {steps.map(({ icon: I, t, d }, n) => (
              <li key={t} className="card relative p-5"><span className="absolute right-4 top-3 font-display text-4xl font-black text-ink-500/60" aria-hidden>{n + 1}</span><I className="h-6 w-6 text-brand-400" aria-hidden /><h3 className="mt-3 font-bold">{t}</h3><p className="mt-1.5 text-sm leading-6 text-slate-400">{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section border-t border-line/60 bg-ink-950/60" aria-labelledby="calc">
        <div className="container">
          <p className="eyebrow">Profit calculator</p><h2 id="calc" className="mt-3 text-3xl font-extrabold sm:text-4xl">See how a profit split works</h2>
          <p className="mt-3 max-w-2xl text-slate-400">Choose an account size, a hypothetical return and a split. Defaults follow the selected challenge's published terms.</p>
          <div className="mt-8"><ProfitCalculator compact /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="markets">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Markets & platform</p><h2 id="markets" className="mt-3 text-3xl font-extrabold sm:text-4xl">Forex pairs only</h2>
            <p className="mt-4 leading-7 text-slate-400">The approved instrument list is maintained by administrators and limited to currency pairs. The trading platform and broker connectivity will be announced here once confirmed.</p>
            <ul className="mt-6 flex flex-wrap gap-2">{(instruments ?? []).slice(0, 12).map((s) => <li key={s} className="rounded-md border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold text-slate-200">{s}</li>)}</ul>
          </div>
          <Card className="p-6 sm:p-8">
            <h3 className="text-xl font-bold">Risk management at a glance</h3>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
              <li><strong className="text-white">Daily drawdown limit</strong> — caps the loss you can take in a single trading day.</li>
              <li><strong className="text-white">Overall drawdown limit</strong> — caps total drawdown from the starting balance.</li>
              <li><strong className="text-white">Profit targets & minimum days</strong> — set per stage and shown before purchase.</li>
              <li><strong className="text-white">News, weekend, EA and copy-trading policies</strong> — stated per challenge.</li>
            </ul>
            <Link to="/legal/trading-rules" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline">Read the trading rules <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </Card>
        </div>
      </section>

      <section className="section border-t border-line/60">
        <div className="container">
          <Card className="flex flex-col items-start justify-between gap-6 bg-gradient-to-br from-royal-700/40 to-ink-800 p-8 sm:flex-row sm:items-center sm:p-12">
            <div><h2 className="text-2xl font-extrabold sm:text-3xl">Questions before you start?</h2><p className="mt-2 text-slate-300">Browse the help center or send us a message. Requests are stored and answered by our support team.</p></div>
            <div className="flex flex-wrap gap-3"><ButtonLink to="/faq" variant="secondary">Help center</ButtonLink><ButtonLink to="/contact">Contact support</ButtonLink></div>
          </Card>
        </div>
      </section>
    </>
  );
}
