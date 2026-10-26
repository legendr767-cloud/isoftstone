import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, CreditCard, Gift, LayoutDashboard, LifeBuoy, ShieldCheck, UserCog, Wallet } from 'lucide-react';
import { api, errorText } from '@/lib/api';
import type { AccountSummary } from '@/lib/types';
import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, Input, PageLoader, Progress, statusTone, TableWrap, Td, Textarea, Th } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useSite } from '@/hooks/useSite';
import { date, dateTime, drawdownLabel, label, money, pct } from '@/lib/format';

const EquityChart = lazy(() => import('@/components/EquityChart'));

const nav: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/dashboard/accounts', label: 'My accounts', icon: Wallet },
  { to: '/dashboard/orders', label: 'Orders', icon: CreditCard }, { to: '/dashboard/rewards', label: 'Rewards', icon: Gift },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy }, { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/profile', label: 'Profile & security', icon: UserCog },
];
export const DashboardShell = () => <AppShell title="Dashboard" items={nav} />;

const useList = <T,>(key: string, path: string) => useQuery({ queryKey: [key], queryFn: async () => (await api.get<T>(path)).data });
const Title = ({ children, sub }: { children: React.ReactNode; sub?: string }) => <header className="mb-8"><h1 className="text-3xl font-extrabold">{children}</h1>{sub && <p className="mt-1 text-slate-400">{sub}</p>}</header>;
const Stat = ({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) => <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{k}</p><p className={`mt-2 font-display text-2xl font-extrabold ${tone ?? 'text-white'}`}>{v}</p></Card>;

function DataSourceNotice({ a }: { a: AccountSummary }) {
  if (a.metrics?.source === 'DEMO_FIXTURE') return <Alert tone="warning" title="Demonstration data">These figures are generated development fixtures, not real account data.</Alert>;
  if (!a.providerConnected) return <Alert tone="info" title="Live account data not connected">A trading-platform integration has not been configured, so balances and results are not yet available.</Alert>;
  return null;
}

function AccountCard({ a }: { a: AccountSummary }) {
  const v = a.status_view;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-white">{a.challenge.name}</p><p className="text-xs text-slate-500">{a.accountRef} · {money(a.startingBalance, a.currency)}</p></div><div className="flex gap-2"><Badge tone={statusTone(a.status)}>{label(a.status)}</Badge><Badge tone="blue">{label(a.phase)}</Badge></div></div>
      {v && a.stage ? <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-400"><span>{a.stage.name} target ({pct(a.stage.profitTargetPct)})</span><span>{Math.round(v.targetProgressPct ?? 0)}%</span></div><Progress value={v.targetProgressPct ?? 0} label="Profit target progress" /></div>
        : <p className="mt-4 text-sm text-slate-400">{a.status === 'PENDING_PROVISIONING' ? 'Awaiting provisioning. We will notify you when your account is ready.' : 'No metrics available yet.'}</p>}
      <Link to={`/dashboard/accounts/${a.id}`} className="mt-4 inline-block text-sm font-semibold text-brand-400 hover:underline">View details</Link>
    </Card>
  );
}

export function Overview() {
  const { user } = useAuth();
  const sum = useList<{ accounts: number; orders: number; unreadNotifications: number; recentOrders: Array<{ id: string; orderNumber: string; status: string; total: string; currency: string; createdAt: string }> }>('dashboard', '/me/dashboard');
  const accts = useList<AccountSummary[]>('accounts', '/me/accounts');
  if (sum.isLoading || accts.isLoading) return <PageLoader />;
  if (sum.error) return <Alert tone="error">{errorText(sum.error)}</Alert>;
  const d = sum.data!; const list = accts.data ?? [];
  return (
    <>
      <Title sub="Here is a summary of your accounts and activity.">Welcome, {user?.profile?.firstName ?? 'trader'}</Title>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Accounts" v={d.accounts} /><Stat k="Orders" v={d.orders} /><Stat k="Unread notifications" v={d.unreadNotifications} />
        <Stat k="Verification" v={<Badge tone={statusTone(user?.verificationStatus ?? '')}>{label(user?.verificationStatus ?? 'NOT_STARTED')}</Badge>} />
      </div>
      {!user?.emailVerified && <Alert tone="warning" className="mt-6" title="Email not verified">Verify your email from <Link className="underline" to="/dashboard/profile">Profile & security</Link>.</Alert>}
      <h2 className="mb-4 mt-10 text-xl font-bold">Your accounts</h2>
      {list.length === 0 ? <EmptyState icon={<Wallet className="h-10 w-10" />} title="No challenge accounts yet" action={<ButtonLink to="/challenges">Explore challenges</ButtonLink>}>Choose a forex challenge to get started. Once your payment is confirmed, your account record will appear here.</EmptyState> : (
        <div className="grid gap-4 md:grid-cols-2">{list.map((a) => <AccountCard key={a.id} a={a} />)}</div>)}
      <h2 className="mb-4 mt-10 text-xl font-bold">Recent orders</h2>
      {d.recentOrders.length === 0 ? <p className="text-sm text-slate-400">No orders yet.</p> : (
        <TableWrap caption="Recent orders"><thead><tr><Th>Order</Th><Th>Date</Th><Th>Total</Th><Th>Status</Th></tr></thead><tbody>
          {d.recentOrders.map((o) => <tr key={o.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/dashboard/orders/${o.id}`}>{o.orderNumber}</Link></Td><Td>{date(o.createdAt)}</Td><Td>{money(o.total, o.currency, 2)}</Td><Td><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></Td></tr>)}</tbody></TableWrap>)}
    </>
  );
}

export function Accounts() {
  const { data, isLoading, error } = useList<AccountSummary[]>('accounts', '/me/accounts');
  if (isLoading) return <PageLoader />;
  return (<><Title sub="All challenge accounts you have purchased.">My accounts</Title>{error && <Alert tone="error">{errorText(error)}</Alert>}
    {data?.length === 0 ? <EmptyState icon={<Wallet className="h-10 w-10" />} title="No accounts yet" action={<ButtonLink to="/challenges">Explore challenges</ButtonLink>}>Purchased accounts will appear here after payment is confirmed.</EmptyState>
      : <div className="grid gap-4 md:grid-cols-2">{data?.map((a) => <AccountCard key={a.id} a={a} />)}</div>}</>);
}

interface Detail extends AccountSummary { history: Array<{ id: string; phase: string; status: string; note: string | null; createdAt: string }>; trades: Array<{ id: string; symbol: string; side: string; volume: string; profit: string | null; openedAt: string }>; curve: Array<{ balance: string; equity: string; capturedAt: string }>; rewards: Array<{ id: string; amount: string; status: string; createdAt: string }> }
interface Elig { eligible: boolean; availableAmount: string; reasons: string[] }

export function AccountDetail() {
  const { id } = useParams(); const qc = useQueryClient(); const { toast } = useToast();
  const { data: a, isLoading, error } = useQuery({ queryKey: ['account', id], queryFn: async () => (await api.get<Detail>(`/me/accounts/${id}`)).data, retry: false });
  const { data: elig } = useQuery({ queryKey: ['elig', id], queryFn: async () => (await api.get<Elig>(`/me/accounts/${id}/reward-eligibility`)).data, enabled: !!a });
  const req = useMutation({ mutationFn: () => api.post('/me/rewards', { accountId: id }), onSuccess: () => { toast('success', 'Reward request submitted for review.'); qc.invalidateQueries(); }, onError: (e) => toast('error', errorText(e)) });
  if (isLoading) return <PageLoader />;
  if (error || !a) return <EmptyState title="Account not found"><Link className="text-brand-400 underline" to="/dashboard/accounts">Back to accounts</Link></EmptyState>;
  const v = a.status_view;
  return (
    <>
      <Link to="/dashboard/accounts" className="text-sm text-slate-400 hover:text-white">← All accounts</Link>
      <Title sub={`${a.accountRef} · started with ${money(a.startingBalance, a.currency)}`}>{a.challenge.name}</Title>
      <div className="mb-6 flex flex-wrap gap-2"><Badge tone={statusTone(a.status)}>{label(a.status)}</Badge><Badge tone="blue">{label(a.phase)}</Badge></div>
      <DataSourceNotice a={a} />
      {a.metrics && v ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat k="Balance" v={money(a.metrics.balance, a.currency, 2)} /><Stat k="Equity" v={money(a.metrics.equity, a.currency, 2)} />
            <Stat k="Profit / loss" v={money(v.profit, a.currency, 2)} tone={Number(v.profit) >= 0 ? 'text-brand-400' : 'text-red-300'} /><Stat k="Trading days" v={`${v.tradingDays}${v.minTradingDays ? ` / ${v.minTradingDays}` : ''}`} />
          </div>
          <Card className="mt-6 p-6"><h2 className="font-bold">Challenge progress</h2>
            {a.stage && v.targetAmount && <div className="mt-4"><div className="mb-1 flex justify-between text-sm text-slate-400"><span>Profit target: {money(v.targetAmount, a.currency, 2)} ({pct(a.stage.profitTargetPct)})</span><span>{Math.round(v.targetProgressPct ?? 0)}%</span></div><Progress value={v.targetProgressPct ?? 0} label="Profit target progress" /></div>}
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {[['Daily drawdown', v.dailyRemaining, v.dailyLimit, v.dailyBreached], ['Overall drawdown', v.maxRemaining, v.maxLimit, v.maxBreached]].map(([k, rem, lim, br]) => (
                <div key={k as string}><div className="mb-1 flex justify-between text-sm text-slate-400"><span>{k} remaining</span><span>{money(rem as string, a.currency, 2)} of {money(lim as string, a.currency, 2)}</span></div>
                  <Progress value={Number(lim) ? (Number(rem) / Number(lim)) * 100 : 0} label={`${k} remaining`} tone={br ? 'red' : Number(rem) / Number(lim) < 0.3 ? 'amber' : 'green'} /></div>))}
            </div>
            {(v.dailyBreached || v.maxBreached) && <Alert tone="error" className="mt-5">A drawdown limit has been reached on the latest data.</Alert>}
          </Card>
          {a.curve.length > 1 && <Card className="mt-6 p-6"><h2 className="mb-4 font-bold">Balance & equity</h2><Suspense fallback={<PageLoader />}><EquityChart data={a.curve} /></Suspense></Card>}
        </>
      ) : <EmptyState icon={<Wallet className="h-10 w-10" />} title={a.status === 'PENDING_PROVISIONING' ? 'Account pending provisioning' : 'No metrics yet'} >Balances, equity and progress appear here once verified data is available for this account.</EmptyState>}

      {a.rules && <Card className="mt-6 p-6"><h2 className="font-bold">Trading rules</h2><dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        {[['Daily drawdown', pct(a.rules.dailyDrawdownPct)], ['Max drawdown', pct(a.rules.maxDrawdownPct)], ['Method', drawdownLabel(a.rules.drawdownMethod)], ['Leverage', a.rules.leverage], ['Profit split', pct(a.rules.profitSplitPct)]].map(([k, val]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-white">{val}</dd></div>)}</dl>
        <Link className="mt-4 inline-block text-sm font-semibold text-brand-400 hover:underline" to={`/challenges/${a.challenge.slug}`}>View full challenge rules</Link></Card>}

      <Card className="mt-6 p-6"><h2 className="font-bold">Reward eligibility</h2>
        {elig?.eligible ? <><p className="mt-3 text-sm text-slate-300">You can request up to <strong className="text-white">{money(elig.availableAmount, a.currency, 2)}</strong>. Requests are reviewed by our team; "processed" is an internal status.</p><Button className="mt-4" loading={req.isPending} onClick={() => req.mutate()}>Request reward</Button></>
          : <><p className="mt-3 text-sm text-slate-400">Not currently eligible:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{elig?.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>}
        {a.rewards.length > 0 && <ul className="mt-4 space-y-1 text-sm text-slate-400">{a.rewards.map((r) => <li key={r.id}>{date(r.createdAt)} — {money(r.amount, a.currency, 2)} <Badge tone={statusTone(r.status)}>{label(r.status)}</Badge></li>)}</ul>}</Card>

      {a.trades.length > 0 && <div className="mt-6"><h2 className="mb-3 font-bold">Recent trades</h2><TableWrap caption="Recent trades"><thead><tr><Th>Pair</Th><Th>Side</Th><Th>Volume</Th><Th>P/L</Th><Th>Opened</Th></tr></thead><tbody>{a.trades.map((t) => <tr key={t.id}><Td className="font-semibold">{t.symbol}</Td><Td>{t.side}</Td><Td>{t.volume}</Td><Td className={Number(t.profit) >= 0 ? 'text-brand-300' : 'text-red-300'}>{money(t.profit, a.currency, 2)}</Td><Td>{dateTime(t.openedAt)}</Td></tr>)}</tbody></TableWrap></div>}
      <div className="mt-6"><h2 className="mb-3 font-bold">Phase history</h2><ul className="space-y-2 text-sm">{a.history.map((h) => <li key={h.id} className="card flex flex-wrap justify-between gap-2 px-4 py-3"><span>{label(h.phase)} · {label(h.status)} {h.note && <span className="text-slate-400">— {h.note}</span>}</span><span className="text-slate-500">{dateTime(h.createdAt)}</span></li>)}</ul></div>
    </>
  );
}

export function Orders() {
  const { data, isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get<Array<{ id: string; orderNumber: string; status: string; total: string; currency: string; createdAt: string; items: string[] }>>('/me/orders')).data });
  if (isLoading) return <PageLoader />;
  return (<><Title sub="Your purchases and their payment status.">Orders</Title>{error && <Alert tone="error">{errorText(error)}</Alert>}
    {data?.length === 0 ? <EmptyState icon={<CreditCard className="h-10 w-10" />} title="No orders yet" action={<ButtonLink to="/challenges">Explore challenges</ButtonLink>} />
      : <TableWrap caption="Orders"><thead><tr><Th>Order</Th><Th>Items</Th><Th>Date</Th><Th>Total</Th><Th>Status</Th></tr></thead><tbody>{data?.map((o) => <tr key={o.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/dashboard/orders/${o.id}`}>{o.orderNumber}</Link></Td><Td>{o.items.join(', ')}</Td><Td>{date(o.createdAt)}</Td><Td>{money(o.total, o.currency, 2)}</Td><Td><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></Td></tr>)}</tbody></TableWrap>}</>);
}

export function OrderDetail() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const { data: site } = useSite(); const [err, setErr] = useState<string | null>(null);
  const { data: o, isLoading, error } = useQuery({ queryKey: ['order', id], staleTime: 0, refetchOnMount: 'always', refetchInterval: (q) => (q.state.data?.status === 'AWAITING_PAYMENT' ? 3000 : false), queryFn: async () => (await api.get<{ orderNumber: string; status: string; total: string; currency: string; createdAt: string; paidAt: string | null; items: Array<{ id: string; description: string; unitPrice: string }>; events: Array<{ type: string; detail: string | null; createdAt: string }> }>(`/me/orders/${id}`)).data, retry: false });
  const pay = useMutation({ mutationFn: () => api.post<{ nextPath: string | null }>(`/orders/${id}/pay`), onSuccess: async (r) => { await qc.invalidateQueries(); nav(r.data.nextPath ?? `/dashboard/orders/${id}`); }, onError: (e) => setErr(errorText(e)) });
  if (isLoading) return <PageLoader />;
  if (error || !o) return <EmptyState title="Order not found"><Link className="text-brand-400 underline" to="/dashboard/orders">Back to orders</Link></EmptyState>;
  const payable = ['PENDING', 'AWAITING_PAYMENT', 'FAILED'].includes(o.status);
  return (
    <>
      <Link to="/dashboard/orders" className="text-sm text-slate-400 hover:text-white">← All orders</Link>
      <Title sub={`Placed ${dateTime(o.createdAt)}`}>Order {o.orderNumber}</Title>
      {o.status === 'PAID' && <Alert tone="success" title="Payment confirmed">Your account record is created and awaiting provisioning. You will be notified when it is ready.</Alert>}
      {payable && !site?.payments.configured && <Alert tone="warning" title="Payment not taken">Online payment is not configured yet, so this order is saved but unpaid.</Alert>}
      {err && <Alert tone="error" className="mt-4">{err}</Alert>}
      <Card className="mt-6 p-6"><div className="flex items-center justify-between"><h2 className="font-bold">Summary</h2><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></div>
        <ul className="mt-4 divide-y divide-line">{o.items.map((i) => <li key={i.id} className="flex justify-between py-3 text-sm"><span>{i.description}</span><span>{money(i.unitPrice, o.currency, 2)}</span></li>)}</ul>
        <div className="mt-2 flex justify-between border-t border-line pt-4"><span className="font-semibold">Total</span><span className="font-display text-2xl font-extrabold">{money(o.total, o.currency, 2)}</span></div>
        {payable && site?.payments.configured && <Button className="mt-5" loading={pay.isPending} onClick={() => pay.mutate()}>{o.status === 'FAILED' ? 'Try payment again' : 'Pay now'}</Button>}</Card>
      <h2 className="mb-3 mt-8 font-bold">History</h2><ul className="space-y-2 text-sm">{o.events.map((e, i) => <li key={i} className="card flex flex-wrap justify-between gap-2 px-4 py-3"><span>{label(e.type)}{e.detail && <span className="text-slate-400"> — {e.detail}</span>}</span><span className="text-slate-500">{dateTime(e.createdAt)}</span></li>)}</ul>
    </>
  );
}

export function Rewards() {
  const { data, isLoading } = useList<Array<{ id: string; accountRef: string; amount: string; status: string; createdAt: string; reviewerNote: string | null; transferRef: string | null }>>('rewards', '/me/rewards');
  if (isLoading) return <PageLoader />;
  return (<><Title sub="Reward requests move through review. Statuses reflect our internal workflow.">Rewards</Title>
    <Alert tone="info" className="mb-6">A "processed" status means the request completed our internal workflow. A payout reference is shown only when an external transfer has been recorded.</Alert>
    {data?.length === 0 ? <EmptyState icon={<Gift className="h-10 w-10" />} title="No reward requests" action={<ButtonLink to="/dashboard/accounts" variant="secondary">View accounts</ButtonLink>}>When an account becomes eligible you can request a reward from its detail page.</EmptyState>
      : <TableWrap caption="Reward requests"><thead><tr><Th>Date</Th><Th>Account</Th><Th>Amount</Th><Th>Status</Th><Th>Note</Th></tr></thead><tbody>{data?.map((r) => <tr key={r.id}><Td>{date(r.createdAt)}</Td><Td>{r.accountRef}</Td><Td>{money(r.amount, 'USD', 2)}</Td><Td><Badge tone={statusTone(r.status)}>{label(r.status)}</Badge></Td><Td className="text-slate-400">{r.reviewerNote ?? '—'}{r.transferRef ? ` · Ref ${r.transferRef}` : ''}</Td></tr>)}</tbody></TableWrap>}</>);
}

export function Support() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data, isLoading } = useList<Array<{ id: string; ticketNo: string; subject: string; status: string; updatedAt: string }>>('tickets', '/me/tickets');
  const form = useForm<{ subject: string; message: string }>({ resolver: zodResolver(z.object({ subject: z.string().trim().min(3, 'At least 3 characters').max(150), message: z.string().trim().min(10, 'At least 10 characters').max(4000) })) });
  const create = useMutation({ mutationFn: (v: { subject: string; message: string }) => api.post('/me/tickets', v), onSuccess: () => { toast('success', 'Support request created.'); form.reset(); qc.invalidateQueries({ queryKey: ['tickets'] }); }, onError: (e) => toast('error', errorText(e)) });
  if (isLoading) return <PageLoader />;
  return (<><Title sub="Open a request or follow up on an existing one.">Support</Title>
    <Card className="p-6"><h2 className="font-bold">New request</h2><form className="mt-4 space-y-4" noValidate onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <Input id="t-sub" label="Subject" error={form.formState.errors.subject?.message} {...form.register('subject')} /><Textarea id="t-msg" label="Message" error={form.formState.errors.message?.message} {...form.register('message')} /><Button type="submit" loading={create.isPending}>Submit request</Button></form></Card>
    <h2 className="mb-3 mt-8 font-bold">Your requests</h2>
    {data?.length === 0 ? <EmptyState icon={<LifeBuoy className="h-10 w-10" />} title="No support requests" /> : <TableWrap caption="Support requests"><thead><tr><Th>Reference</Th><Th>Subject</Th><Th>Status</Th><Th>Updated</Th></tr></thead><tbody>{data?.map((t) => <tr key={t.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/dashboard/support/${t.id}`}>{t.ticketNo}</Link></Td><Td>{t.subject}</Td><Td><Badge tone={statusTone(t.status)}>{label(t.status)}</Badge></Td><Td>{dateTime(t.updatedAt)}</Td></tr>)}</tbody></TableWrap>}</>);
}

export function TicketDetail() {
  const { id } = useParams(); const qc = useQueryClient(); const [body, setBody] = useState('');
  const { data: t, isLoading, error } = useQuery({ queryKey: ['ticket', id], queryFn: async () => (await api.get<{ ticketNo: string; subject: string; status: string; messages: Array<{ id: string; body: string; isStaff: boolean; createdAt: string }> }>(`/me/tickets/${id}`)).data, retry: false });
  const send = useMutation({ mutationFn: () => api.post(`/me/tickets/${id}/messages`, { body }), onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['ticket', id] }); } });
  if (isLoading) return <PageLoader />;
  if (error || !t) return <EmptyState title="Request not found"><Link className="text-brand-400 underline" to="/dashboard/support">Back</Link></EmptyState>;
  return (<><Link to="/dashboard/support" className="text-sm text-slate-400 hover:text-white">← Support</Link><Title sub={t.ticketNo}>{t.subject}</Title><Badge tone={statusTone(t.status)}>{label(t.status)}</Badge>
    <ul className="mt-6 space-y-3">{t.messages.map((m) => <li key={m.id} className={`card p-4 text-sm ${m.isStaff ? 'border-brand-500/40' : ''}`}><p className="mb-1 text-xs font-bold text-slate-500">{m.isStaff ? 'iSoftStone support' : 'You'} · {dateTime(m.createdAt)}</p><p className="whitespace-pre-wrap leading-6">{m.body}</p></li>)}</ul>
    {t.status !== 'CLOSED' && <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}><Textarea id="reply" label="Reply" value={body} onChange={(e) => setBody(e.target.value)} /><Button type="submit" loading={send.isPending} disabled={!body.trim()}>Send reply</Button></form>}</>);
}

export function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useList<Array<{ id: string; title: string; body: string; readAt: string | null; createdAt: string }>>('notifications', '/me/notifications');
  const readAll = useMutation({ mutationFn: () => api.post('/me/notifications/read-all'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); } });
  if (isLoading) return <PageLoader />;
  return (<><div className="flex flex-wrap items-start justify-between gap-3"><Title sub="Updates about your orders, accounts, rewards and support.">Notifications</Title>{data?.some((n) => !n.readAt) && <Button variant="secondary" size="sm" onClick={() => readAll.mutate()}>Mark all read</Button>}</div>
    {data?.length === 0 ? <EmptyState icon={<Bell className="h-10 w-10" />} title="You're all caught up" /> : <ul className="space-y-3">{data?.map((n) => <li key={n.id} className={`card p-4 ${n.readAt ? 'opacity-70' : 'border-brand-500/40'}`}><div className="flex justify-between gap-3"><p className="font-semibold text-white">{n.title}</p><span className="text-xs text-slate-500">{dateTime(n.createdAt)}</span></div><p className="mt-1 text-sm text-slate-300">{n.body}</p></li>)}</ul>}</>);
}

export function Profile() {
  const { user, refresh } = useAuth(); const { toast } = useToast(); const { data: site } = useSite();
  const pf = useForm<{ firstName: string; lastName: string; country: string; phone: string }>({ defaultValues: { firstName: user?.profile?.firstName ?? '', lastName: user?.profile?.lastName ?? '', country: user?.profile?.country ?? '', phone: user?.profile?.phone ?? '' } });
  const save = useMutation({ mutationFn: (v: { firstName: string; lastName: string; country: string; phone: string }) => api.patch('/me/profile', { firstName: v.firstName, lastName: v.lastName, country: v.country ? v.country : null, phone: v.phone ? v.phone : null }), onSuccess: () => { toast('success', 'Profile updated.'); refresh(); }, onError: (e) => toast('error', errorText(e)) });
  const cp = useForm<{ currentPassword: string; newPassword: string }>({ resolver: zodResolver(z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: z.string().min(10, 'At least 10 characters').refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include a letter and a number') })) });
  const change = useMutation({ mutationFn: (v: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', v), onSuccess: () => { toast('success', 'Password changed. Other sessions were signed out.'); cp.reset(); }, onError: (e) => toast('error', errorText(e)) });
  const resend = useMutation({ mutationFn: () => api.post('/auth/resend-verification'), onSuccess: () => toast('success', site?.emailDelivery ? 'Verification email sent.' : 'Email delivery is not configured yet, so no email could be sent.') });
  return (
    <><Title sub="Manage your details, password and verification.">Profile & security</Title>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><h2 className="font-bold">Profile</h2><form className="mt-4 space-y-4" onSubmit={pf.handleSubmit((v) => save.mutate(v))}>
          <div className="grid gap-4 sm:grid-cols-2"><Input id="p-fn" label="First name" {...pf.register('firstName')} /><Input id="p-ln" label="Last name" {...pf.register('lastName')} /></div>
          <Input id="p-email" label="Email" value={user?.email ?? ''} readOnly disabled /><div className="grid gap-4 sm:grid-cols-2"><Input id="p-c" label="Country code" maxLength={2} {...pf.register('country')} /><Input id="p-ph" label="Phone" {...pf.register('phone')} /></div>
          <Button type="submit" loading={save.isPending}>Save changes</Button></form></Card>
        <div className="space-y-6">
          <Card className="p-6"><h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-brand-400" aria-hidden /> Verification</h2>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd>{user?.emailVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Not verified</Badge>}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Identity verification</dt><dd><Badge tone={statusTone(user?.verificationStatus ?? '')}>{label(user?.verificationStatus ?? 'NOT_STARTED')}</Badge></dd></div></dl>
            {!user?.emailVerified && <Button variant="secondary" size="sm" className="mt-4" loading={resend.isPending} onClick={() => resend.mutate()}>Resend verification email</Button>}
            <p className="mt-4 text-xs text-slate-500">Identity verification is handled by our team and is required before reward requests can be reviewed.</p></Card>
          <Card className="p-6"><h2 className="font-bold">Change password</h2><form className="mt-4 space-y-4" noValidate onSubmit={cp.handleSubmit((v) => change.mutate(v))}>
            <Input id="cp-cur" label="Current password" type="password" autoComplete="current-password" error={cp.formState.errors.currentPassword?.message} {...cp.register('currentPassword')} />
            <Input id="cp-new" label="New password" type="password" autoComplete="new-password" error={cp.formState.errors.newPassword?.message} {...cp.register('newPassword')} /><Button type="submit" loading={change.isPending}>Update password</Button></form>
            <p className="mt-4 text-xs text-slate-500">Two-factor authentication is planned and not yet available.</p></Card>
        </div>
      </div></>
  );
}
