import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function PriceChart({ points, pair }: { points: Array<{ date: string; rate: number }>; pair: string }) {
  const digits = pair.includes('JPY') ? 3 : 5;
  const up = points.length > 1 && points[points.length - 1].rate >= points[0].rate;
  const color = up ? '#10B981' : '#F87171';
  return (
    <div className="h-72 w-full sm:h-96" role="img" aria-label={`${pair} daily reference rate chart from ${points[0]?.date} to ${points[points.length - 1]?.date}`}>
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs><linearGradient id="px" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#25324B" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} stroke="#64748B" fontSize={12} minTickGap={32} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(pair.includes('JPY') ? 2 : 4)} stroke="#64748B" fontSize={12} width={64} />
          <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #25324B', borderRadius: 8 }} labelFormatter={(v) => new Date(v as string).toLocaleDateString('en-GB', { dateStyle: 'medium' })} formatter={(v: number) => [v.toFixed(digits), 'Rate']} />
          <Area type="monotone" dataKey="rate" stroke={color} fill="url(#px)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
