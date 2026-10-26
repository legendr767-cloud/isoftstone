import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorText } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { Seo } from '@/components/Seo';
import { Alert, Badge, Button, Card, Checkbox, PageLoader } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSite } from '@/hooks/useSite';
import { drawdownLabel, money, pct } from '@/lib/format';

export default function Checkout() {
  const { productId } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const { user, loading } = useAuth(); const { data: site } = useSite();
  const [terms, setTerms] = useState(false); const [err, setErr] = useState<string | null>(null);
  const { data: list, isLoading } = useQuery({ queryKey: ['challenges'], queryFn: async () => (await api.get<Challenge[]>('/challenges')).data });
  const found = list?.flatMap((c) => c.sizes.filter((s) => s.productId === productId).map((s) => ({ c, s })))[0];
  const place = useMutation({
    mutationFn: async () => {
      const o = await api.post<{ id: string; paymentsAvailable: boolean }>('/orders', { items: [{ productId, addonCodes: [] }], acceptTerms: true });
      if (!o.data.paymentsAvailable) return { id: o.data.id, next: `/dashboard/orders/${o.data.id}` };
      const p = await api.post<{ attemptId: string; nextPath: string | null }>(`/orders/${o.data.id}/pay`);
      return { id: o.data.id, next: p.data.nextPath ?? `/dashboard/orders/${o.data.id}` };
    },
    onSuccess: async ({ next }) => { await qc.invalidateQueries(); nav(next); }, onError: (e) => setErr(errorText(e)),
  });
  if (loading || isLoading) return <div className="container py-12"><PageLoader /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/checkout/${productId}`)}`} replace />;
  if (!found) return <div className="container py-24 text-center"><Seo title="Checkout" noindex /><h1 className="text-3xl font-extrabold">This product is not available</h1><Link to="/challenges" className="mt-6 inline-block text-brand-400 hover:underline">Browse challenges</Link></div>;
  const { c, s } = found; const r = c.rules!;
  return (
    <div className="container max-w-5xl py-12 sm:py-16">
      <Seo title="Checkout" noindex />
      <h1 className="text-4xl font-extrabold">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6"><h2 className="text-lg font-bold">Your selection</h2>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xl font-bold text-white">{c.name}</p><p className="text-sm text-slate-400">{money(s.accountSize)} simulated account</p></div>{c.isDraftTerms && <Badge tone="amber">Draft terms</Badge>}</div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[['Profit target', c.stages.length ? c.stages.map((x) => pct(x.profitTargetPct)).join(' / ') : 'None'], ['Daily drawdown', pct(r.dailyDrawdownPct)], ['Max drawdown', `${pct(r.maxDrawdownPct)} · ${drawdownLabel(r.drawdownMethod)}`], ['Profit split', pct(r.profitSplitPct)], ['Leverage', r.leverage]].map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-white">{v}</dd></div>)}
            </dl>
            <Link to={`/challenges/${c.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand-400 hover:underline">Review full rules</Link>
          </Card>
          <Card className="p-6"><h2 className="text-lg font-bold">Customer details</h2><p className="mt-2 text-sm text-slate-300">{user.profile?.firstName} {user.profile?.lastName} · {user.email}</p>
            {!user.emailVerified && site?.emailDelivery && <Alert tone="warning" className="mt-4">Please verify your email before purchasing.</Alert>}</Card>
        </div>
        <aside><Card className="p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Order summary</h2>
          <div className="mt-4 flex justify-between text-sm"><span className="text-slate-400">{c.name} · {money(s.accountSize)}</span><span>{money(s.price, 'USD', 2)}</span></div>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4"><span className="font-semibold">Total</span><span className="font-display text-3xl font-extrabold">{money(s.price, 'USD', 2)}</span></div>
          <p className="mt-2 text-xs text-slate-500">The final amount is re-calculated on the server when you place the order.</p>
          {site && !site.payments.configured && <Alert tone="warning" className="mt-4" title="Online payment unavailable">Payments are not configured yet. Placing the order saves it, but no payment will be taken.</Alert>}
          {site?.payments.mode === 'simulator' && <Alert tone="info" className="mt-4" title="Payment simulator">This deployment uses a test payment simulator. No real money is charged.</Alert>}
          <div className="mt-5"><Checkbox id="co-terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} label={<>I accept the <Link className="text-brand-400 underline" to="/legal/terms" target="_blank">Terms and Conditions</Link>, <Link className="text-brand-400 underline" to="/legal/trading-rules" target="_blank">Trading Rules</Link> and <Link className="text-brand-400 underline" to="/legal/refund-policy" target="_blank">Refund Policy</Link>. I understand accounts are simulated.</>} /></div>
          {err && <Alert tone="error" className="mt-4">{err}</Alert>}
          <Button size="lg" className="mt-5 w-full" disabled={!terms} loading={place.isPending} onClick={() => { setErr(null); place.mutate(); }}>{site?.payments.configured ? 'Place order & pay' : 'Place order'}</Button>
        </Card></aside>
      </div>
    </div>
  );
}

export function CheckoutSimulator() {
  const { attemptId } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const [err, setErr] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['sim', attemptId], queryFn: async () => (await api.get<{ amount: string; currency: string; orderId: string; orderNumber: string; status: string }>(`/payments/simulator/${attemptId}`)).data, retry: false });
  const complete = useMutation({ mutationFn: (outcome: 'success' | 'failure') => api.post(`/payments/simulator/${attemptId}/complete`, { outcome }), onSuccess: async () => { await qc.invalidateQueries(); nav(`/dashboard/orders/${data!.orderId}`); }, onError: (e) => setErr(errorText(e)) });
  if (isLoading) return <div className="container py-12"><PageLoader /></div>;
  if (error || !data) return <div className="container py-24 text-center"><Seo title="Payment simulator" noindex /><h1 className="text-2xl font-extrabold">Payment simulator is not available</h1></div>;
  return (
    <div className="container max-w-lg py-16"><Seo title="Payment simulator" noindex />
      <Alert tone="warning" title="Test payment simulator">This is a development/preview tool, not a real payment gateway. No money moves. The result is sent through the same signed-webhook pipeline a real provider uses.</Alert>
      <Card className="mt-6 p-6"><p className="text-sm text-slate-400">Order {data.orderNumber}</p><p className="mt-1 font-display text-3xl font-extrabold">{money(data.amount, data.currency, 2)}</p>
        {err && <Alert tone="error" className="mt-4">{err}</Alert>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button loading={complete.isPending} onClick={() => complete.mutate('success')}>Simulate success</Button><Button variant="secondary" disabled={complete.isPending} onClick={() => complete.mutate('failure')}>Simulate failure</Button></div></Card>
    </div>
  );
}
