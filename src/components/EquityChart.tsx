import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, dateTime } from '@/lib/format';

export default function EquityChart({ data }: { data: Array<{ balance: string; equity: string; capturedAt: string }> }) {
  const rows = data.map((d) => ({ t: d.capturedAt, balance: Number(d.balance), equity: Number(d.equity) }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Balance and equity over time">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs><linearGradient id="bal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#25324B" vertical={false} />
          <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} stroke="#64748B" fontSize={12} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => money(v)} stroke="#64748B" fontSize={12} width={70} />
          <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #25324B', borderRadius: 8 }} labelFormatter={(v) => dateTime(v as string)} formatter={(v: number) => money(v, 'USD', 2)} />
          <Area type="monotone" dataKey="balance" name="Balance" stroke="#10B981" fill="url(#bal)" strokeWidth={2} />
          <Area type="monotone" dataKey="equity" name="Equity" stroke="#60A5FA" fill="none" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
