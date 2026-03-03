"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { supabase } from '@/utils/supabase/client';
import SectionLoadTimer from '@/components/section-load-timer';
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw, Scale, Activity, Target, Calendar } from "lucide-react";
interface Point { date: string; value: number; isReal?: boolean }
type TimeRange = '7d' | '30d' | '90d'
interface TrendAnalysis { totalValue: number; dailyAverage: number; trend: 'up' | 'down' | 'stable'; trendPercentage: number; bestDay: { date: string; value: number } | null }

const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90 } as const;

/* ── Custom Tooltip ── */
function FullTooltip({ active, payload, isWeight, unit }: any) {
  if (!active || !payload?.[0]) return null;
  const { date, value } = payload[0].payload;
  if (value === 0) return null;
  const formatted = new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="rounded-xl bg-theme-surface-overlay/95 border border-theme-neutral-300 shadow-[0px_8px_24px_rgba(163,133,96,0.12)] backdrop-blur-sm px-4 py-3 min-w-[140px]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-theme-text-subtle">{formatted}</p>
      <div className="w-8 h-[2px] rounded-full bg-warm-400/40 my-1.5" />
      <p className="text-2xl font-black tracking-tight text-theme-text-primary leading-none">
        {value}
        {isWeight && <span className="text-sm font-medium text-theme-text-tertiary ml-1">{unit || 'lbs'}</span>}
      </p>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, iconBg, label, value, subtitle, delay = 0 }: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; subtitle: string; delay?: number;
}) {
  return (
    <div
      className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm hover:shadow-warm transition-shadow duration-200 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-theme-text-subtle">{label}</p>
      </div>
      <div className="text-2xl font-black leading-none tracking-tight text-theme-text-primary">{value}</div>
      <p className="text-[10px] font-medium text-theme-text-tertiary mt-1.5">{subtitle}</p>
    </div>
  );
}

export default function TrendsPageClient({ params }: { params: { instanceId: string } }) {
  const { instanceId } = params;
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const weightUnit = searchParams.get('unit') || 'lbs';
  const isWithingsWeight = source === 'withings';

  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isMobile, setIsMobile] = useState(false);

  const loadData = useCallback(async (days: number) => {
    try {
      setError(null);

      if (isWithingsWeight) {
        const res = await fetch(`/api/integrations/withings/history?days=${days}&limit=500`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const measurements: Array<{ weightKg: number; weightLbs: number; measuredAt: string }> = json.measurements || [];

        const byDate = new Map<string, number>();
        for (const m of measurements) {
          const dateStr = m.measuredAt.slice(0, 10);
          const value = (weightUnit === 'kg') ? m.weightKg : m.weightLbs;
          if (!byDate.has(dateStr)) {
            byDate.set(dateStr, parseFloat(value.toFixed(1)));
          }
        }

        // Build date-filled array, carrying forward the last known value
        const result: Point[] = [];
        let lastKnown: number | null = null;
        const sortedDates = Array.from(byDate.keys()).sort();
        if (sortedDates.length > 0) lastKnown = byDate.get(sortedDates[0])!;

        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - ((days - 1) - i));
          const ds = d.toISOString().slice(0, 10);
          const measured = byDate.get(ds);
          if (measured !== undefined) {
            lastKnown = measured;
            result.push({ date: ds, value: measured, isReal: true });
          } else {
            result.push({ date: ds, value: lastKnown ?? 0, isReal: false });
          }
        }
        setData(result);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/trends/${instanceId}?days=${days}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json.data);
      }
    } catch (err: any) { setError(err.message) }
  }, [instanceId, isWithingsWeight, weightUnit]);

  useEffect(() => { (async () => { setLoading(true); await loadData(RANGE_DAYS[timeRange]); setLoading(false) })() }, [loadData, timeRange]);

  useEffect(() => {
    const onResize = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleRefresh = async () => { setRefreshing(true); await loadData(RANGE_DAYS[timeRange]); setRefreshing(false) };

  const analysis: TrendAnalysis = useMemo(() => {
    if (!data || data.length === 0) return { totalValue: 0, dailyAverage: 0, trend: 'stable', trendPercentage: 0, bestDay: null };

    const effectiveData = isWithingsWeight ? data.filter(p => p.value > 0) : data;
    if (effectiveData.length === 0) return { totalValue: 0, dailyAverage: 0, trend: 'stable', trendPercentage: 0, bestDay: null };

    const totalValue = effectiveData.reduce((s, p) => s + p.value, 0);
    const dailyAverage = totalValue / effectiveData.length;
    const bestDay = effectiveData.reduce((best, cur) => cur.value > (best?.value || 0) ? cur : best, effectiveData[0]);
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;
    if (effectiveData.length >= 2) {
      const firstHalf = effectiveData.slice(0, Math.floor(effectiveData.length / 2));
      const secondHalf = effectiveData.slice(Math.floor(effectiveData.length / 2));
      const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;
      if (firstAvg > 0) { trendPercentage = ((secondAvg - firstAvg) / firstAvg) * 100; trend = Math.abs(trendPercentage) < 5 ? 'stable' : trendPercentage > 0 ? 'up' : 'down' }
    }
    return { totalValue: isWithingsWeight ? parseFloat(dailyAverage.toFixed(1)) : totalValue, dailyAverage: parseFloat(dailyAverage.toFixed(1)), trend, trendPercentage: Math.abs(trendPercentage), bestDay };
  }, [data, isWithingsWeight]);

  /* ── Trend badge config ── */
  const trendConfig = {
    up: { icon: TrendingUp, text: `+${analysis.trendPercentage.toFixed(1)}%`, bg: 'bg-emerald-100', color: 'text-emerald-700', border: 'border-emerald-200' },
    down: { icon: TrendingDown, text: `-${analysis.trendPercentage.toFixed(1)}%`, bg: 'bg-red-100', color: 'text-red-700', border: 'border-red-200' },
    stable: { icon: Minus, text: 'Stable', bg: 'bg-theme-surface-selected', color: 'text-theme-primary-600', border: 'border-theme-neutral-300' },
  };
  const tc = trendConfig[analysis.trend];
  const TrendIcon = tc.icon;

  /* ── Loading ── */
  if (loading) {
    return (
      <>
        <SectionLoadTimer name="/trends/[instanceId]" />
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
          <div className="space-y-2"><Skeleton className="h-8 w-56 bg-theme-skeleton" /><Skeleton className="h-4 w-80 bg-theme-skeleton" /></div>
          <div className="flex gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-16 rounded-full bg-theme-skeleton" />)}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm">
              <Skeleton className="h-3 w-20 mb-3 bg-theme-skeleton" />
              <Skeleton className="h-7 w-16 mb-1 bg-theme-skeleton" />
              <Skeleton className="h-2.5 w-24 bg-theme-skeleton" />
            </div>
          ))}</div>
          <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-6 shadow-warm-sm">
            <Skeleton className="h-5 w-40 mb-2 bg-theme-skeleton" />
            <Skeleton className="h-3 w-60 mb-6 bg-theme-skeleton" />
            <Skeleton className="h-72 w-full rounded-lg bg-theme-skeleton" />
          </div>
        </div>
      </>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <>
        <SectionLoadTimer name="/trends/[instanceId]" />
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 shadow-warm-sm text-center">
            <BarChart3 className="h-10 w-10 text-red-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-red-800 mb-1">Unable to Load Trends</h2>
            <p className="text-sm text-red-600/80 mb-4 max-w-md mx-auto">{error.replace(/<[^>]+>/g, '').slice(0, 120)}{error.length > 120 ? '…' : ''}</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ── Empty ── */
  if (!data || data.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-12 shadow-warm-sm text-center">
          <BarChart3 className="h-12 w-12 text-theme-text-subtle mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-theme-text-primary mb-1">No Data Available</h2>
          <p className="text-sm text-theme-text-tertiary mb-4 max-w-sm mx-auto">There's no trend data for the selected time period. Try refreshing or selecting a different range.</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-primary text-white text-sm font-medium hover:bg-theme-primary-600 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SectionLoadTimer name="/trends/[instanceId]" />
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-theme-text-primary">
              {isWithingsWeight ? 'Weight Trends' : 'Widget Trends'}
            </h1>
            <div className="w-10 h-[3px] rounded-full bg-gradient-to-r from-warm-400 to-warm-300 mt-2 mb-1" />
            <p className="text-sm font-normal leading-normal text-theme-text-secondary">
              {isWithingsWeight ? 'Track your weight and identify patterns over time' : 'Track your progress and identify patterns over time'}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start sm:self-end inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-raised text-sm font-medium text-theme-text-primary hover:bg-theme-surface-alt shadow-warm-sm transition-all duration-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Time Range Pills ── */}
        <div className="flex gap-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {(Object.keys(RANGE_DAYS) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                timeRange === range
                  ? 'bg-warm-500 text-white border-warm-500 shadow-warm-sm'
                  : 'bg-theme-surface-raised text-theme-text-secondary border-theme-neutral-300 hover:border-warm-300 hover:text-theme-text-primary'
              }`}
            >
              <Calendar className="w-3 h-3 mr-1.5" />
              {range.toUpperCase()}
            </button>
          ))}
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Scale}
            iconBg="bg-theme-primary-50 text-warm-600"
            label={isWithingsWeight ? 'Average Weight' : 'Total Value'}
            value={
              <span>
                {isWithingsWeight ? analysis.totalValue : analysis.totalValue.toLocaleString()}
                {isWithingsWeight && <span className="text-sm font-medium text-theme-text-tertiary ml-1">{weightUnit}</span>}
              </span>
            }
            subtitle={`Last ${RANGE_DAYS[timeRange]} days`}
            delay={0}
          />
          <StatCard
            icon={Activity}
            iconBg="bg-blue-50 text-blue-600"
            label="Daily Average"
            value={
              <span>
                {isWithingsWeight ? analysis.dailyAverage : analysis.dailyAverage.toFixed(1)}
                {isWithingsWeight && <span className="text-sm font-medium text-theme-text-tertiary ml-1">{weightUnit}</span>}
              </span>
            }
            subtitle="Per day average"
            delay={80}
          />
          <StatCard
            icon={TrendIcon}
            iconBg={`${tc.bg} ${tc.color}`}
            label="Trend"
            value={
              <span className={`inline-flex items-center gap-1.5 ${tc.color}`}>
                <TrendIcon className="w-5 h-5" />
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tc.bg} ${tc.color} ${tc.border}`}>
                  {tc.text}
                </span>
              </span>
            }
            subtitle="Period comparison"
            delay={160}
          />
          <StatCard
            icon={Target}
            iconBg="bg-amber-50 text-amber-600"
            label={isWithingsWeight ? 'Peak Weight' : 'Best Day'}
            value={
              <span>
                {isWithingsWeight ? `${analysis.bestDay?.value || 0}` : (analysis.bestDay?.value || 0)}
                {isWithingsWeight && <span className="text-sm font-medium text-theme-text-tertiary ml-1">{weightUnit}</span>}
              </span>
            }
            subtitle={analysis.bestDay ? new Date(analysis.bestDay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
            delay={240}
          />
        </div>

        {/* ── Main Chart ── */}
        <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised shadow-warm-sm overflow-hidden animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="px-5 pt-5 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-warm-500" />
              <h2 className="text-base font-semibold leading-snug text-theme-text-primary">
                {isWithingsWeight ? 'Weight Over Time' : 'Progress Over Time'}
              </h2>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-theme-text-subtle">
              {isWithingsWeight ? `Weight (${weightUnit})` : 'Daily values'} — last {RANGE_DAYS[timeRange]} days
            </p>
          </div>

          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={isMobile ? 260 : 360}>
              <AreaChart
                data={data}
                margin={isMobile ? { top: 26, right: 12, left: 8, bottom: 10 } : { top: 34, right: 24, left: 16, bottom: 16 }}
              >
                <defs>
                  <linearGradient id="full-warm-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B1916A" stopOpacity={0.28} />
                    <stop offset="60%" stopColor="#B1916A" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#B1916A" stopOpacity={0.01} />
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
                  tick={{ fontSize: isMobile ? 9 : 11, fill: 'var(--theme-text-subtle, #9CA3AF)' }}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  allowDecimals={isWithingsWeight}
                  tick={{ fontSize: isMobile ? 9 : 11, fill: 'var(--theme-text-subtle, #9CA3AF)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={isWithingsWeight ? ['dataMin - 2', 'dataMax + 2'] : ['auto', 'auto']}
                  width={isMobile ? 35 : 45}
                />
                <Tooltip
                  content={<FullTooltip isWeight={isWithingsWeight} unit={weightUnit} />}
                  cursor={{ stroke: '#B1916A', strokeOpacity: 0.2, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#B1916A"
                  strokeWidth={2.5}
                  fill="url(#full-warm-gradient)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload?.isReal) return <circle key={`dot-${cx}`} r={0} cx={cx} cy={cy} fill="none" />;
                    return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill="#B1916A" stroke="#fff" strokeWidth={2} />;
                  }}
                  activeDot={{ r: 5, fill: '#B1916A', stroke: '#fff', strokeWidth: 2.5 }}
                >
                  {isWithingsWeight && timeRange !== '90d' && (
                    <LabelList
                      dataKey="value"
                      position="top"
                      offset={16}
                      content={(props: any) => {
                        const { x, y, value, index: idx } = props;
                        if (!data?.[idx]?.isReal) return null;
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            fill="#B1916A"
                            fontSize={isMobile ? 9 : 11}
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
          </div>
        </div>
      </div>
    </>
  );
}
