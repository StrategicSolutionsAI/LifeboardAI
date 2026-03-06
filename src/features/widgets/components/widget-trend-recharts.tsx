"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';

interface Point {
  date: string;
  value: number;
  isReal?: boolean;
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, isWeight, unit }: any) {
  if (!active || !payload?.[0]) return null;
  const { date, value } = payload[0].payload;
  if (value === 0) return null;
  const formatted = new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div className="rounded-xl bg-theme-surface-overlay/95 border border-theme-neutral-300 shadow-[0px_8px_24px_rgba(163,133,96,0.12)] backdrop-blur-sm px-3 py-2">
      <p className="text-[10px] font-medium text-theme-text-tertiary uppercase tracking-wide">{formatted}</p>
      <p className="text-lg font-black tracking-tight text-theme-text-primary leading-none mt-0.5">
        {value}{isWeight ? <span className="text-xs font-medium text-theme-text-tertiary ml-1">{unit || 'lbs'}</span> : ''}
      </p>
    </div>
  );
}

export default function WidgetTrendRecharts({
  data,
  gradientId,
  isWithingsWeight,
  rangeDays,
  unit,
}: {
  data: Point[];
  gradientId: string;
  isWithingsWeight: boolean;
  rangeDays: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B1916A" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#B1916A" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#B1916A"
          strokeOpacity={0.08}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: 'var(--theme-text-subtle, #9CA3AF)' }}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
          tickFormatter={(d: string) => {
            const dt = new Date(d);
            return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }}
        />
        <YAxis hide domain={isWithingsWeight ? ['dataMin - 2', 'dataMax + 2'] : ['auto', 'auto']} />
        <Tooltip
          content={<ChartTooltip isWeight={isWithingsWeight} unit={unit} />}
          cursor={{ stroke: '#B1916A', strokeOpacity: 0.2, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#B1916A"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            if (!payload?.isReal) return <circle key={`dot-${cx}`} r={0} cx={cx} cy={cy} fill="none" />;
            return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill="#B1916A" stroke="#fff" strokeWidth={1.5} />;
          }}
          activeDot={{ r: 4, fill: '#B1916A', stroke: '#fff', strokeWidth: 2 }}
        >
          {isWithingsWeight && rangeDays <= 90 && (
            <LabelList
              dataKey="value"
              position="top"
              offset={14}
              content={(props: any) => {
                const { x, y, value, index: idx } = props;
                if (!data?.[idx]?.isReal) return null;
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fill="#B1916A"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {value}
                  </text>
                );
              }}
            />
          )}
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  );
}
