import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { api } from '@/lib/api';
import { Seo } from '@/components/Seo';
import { Alert, ButtonLink, Card, PageLoader } from '@/components/ui';

export function HowItWorks() {
  const steps: Array<[string, string]> = [
    ['Choose a forex challenge', 'Compare one-step, two-step and three-step models by account size, price and rules.'],
    ['Register an account', 'Sign up with your email, accept the Terms and Conditions and verify your address.'],
    ['Review the challenge rules', 'Profit targets, drawdown limits, minimum trading days and trading policies are shown before you pay.'],
    ['Complete checkout', 'The price is re-calculated on our servers. Payment is confirmed only by a verified provider notification, never by a browser redirect.'],
    ['Receive confirmation and next steps', 'Your order and a pending account record appear in your dashboard. Account provisioning depends on the trading platform integration being configured.'],
    ['Complete the evaluation (where required)', 'Reach the profit target while respecting the daily and overall drawdown limits.'],
    ['Complete verification', 'Identity verification is required before rewards can be reviewed.'],
    ['Access a simulated funded account', 'Subject to approval and the firm\'s terms. Funded accounts are simulated, not live brokerage accounts.'],
    ['Request eligible rewards', 'Eligibility is checked on the server against the published rules, then reviewed by our team.'],
  ];
  return (
    <div className="container py-12 sm:py-16">
      <Seo title="How it works" description="From choosing a forex challenge to requesting eligible rewards: how iSoftStone evaluations work." path="/how-it-works" />
      <p className="eyebrow">How it works</p><h1 className="mt-3 text-4xl font-extrabold">Your journey with iSoftStone</h1>
      <ol className="mt-10 max-w-3xl space-y-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="card flex gap-5 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/15 font-display font-extrabold text-brand-400" aria-hidden>{i + 1}</span><div><h2 className="text-lg font-bold">{t}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{d}</p></div></li>
        ))}
      </ol>
      <Alert tone="info" className="mt-8 max-w-3xl" title="Honest scope">Brokerage connectivity, automated payouts and payment methods are only described as available once the corresponding integrations are configured and tested.</Alert>
      <div className="mt-8"><ButtonLink to="/challenges" size="lg">Browse challenges</ButtonLink></div>
    </div>
  );
}

export function About() {
  return (
    <div className="container py-12 sm:py-16">
      <Seo title="About" description="iSoftStone is a forex-focused proprietary trading evaluation company built around transparent rules." path="/about" />
      <p className="eyebrow">About iSoftStone</p><h1 className="mt-3 max-w-3xl text-4xl font-extrabold">A forex-only evaluation firm built on transparent rules</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {[['Our mission', 'Give forex traders a clear, fair way to demonstrate their skills, with every rule stated up front.'],
          ['Our approach', 'Simulated evaluation accounts with published targets and risk limits. We verify prices, eligibility and payments on the server.'],
          ['Our focus', 'Currency pairs only. We deliberately do not offer futures or other asset classes.']].map(([t, d]) => (
          <Card key={t} className="p-6"><h2 className="text-xl font-bold">{t}</h2><p className="mt-3 text-sm leading-7 text-slate-400">{d}</p></Card>
        ))}
      </div>
      <Card className="mt-6 p-6"><h2 className="text-xl font-bold">Company information</h2><p className="mt-3 text-sm leading-7 text-slate-400">Legal entity, registered address, jurisdiction and regulatory details will be published here once confirmed. We do not state establishment dates, trading volumes, customer numbers or regulatory status that have not been verified.</p></Card>
    </div>
  );
}

export function Legal() {
  const { slug } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['legal', slug], queryFn: async () => (await api.get<{ title: string; status: string; version: number; body: string; updatedAt: string }>(`/legal/${slug}`)).data, retry: false });
  if (isLoading) return <div className="container py-12"><PageLoader /></div>;
  if (error || !data) return <div className="container py-24 text-center"><Seo title="Document not found" noindex /><h1 className="text-3xl font-extrabold">Document not found</h1><Link to="/" className="mt-6 inline-block text-brand-400 hover:underline">Back home</Link></div>;
  // Minimal, safe renderer: headings, lists, quotes, paragraphs. Text is never injected as HTML.
  const blocks = data.body.split(/\n{2,}/);
  return (
    <div className="container max-w-3xl py-12 sm:py-16">
      <Seo title={data.title} path={`/legal/${slug}`} />
      <h1 className="text-4xl font-extrabold">{data.title}</h1>
      <p className="mt-2 text-sm text-slate-500">Version {data.version} · {data.status === 'DRAFT' ? 'Draft — not yet legally reviewed' : 'Published'}</p>
      <div className="prose-legal mt-6">
        {blocks.map((b, i) => {
          const lines = b.split('\n');
          if (b.startsWith('> ')) return <blockquote key={i}>{b.replace(/^> /gm, '').replace(/\*\*/g, '')}</blockquote>;
          return <div key={i}>{lines.map((l, j) => l.startsWith('## ') ? <h2 key={j}>{l.slice(3)}</h2> : l.startsWith('- ') ? <ul key={j}><li>{l.slice(2)}</li></ul> : <p key={j}>{l}</p>)}</div>;
        })}
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center"><Seo title="Page not found" noindex />
      <p className="font-display text-7xl font-black text-brand-500">404</p><h1 className="mt-4 text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-slate-400">The page you are looking for does not exist or has moved.</p>
      <ButtonLink to="/" className="mt-8">Back to home</ButtonLink></div>
  );
}

