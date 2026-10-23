import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { BarChart3, ClipboardList, CreditCard, Gift, LayoutDashboard, LifeBuoy, Package, Settings as Cog, ShieldAlert, Users, Wallet } from 'lucide-react';
import { api, errorText } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { Alert, Badge, Button, ButtonLink, Card, Checkbox, EmptyState, Input, PageLoader, Select, statusTone, TableWrap, Td, Textarea, Th } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSite } from '@/hooks/useSite';
import { useAuth } from '@/hooks/useAuth';
import { date, dateTime, label, modelLabel, money } from '@/lib/format';

const nav: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, perm: 'admin:overview' }, { to: '/admin/challenges', label: 'Challenges', icon: Package, perm: 'challenges:manage' },
  { to: '/admin/customers', label: 'Customers', icon: Users, perm: 'customers:read' }, { to: '/admin/orders', label: 'Orders', icon: CreditCard, perm: 'orders:read' },
  { to: '/admin/accounts', label: 'Accounts', icon: Wallet, perm: 'accounts:manage' }, { to: '/admin/rewards', label: 'Rewards', icon: Gift, perm: 'rewards:review' },
  { to: '/admin/support', label: 'Support', icon: LifeBuoy, perm: 'support:manage' }, { to: '/admin/audit', label: 'Audit log', icon: ClipboardList, perm: 'audit:read' },
  { to: '/admin/settings', label: 'Settings', icon: Cog, perm: 'site:manage' },
];
export const AdminShell = () => <AppShell title="Admin" items={nav} requirePerm="admin:overview" />;

const useGet = <T,>(key: unknown[], path: string) => useQuery({ queryKey: key, queryFn: async () => (await api.get<T>(path)).data });
const Title = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => <header className="mb-8 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">{children}</h1>{action}</header>;
const Stat = ({ k, v }: { k: string; v: React.ReactNode }) => <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{k}</p><p className="mt-2 font-display text-3xl font-extrabold">{v}</p></Card>;

export function AdminOverview() {
  const { data, isLoading, error } = useGet<Record<string, any>>(['admin', 'overview'], '/admin/overview');
  if (isLoading) return <PageLoader />; if (error || !data) return <Alert tone="error">{errorText(error)}</Alert>;
  return (<><Title>Overview</Title>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat k="Customers" v={data.customers} /><Stat k="Orders" v={data.orders} /><Stat k="Paid orders" v={data.paidOrders} /><Stat k="Failed payments" v={data.failedOrders} /><Stat k="Published challenges" v={data.publishedChallenges} /><Stat k="Open tickets" v={data.openTickets} /><Stat k="Account records" v={data.accounts} /><Stat k="Pending rewards" v={data.pendingRewards} /></div>
    <h2 className="mb-3 mt-10 text-xl font-bold">Operational alerts</h2>
    {data.alerts.length === 0 ? <p className="text-sm text-slate-400">No alerts.</p> : <ul className="space-y-2">{data.alerts.map((a: string) => <li key={a}><Alert tone="warning">{a}</Alert></li>)}</ul>}
    <h2 className="mb-3 mt-10 text-xl font-bold">Recent registrations</h2>
    <TableWrap caption="Recent registrations"><thead><tr><Th>Email</Th><Th>Registered</Th></tr></thead><tbody>{data.recentRegistrations.map((u: any) => <tr key={u.id}><Td><Link className="text-brand-300 hover:underline" to={`/admin/customers/${u.id}`}>{u.email}</Link></Td><Td>{dateTime(u.createdAt)}</Td></tr>)}</tbody></TableWrap></>);
}

export function AdminChallenges() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data, isLoading } = useGet<Array<{ id: string; slug: string; name: string; model: string; status: string; isDraftTerms: boolean }>>(['admin', 'challenges'], '/admin/challenges');
  const act = useMutation({ mutationFn: ({ id, a }: { id: string; a: string }) => api.post(`/admin/challenges/${id}/${a}`), onSuccess: () => { toast('success', 'Updated.'); qc.invalidateQueries({ queryKey: ['admin', 'challenges'] }); qc.invalidateQueries({ queryKey: ['challenges'] }); }, onError: (e) => toast('error', errorText(e)) });
  if (isLoading) return <PageLoader />;
  return (<><Title action={<ButtonLink to="/admin/challenges/new">New challenge</ButtonLink>}>Challenges</Title>
    <Alert tone="info" className="mb-6">Products are forex-only. Futures, indices, commodities, equities and crypto are rejected by the server. Approve a challenge only when its commercial terms are final.</Alert>
    <TableWrap caption="Challenges"><thead><tr><Th>Name</Th><Th>Model</Th><Th>Status</Th><Th>Terms</Th><Th>Actions</Th></tr></thead><tbody>
      {data?.map((c) => <tr key={c.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/admin/challenges/${c.id}`}>{c.name}</Link><p className="text-xs text-slate-500">{c.slug}</p></Td><Td>{modelLabel(c.model)}</Td><Td><Badge tone={statusTone(c.status)}>{label(c.status)}</Badge></Td><Td>{c.isDraftTerms ? <Badge tone="amber">Draft</Badge> : <Badge tone="green">Approved</Badge>}</Td>
        <Td><div className="flex flex-wrap gap-2">{c.status === 'PUBLISHED' ? <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: c.id, a: 'unpublish' })}>Unpublish</Button> : <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: c.id, a: 'publish' })}>Publish</Button>}{c.isDraftTerms && <Button size="sm" onClick={() => window.confirm('Approve these terms as final? This makes the offer purchasable in production.') && act.mutate({ id: c.id, a: 'approve' })}>Approve terms</Button>}</div></Td></tr>)}</tbody></TableWrap></>);
}

type Form = {
  slug: string; name: string; model: 'ONE_STEP' | 'TWO_STEP' | 'INSTANT'; tagline: string; description: string; sortOrder: number;
  stages: Array<{ name: string; profitTargetPct: string; minTradingDays: number; maxDays: string }>;
  rules: { dailyDrawdownPct: string; maxDrawdownPct: string; drawdownMethod: string; leverage: string; profitSplitPct: string; newsTradingAllowed: boolean; weekendHoldingAllowed: boolean; overnightHoldingAllowed: boolean; eaAllowed: boolean; copyTradingAllowed: boolean; rewardMinAmount: string; notes: string };
  sizes: Array<{ accountSize: string; price: string; active: boolean }>; instruments: string[];
};
const blank: Form = { slug: '', name: '', model: 'ONE_STEP', tagline: '', description: '', sortOrder: 0, stages: [{ name: 'Evaluation', profitTargetPct: '10', minTradingDays: 4, maxDays: '' }],
  rules: { dailyDrawdownPct: '4', maxDrawdownPct: '8', drawdownMethod: 'BALANCE_BASED', leverage: '1:100', profitSplitPct: '80', newsTradingAllowed: true, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false, rewardMinAmount: '50', notes: '' },
  sizes: [{ accountSize: '10000', price: '99', active: true }], instruments: ['EUR/USD', 'GBP/USD', 'USD/JPY'] };

export function ChallengeEditor() {
  const { id } = useParams(); const isNew = !id || id === 'new'; const nav = useNavigate(); const qc = useQueryClient(); const { toast } = useToast();
  const existing = useQuery({ queryKey: ['admin', 'challenge', id], enabled: !isNew, queryFn: async () => (await api.get<Challenge>(`/admin/challenges/${id}`)).data });
  const instruments = useGet<string[]>(['instruments'], '/instruments');
  if (!isNew && existing.isLoading) return <PageLoader />;
  const init: Form = existing.data ? {
    slug: existing.data.slug, name: existing.data.name, model: existing.data.model, tagline: existing.data.tagline, description: existing.data.description, sortOrder: 0,
    stages: existing.data.stages.map((s) => ({ name: s.name, profitTargetPct: String(Number(s.profitTargetPct)), minTradingDays: s.minTradingDays, maxDays: s.maxDays ? String(s.maxDays) : '' })),
    rules: { ...existing.data.rules!, dailyDrawdownPct: String(Number(existing.data.rules!.dailyDrawdownPct)), maxDrawdownPct: String(Number(existing.data.rules!.maxDrawdownPct)), profitSplitPct: String(Number(existing.data.rules!.profitSplitPct)), rewardMinAmount: String(Number(existing.data.rules!.rewardMinAmount)), notes: existing.data.rules!.notes ?? '' },
    sizes: existing.data.sizes.map((s) => ({ accountSize: String(Number(s.accountSize)), price: String(Number(s.price)), active: s.active })), instruments: existing.data.instruments,
  } : blank;
  return <EditorForm key={id ?? 'new'} init={init} instruments={instruments.data ?? []} isNew={isNew} onSave={async (body) => {
    try { const r = isNew ? await api.post<Challenge>('/admin/challenges', body) : await api.put<Challenge>(`/admin/challenges/${id}`, body); toast('success', 'Challenge saved. Terms are marked as draft until approved.'); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['challenges'] }); nav(`/admin/challenges/${r.data.id}`); } catch (e) { toast('error', errorText(e)); }
  }} />;
}

function EditorForm({ init, instruments, isNew, onSave }: { init: Form; instruments: string[]; isNew: boolean; onSave: (b: unknown) => Promise<void> }) {
  const { register, control, handleSubmit, watch, formState: { isSubmitting } } = useForm<Form>({ defaultValues: init });
  const stages = useFieldArray({ control, name: 'stages' }); const sizes = useFieldArray({ control, name: 'sizes' });
  const model = watch('model'); const expected = { ONE_STEP: 1, TWO_STEP: 2, INSTANT: 0 }[model];
  const submit = handleSubmit((v) => onSave({
    ...v, sortOrder: Number(v.sortOrder) || 0,
    stages: v.stages.map((s) => ({ name: s.name, profitTargetPct: s.profitTargetPct, minTradingDays: Number(s.minTradingDays) || 0, maxDays: s.maxDays ? Number(s.maxDays) : null })),
    rules: { ...v.rules, notes: v.rules.notes || null }, sizes: v.sizes.map((s) => ({ accountSize: s.accountSize, price: s.price, active: s.active })),
  }));
  return (
    <form onSubmit={submit} className="space-y-6">
      <Title action={<div className="flex gap-2"><ButtonLink to="/admin/challenges" variant="secondary">Cancel</ButtonLink><Button type="submit" loading={isSubmitting}>Save</Button></div>}>{isNew ? 'New challenge' : 'Edit challenge'}</Title>
      <Alert tone="info">Saving resets the terms to "draft" so changed commercial values must be re-approved. All content is validated on the server and must be forex-only.</Alert>
      <Card className="space-y-4 p-6"><h2 className="font-bold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2"><Input id="e-name" label="Name" {...register('name', { required: true })} /><Input id="e-slug" label="URL slug" hint="lowercase-with-dashes" {...register('slug', { required: true })} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Select id="e-model" label="Model" {...register('model')}><option value="ONE_STEP">One-step</option><option value="TWO_STEP">Two-step</option><option value="INSTANT">Instant</option></Select><Input id="e-order" label="Sort order" type="number" {...register('sortOrder', { valueAsNumber: true })} /></div>
        <Input id="e-tag" label="Tagline" {...register('tagline', { required: true })} /><Textarea id="e-desc" label="Description" {...register('description', { required: true })} /></Card>
      <Card className="space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="font-bold">Evaluation stages <span className="text-sm font-normal text-slate-400">(this model needs {expected})</span></h2><Button type="button" size="sm" variant="secondary" onClick={() => stages.append({ name: `Phase ${stages.fields.length + 1}`, profitTargetPct: '5', minTradingDays: 4, maxDays: '' })}>Add stage</Button></div>
        {stages.fields.map((f, i) => <div key={f.id} className="grid items-end gap-3 sm:grid-cols-5"><Input id={`s-n${i}`} label="Name" {...register(`stages.${i}.name`)} /><Input id={`s-t${i}`} label="Target %" {...register(`stages.${i}.profitTargetPct`)} /><Input id={`s-d${i}`} label="Min days" type="number" {...register(`stages.${i}.minTradingDays`)} /><Input id={`s-m${i}`} label="Max days" {...register(`stages.${i}.maxDays`)} /><Button type="button" variant="ghost" onClick={() => stages.remove(i)}>Remove</Button></div>)}</Card>
      <Card className="space-y-4 p-6"><h2 className="font-bold">Rules</h2>
        <div className="grid gap-4 sm:grid-cols-3"><Input id="r-dd" label="Daily drawdown %" {...register('rules.dailyDrawdownPct')} /><Input id="r-md" label="Max drawdown %" {...register('rules.maxDrawdownPct')} /><Select id="r-m" label="Drawdown method" {...register('rules.drawdownMethod')}><option value="BALANCE_BASED">Balance-based</option><option value="EQUITY_BASED">Equity-based</option><option value="TRAILING">Trailing</option></Select>
          <Input id="r-lev" label="Leverage (1:N)" {...register('rules.leverage')} /><Input id="r-ps" label="Profit split %" {...register('rules.profitSplitPct')} /><Input id="r-rm" label="Min reward request" {...register('rules.rewardMinAmount')} /></div>
        <div className="grid gap-3 sm:grid-cols-3"><Checkbox id="r-n" label="News trading allowed" {...register('rules.newsTradingAllowed')} /><Checkbox id="r-w" label="Weekend holding allowed" {...register('rules.weekendHoldingAllowed')} /><Checkbox id="r-o" label="Overnight holding allowed" {...register('rules.overnightHoldingAllowed')} /><Checkbox id="r-e" label="Expert advisors allowed" {...register('rules.eaAllowed')} /><Checkbox id="r-c" label="Copy trading allowed" {...register('rules.copyTradingAllowed')} /></div>
        <Textarea id="r-notes" label="Notes (optional)" {...register('rules.notes')} /></Card>
      <Card className="space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="font-bold">Account sizes & prices</h2><Button type="button" size="sm" variant="secondary" onClick={() => sizes.append({ accountSize: '', price: '', active: true })}>Add size</Button></div>
        {sizes.fields.map((f, i) => <div key={f.id} className="grid items-end gap-3 sm:grid-cols-4"><Input id={`z-s${i}`} label="Account size (USD)" {...register(`sizes.${i}.accountSize`)} /><Input id={`z-p${i}`} label="Price (USD)" {...register(`sizes.${i}.price`)} /><Checkbox id={`z-a${i}`} label="Active" {...register(`sizes.${i}.active`)} /><Button type="button" variant="ghost" onClick={() => sizes.remove(i)}>Remove</Button></div>)}</Card>
      <Card className="p-6"><h2 className="font-bold">Approved forex instruments</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{instruments.map((s) => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" value={s} className="accent-emerald-500" {...register('instruments')} />{s}</label>)}</div></Card>
    </form>
  );
}

const Pager = ({ meta, page, setPage }: { meta?: { total: number; pageSize: number }; page: number; setPage: (n: number) => void }) => meta && meta.total > meta.pageSize ? (
  <div className="mt-4 flex items-center justify-between text-sm text-slate-400"><span>{meta.total} total</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page * meta.pageSize >= meta.total} onClick={() => setPage(page + 1)}>Next</Button></div></div>) : null;

function usePaged<T>(key: string, path: string, extra = '') {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin', key, page, extra], queryFn: async () => { const r = await api.get<T[]>(`${path}${path.includes('?') ? '&' : '?'}page=${page}${extra}`); return r; }, placeholderData: (p) => p });
  return { ...q, rows: q.data?.data ?? [], meta: q.data?.meta, page, setPage };
}

export function AdminCustomers() {
  const [q, setQ] = useState(''); const [term, setTerm] = useState('');
  const { rows, meta, page, setPage, isLoading } = usePaged<any>('customers', '/admin/customers', term ? `&q=${encodeURIComponent(term)}` : '');
  return (<><Title>Customers</Title><form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); setPage(1); }}><div className="flex-1"><Input id="cs" label="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div><Button type="submit" className="self-end">Search</Button></form>
    {isLoading ? <PageLoader /> : <TableWrap caption="Customers"><thead><tr><Th>Customer</Th><Th>Role</Th><Th>Status</Th><Th>Verification</Th><Th>Joined</Th></tr></thead><tbody>{rows.map((c: any) => <tr key={c.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/admin/customers/${c.id}`}>{c.email}</Link><p className="text-xs text-slate-500">{c.firstName} {c.lastName}</p></Td><Td>{c.role}</Td><Td><Badge tone={statusTone(c.status)}>{label(c.status)}</Badge></Td><Td><Badge tone={statusTone(c.verificationStatus)}>{label(c.verificationStatus)}</Badge></Td><Td>{date(c.createdAt)}</Td></tr>)}</tbody></TableWrap>}
    <Pager meta={meta} page={page} setPage={setPage} /></>);
}

export function AdminCustomer() {
  const { id } = useParams(); const qc = useQueryClient(); const { toast } = useToast(); const { can } = useAuth();
  const { data: c, isLoading } = useGet<any>(['admin', 'customer', id], `/admin/customers/${id}`);
  const upd = useMutation({ mutationFn: (b: object) => api.patch(`/admin/customers/${id}`, b), onSuccess: () => { toast('success', 'Customer updated.'); qc.invalidateQueries({ queryKey: ['admin'] }); }, onError: (e) => toast('error', errorText(e)) });
  const role = useMutation({ mutationFn: (r: string) => api.patch(`/admin/customers/${id}/role`, { role: r }), onSuccess: () => { toast('success', 'Role updated; the user must sign in again.'); qc.invalidateQueries({ queryKey: ['admin'] }); }, onError: (e) => toast('error', errorText(e)) });
  if (isLoading || !c) return <PageLoader />;
  return (<><Link to="/admin/customers" className="text-sm text-slate-400 hover:text-white">← Customers</Link><Title>{c.email}</Title>
    <div className="grid gap-6 lg:grid-cols-2"><Card className="space-y-4 p-6"><h2 className="font-bold">Account</h2>
      <p className="text-sm text-slate-400">{c.profile?.firstName} {c.profile?.lastName} · joined {date(c.createdAt)} · last login {dateTime(c.lastLoginAt)}</p>
      <div className="grid gap-4 sm:grid-cols-2"><Select id="cu-st" label="Status" value={c.status} onChange={(e) => window.confirm(`Set status to ${e.target.value}?`) && upd.mutate({ status: e.target.value })} disabled={!can('customers:manage')}><option>ACTIVE</option><option>SUSPENDED</option><option>CLOSED</option></Select>
        <Select id="cu-v" label="Identity verification" value={c.verificationStatus} onChange={(e) => upd.mutate({ verificationStatus: e.target.value })} disabled={!can('customers:manage')}>{['NOT_STARTED', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => <option key={s}>{s}</option>)}</Select></div>
      {can('roles:manage') && <Select id="cu-r" label="Role" value={c.role} onChange={(e) => window.confirm(`Change role to ${e.target.value}?`) && role.mutate(e.target.value)}>{['customer', 'support', 'admin'].map((s) => <option key={s}>{s}</option>)}</Select>}</Card>
      <Card className="p-6"><h2 className="font-bold">Accounts ({c.accounts.length})</h2><ul className="mt-3 space-y-2 text-sm">{c.accounts.map((a: any) => <li key={a.id} className="flex justify-between"><span>{a.accountRef} · {money(a.startingBalance)}</span><Badge tone={statusTone(a.status)}>{label(a.status)}</Badge></li>)}{c.accounts.length === 0 && <li className="text-slate-500">None</li>}</ul></Card></div>
    <h2 className="mb-3 mt-8 font-bold">Orders</h2><TableWrap caption="Customer orders"><thead><tr><Th>Order</Th><Th>Total</Th><Th>Status</Th><Th>Date</Th></tr></thead><tbody>{c.orders.map((o: any) => <tr key={o.id}><Td><Link className="text-brand-300 hover:underline" to={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></Td><Td>{money(o.total, o.currency, 2)}</Td><Td><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></Td><Td>{date(o.createdAt)}</Td></tr>)}</tbody></TableWrap>
    <h2 className="mb-3 mt-8 font-bold">Support history</h2><ul className="space-y-2 text-sm">{c.tickets.map((t: any) => <li key={t.id}><Link className="text-brand-300 hover:underline" to={`/admin/support/${t.id}`}>{t.ticketNo}</Link> — {t.subject} <Badge tone={statusTone(t.status)}>{label(t.status)}</Badge></li>)}{c.tickets.length === 0 && <li className="text-slate-500">None</li>}</ul></>);
}

export function AdminOrders() {
  const [status, setStatus] = useState('');
  const { rows, meta, page, setPage, isLoading } = usePaged<any>('orders', '/admin/orders', status ? `&status=${status}` : '');
  return (<><Title>Orders</Title><Alert tone="info" className="mb-4">Payment state changes only through verified provider webhooks. There is intentionally no manual "mark as paid" action.</Alert>
    <div className="mb-4 max-w-xs"><Select id="os" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option>{['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
    {isLoading ? <PageLoader /> : <TableWrap caption="Orders"><thead><tr><Th>Order</Th><Th>Customer</Th><Th>Total</Th><Th>Status</Th><Th>Date</Th></tr></thead><tbody>{rows.map((o: any) => <tr key={o.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></Td><Td>{o.email}</Td><Td>{money(o.total, o.currency, 2)}</Td><Td><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></Td><Td>{date(o.createdAt)}</Td></tr>)}</tbody></TableWrap>}
    <Pager meta={meta} page={page} setPage={setPage} /></>);
}
export function AdminOrder() {
  const { id } = useParams(); const { data: o, isLoading } = useGet<any>(['admin', 'order', id], `/admin/orders/${id}`);
  if (isLoading || !o) return <PageLoader />;
  return (<><Link to="/admin/orders" className="text-sm text-slate-400 hover:text-white">← Orders</Link><Title>Order {o.orderNumber}</Title>
    <Card className="p-6"><div className="flex justify-between"><span>{o.user.email}</span><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></div><ul className="mt-4 divide-y divide-line text-sm">{o.items.map((i: any) => <li key={i.id} className="flex justify-between py-2"><span>{i.description}</span><span>{money(i.unitPrice, o.currency, 2)}</span></li>)}</ul><p className="mt-3 text-right font-display text-2xl font-extrabold">{money(o.total, o.currency, 2)}</p></Card>
    <h2 className="mb-3 mt-8 font-bold">Payment attempts</h2><TableWrap caption="Payment attempts"><thead><tr><Th>Provider</Th><Th>Reference</Th><Th>Amount</Th><Th>Status</Th><Th>Created</Th></tr></thead><tbody>{o.attempts.map((a: any) => <tr key={a.id}><Td>{a.provider}</Td><Td className="font-mono text-xs">{a.providerRef ?? '—'}</Td><Td>{money(a.amount, a.currency, 2)}</Td><Td><Badge tone={statusTone(a.status === 'SUCCEEDED' ? 'PAID' : a.status)}>{label(a.status)}</Badge></Td><Td>{dateTime(a.createdAt)}</Td></tr>)}</tbody></TableWrap>
    <h2 className="mb-3 mt-8 font-bold">Event history</h2><ul className="space-y-2 text-sm">{o.events.map((e: any) => <li key={e.id} className="card flex justify-between gap-2 px-4 py-3"><span>{label(e.type)} {e.detail && <span className="text-slate-400">— {e.detail}</span>}</span><span className="text-slate-500">{dateTime(e.createdAt)}</span></li>)}</ul></>);
}

export function AdminSupport() {
  const [status, setStatus] = useState(''); const [q, setQ] = useState('');
  const { rows, meta, page, setPage, isLoading } = usePaged<any>('tickets', '/admin/tickets', `${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  return (<><Title>Support requests</Title><div className="mb-4 grid max-w-xl gap-4 sm:grid-cols-2"><Input id="ts" label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><Select id="tst" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option>{['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
    {isLoading ? <PageLoader /> : rows.length === 0 ? <EmptyState icon={<LifeBuoy className="h-10 w-10" />} title="No requests found" /> : <TableWrap caption="Support requests"><thead><tr><Th>Reference</Th><Th>From</Th><Th>Subject</Th><Th>Status</Th><Th>Updated</Th></tr></thead><tbody>{rows.map((t: any) => <tr key={t.id}><Td><Link className="font-semibold text-brand-300 hover:underline" to={`/admin/support/${t.id}`}>{t.ticketNo}</Link></Td><Td>{t.email}</Td><Td>{t.subject}</Td><Td><Badge tone={statusTone(t.status)}>{label(t.status)}</Badge></Td><Td>{dateTime(t.updatedAt)}</Td></tr>)}</tbody></TableWrap>}
    <Pager meta={meta} page={page} setPage={setPage} /></>);
}
export function AdminTicket() {
  const { id } = useParams(); const qc = useQueryClient(); const { toast } = useToast(); const [body, setBody] = useState(''); const [internal, setInternal] = useState(false);
  const { data: t, isLoading } = useGet<any>(['admin', 'ticket', id], `/admin/tickets/${id}`);
  const send = useMutation({ mutationFn: () => api.post(`/admin/tickets/${id}/messages`, { body, internal }), onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['admin'] }); toast('success', internal ? 'Internal note added.' : 'Reply sent.'); }, onError: (e) => toast('error', errorText(e)) });
  const st = useMutation({ mutationFn: (status: string) => api.patch(`/admin/tickets/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
  if (isLoading || !t) return <PageLoader />;
  return (<><Link to="/admin/support" className="text-sm text-slate-400 hover:text-white">← Support</Link><Title>{t.subject}</Title>
    <p className="mb-4 text-sm text-slate-400">{t.ticketNo} · {t.name} · {t.email}</p><div className="mb-6 max-w-xs"><Select id="tk-s" label="Status" value={t.status} onChange={(e) => st.mutate(e.target.value)}>{['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}</Select></div>
    <ul className="space-y-3">{t.messages.map((m: any) => <li key={m.id} className={`card p-4 text-sm ${m.isInternal ? 'border-amber-400/50 bg-amber-400/5' : ''}`}><p className="mb-1 text-xs font-bold text-slate-500">{m.isInternal ? 'Internal note' : m.isStaff ? 'Staff reply (visible to customer)' : 'Customer'} · {dateTime(m.createdAt)}</p><p className="whitespace-pre-wrap">{m.body}</p></li>)}</ul>
    <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}><Textarea id="tk-b" label={internal ? 'Internal note (never shown to the customer)' : 'Reply to customer'} value={body} onChange={(e) => setBody(e.target.value)} /><Checkbox id="tk-i" label="Internal note" checked={internal} onChange={(e) => setInternal(e.target.checked)} /><Button type="submit" loading={send.isPending} disabled={!body.trim()}>{internal ? 'Add note' : 'Send reply'}</Button></form></>);
}

export function AdminRewards() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data, isLoading } = useGet<any[]>(['admin', 'rewards'], '/admin/rewards');
  const review = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => api.post(`/admin/rewards/${id}/review`, { decision }), onSuccess: () => { toast('success', 'Reward request updated.'); qc.invalidateQueries({ queryKey: ['admin'] }); }, onError: (e) => toast('error', errorText(e)) });
  if (isLoading) return <PageLoader />;
  return (<><Title>Reward requests</Title><Alert tone="warning" className="mb-4" title="Workflow status only">"Processed" is an internal workflow state. No external payout integration is connected, so no funds are moved by this system.</Alert>
    {data?.length === 0 ? <EmptyState icon={<Gift className="h-10 w-10" />} title="No reward requests" /> : <TableWrap caption="Reward requests"><thead><tr><Th>Customer</Th><Th>Account</Th><Th>Amount</Th><Th>Status</Th><Th>Date</Th><Th>Actions</Th></tr></thead><tbody>{data?.map((r) => <tr key={r.id}><Td>{r.email}</Td><Td>{r.accountRef}</Td><Td>{money(r.amount, 'USD', 2)}</Td><Td><Badge tone={statusTone(r.status)}>{label(r.status)}</Badge></Td><Td>{date(r.createdAt)}</Td>
      <Td><div className="flex gap-2">{r.status === 'PENDING' && <Button size="sm" onClick={() => review.mutate({ id: r.id, decision: 'APPROVED' })}>Approve</Button>}{r.status === 'APPROVED' && <Button size="sm" onClick={() => review.mutate({ id: r.id, decision: 'PROCESSED' })}>Mark processed</Button>}{(r.status === 'PENDING' || r.status === 'APPROVED') && <Button size="sm" variant="danger" onClick={() => window.confirm('Reject this request?') && review.mutate({ id: r.id, decision: 'REJECTED' })}>Reject</Button>}</div></Td></tr>)}</tbody></TableWrap>}</>);
}

export function AdminAccounts() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data, isLoading } = useGet<any[]>(['admin', 'accounts'], '/admin/accounts');
  const upd = useMutation({ mutationFn: ({ id, ...b }: { id: string; status?: string; phase?: string }) => api.patch(`/admin/accounts/${id}`, b), onSuccess: () => { toast('success', 'Account updated and the customer was notified.'); qc.invalidateQueries({ queryKey: ['admin'] }); }, onError: (e) => toast('error', errorText(e)) });
  if (isLoading) return <PageLoader />;
  return (<><Title>Trading account records</Title><Alert tone="info" className="mb-4">Records are created automatically when a payment is confirmed. Provisioning real trading credentials requires a configured and tested trading-platform integration.</Alert>
    {data?.length === 0 ? <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="No account records yet" /> : <TableWrap caption="Accounts"><thead><tr><Th>Account</Th><Th>Customer</Th><Th>Balance</Th><Th>Status</Th><Th>Phase</Th></tr></thead><tbody>{data?.map((a) => <tr key={a.id}><Td className="font-mono text-xs">{a.accountRef}</Td><Td>{a.email}</Td><Td>{money(a.startingBalance)}</Td>
      <Td><select aria-label={`Status for ${a.accountRef}`} className="rounded-md border border-line bg-ink-800 px-2 py-1 text-sm" value={a.status} onChange={(e) => window.confirm(`Set ${a.accountRef} to ${e.target.value}?`) && upd.mutate({ id: a.id, status: e.target.value })}>{['PENDING_PROVISIONING', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'CLOSED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Td>
      <Td><select aria-label={`Phase for ${a.accountRef}`} className="rounded-md border border-line bg-ink-800 px-2 py-1 text-sm" value={a.phase} onChange={(e) => window.confirm(`Set ${a.accountRef} phase to ${e.target.value}?`) && upd.mutate({ id: a.id, phase: e.target.value })}>{['PHASE_1', 'PHASE_2', 'VERIFICATION', 'FUNDED_SIM'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Td></tr>)}</tbody></TableWrap>}</>);
}

export function AdminAudit() {
  const { rows, meta, page, setPage, isLoading } = usePaged<any>('audit', '/admin/audit');
  return (<><Title>Audit log</Title>{isLoading ? <PageLoader /> : <TableWrap caption="Audit log"><thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Detail</Th></tr></thead><tbody>{rows.map((a: any) => <tr key={a.id}><Td className="whitespace-nowrap">{dateTime(a.createdAt)}</Td><Td>{a.actor ?? 'system'}</Td><Td className="font-semibold">{a.action}</Td><Td>{a.entityType}</Td><Td className="max-w-xs truncate font-mono text-xs text-slate-400" title={JSON.stringify(a.detail)}>{a.detail ? JSON.stringify(a.detail) : '—'}</Td></tr>)}</tbody></TableWrap>}<Pager meta={meta} page={page} setPage={setPage} /></>);
}

export function AdminSettings() {
  const qc = useQueryClient(); const { toast } = useToast(); const { data: site } = useSite();
  const set = useMutation({ mutationFn: (value: boolean) => api.put('/admin/site/show-draft-offers', { value }), onSuccess: () => { toast('success', 'Setting saved.'); qc.invalidateQueries(); }, onError: (e) => toast('error', errorText(e)) });
  return (<><Title>Settings</Title>
    <Card className="p-6"><h2 className="flex items-center gap-2 font-bold"><ShieldAlert className="h-5 w-5 text-amber-300" aria-hidden /> Show draft offers publicly</h2>
      <p className="mt-2 text-sm text-slate-400">When off (recommended for production), only challenges whose terms have been <strong>approved</strong> appear publicly. When on, published challenges with placeholder terms are shown with a "draft" label — use only for demos.</p>
      <Button className="mt-4" variant={site?.showDraftOffers ? 'danger' : 'secondary'} loading={set.isPending} onClick={() => set.mutate(!site?.showDraftOffers)}>{site?.showDraftOffers ? 'Turn off draft offers' : 'Turn on draft offers'}</Button></Card>
    <Card className="mt-6 p-6"><h2 className="font-bold">Integration status</h2><ul className="mt-3 space-y-2 text-sm"><li>Payments: <Badge tone={site?.payments.configured ? 'amber' : 'slate'}>{site?.payments.mode ?? '…'}</Badge></li><li>Trading data: <Badge tone={site?.tradingData.connected ? 'amber' : 'slate'}>{site?.tradingData.connected ? (site.tradingData.demo ? 'demo fixtures' : 'connected') : 'not connected'}</Badge></li><li>Email delivery: <Badge tone={site?.emailDelivery ? 'green' : 'slate'}>{site?.emailDelivery ? 'configured' : 'not configured'}</Badge></li></ul></Card></>);
}
