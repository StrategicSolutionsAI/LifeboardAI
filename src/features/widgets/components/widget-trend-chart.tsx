"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/utils/supabase/client';

// Lazy-load recharts to reduce initial bundle size (~50-80 KB savings)
const RechartsChart = dynamic(
  () => import('./widget-trend-recharts'),
  { ssr: false, loading: () => <div className="h-[100px] w-full rounded-lg bg-theme-skeleton animate-pulse" /> }
);
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface Point {
  date: string;
  value: number;
  isReal?: boolean; // true if this is an actual measurement, false if carried forward
}

interface WidgetAnalysis {
  totalValue: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export default function WidgetTrendChart({
  instanceId,
  name,
  rangeDays = 30,
  dataSource,
  widgetType,
  unit,
  index = 0,
}: {
  instanceId: string;
  name: string;
  rangeDays?: number;
  dataSource?: string;
  widgetType?: string;
  unit?: string;
  index?: number;
}) {
  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWithingsWeight = widgetType === 'weight' && dataSource === 'withings';
  const gradientId = `warm-gradient-${instanceId}`;

  const loadData = useCallback(async () => {
    try {
      setError(null);

      if (isWithingsWeight) {
        let measurements: Array<{ weightKg: number; weightLbs: number; measuredAt: string }> = [];

        // Try Withings-specific endpoint first
        try {
          const res = await fetch(`/api/integrations/withings/history?days=${rangeDays}&limit=500`, {
            credentials: 'include',
          });
          if (res.ok) {
            const json = await res.json();
            measurements = json.measurements || [];
          }
        } catch {
          // Withings endpoint failed, will fall back below
        }

        // If Withings returned data, build the date-filled chart
        if (measurements.length > 0) {
          const byDate = new Map<string, number>();
          for (const m of measurements) {
            const dateStr = m.measuredAt.slice(0, 10);
            const value = (unit === 'kg') ? m.weightKg : m.weightLbs;
            if (!byDate.has(dateStr)) {
              byDate.set(dateStr, parseFloat(value.toFixed(1)));
            }
          }

          const result: Point[] = [];
          let lastKnown: number | null = null;
          const sortedDates = Array.from(byDate.keys()).sort();
          if (sortedDates.length > 0) lastKnown = byDate.get(sortedDates[0])!;

          for (let i = 0; i < rangeDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - ((rangeDays - 1) - i));
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
          // Fallback: load from generic widget_progress_history
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`/api/trends/${instanceId}?days=${rangeDays}`, {
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
          if (!res.ok) throw new Error(await res.text());
          const json = await res.json();
          setData(json.data);
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/trends/${instanceId}?days=${rangeDays}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [instanceId, rangeDays, isWithingsWeight, unit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const analysis: WidgetAnalysis = useMemo(() => {
    if (!data || data.length === 0) {
      return { totalValue: 0, trend: 'stable', trendPercentage: 0 };
    }

    const nonZeroData = isWithingsWeight ? data.filter(p => p.value > 0) : data;

    const totalValue = isWithingsWeight && nonZeroData.length > 0
      ? parseFloat((nonZeroData.reduce((sum, p) => sum + p.value, 0) / nonZeroData.length).toFixed(1))
      : data.reduce((sum, point) => sum + point.value, 0);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;

    const trendData = isWithingsWeight ? nonZeroData : data;
    if (trendData.length >= 4) {
      const quarter = Math.floor(trendData.length / 4);
      const firstQuarter = trendData.slice(0, quarter);
      const lastQuarter = trendData.slice(-quarter);

      const firstAvg = firstQuarter.reduce((sum, p) => sum + p.value, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, p) => sum + p.value, 0) / lastQuarter.length;

      if (firstAvg > 0) {
        trendPercentage = ((lastAvg - firstAvg) / firstAvg) * 100;
        trend = Math.abs(trendPercentage) < 3 ? 'stable' :
                trendPercentage > 0 ? 'up' : 'down';
      }
    }

    return { totalValue, trend, trendPercentage: Math.abs(trendPercentage) };
  }, [data, isWithingsWeight]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="rounded-xl bg-theme-surface-raised shadow-warm-sm border border-theme-neutral-300 p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-20 bg-theme-skeleton" />
          <Skeleton className="h-3 w-3 rounded-full bg-theme-skeleton" />
        </div>
        <Skeleton className="h-7 w-24 mb-1 bg-theme-skeleton" />
        <Skeleton className="h-4 w-16 mb-4 bg-theme-skeleton" />
        <Skeleton className="h-[100px] w-full rounded-lg bg-theme-skeleton" />
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    const shortError = error.replace(/<[^>]+>/g, '').slice(0, 60) + (error.length > 60 ? '…' : '');
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-warm-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-theme-text-primary mb-1">{name}</p>
        <p className="text-xs text-theme-text-secondary mb-3">{shortError}</p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-medium text-theme-text-primary hover:text-theme-text-primary transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  /* ── Empty ── */
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl bg-theme-surface-raised shadow-warm-sm border border-theme-neutral-300 p-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-theme-text-subtle mb-2">{name}</p>
        <p className="text-xs text-theme-text-tertiary mb-3">No data yet</p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs font-medium text-theme-primary hover:text-theme-primary-600 transition-colors"
        >
          <RefreshCw className={`inline h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    );
  }

  /* ── Trend badge config ── */
  const trendConfig = {
    up: { icon: TrendingUp, text: `+${analysis.trendPercentage.toFixed(0)}%`, bg: 'bg-emerald-100', color: 'text-theme-text-primary', border: 'border-emerald-200' },
    down: { icon: TrendingDown, text: `-${analysis.trendPercentage.toFixed(0)}%`, bg: 'bg-red-100', color: 'text-theme-text-primary', border: 'border-red-200' },
    stable: { icon: Minus, text: 'Stable', bg: 'bg-theme-surface-selected', color: 'text-theme-primary-600', border: 'border-theme-neutral-300' },
  };
  const tc = trendConfig[analysis.trend];
  const TrendIcon = tc.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-xl bg-theme-surface-raised shadow-warm-sm border border-theme-neutral-300 p-4 hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-default group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-theme-text-subtle truncate">
          {name}
        </p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 rounded-md text-theme-text-tertiary hover:text-theme-text-primary hover:bg-theme-hover transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1 rounded-md text-theme-text-tertiary hover:text-theme-text-primary hover:bg-theme-hover transition-colors"
            onClick={() => {
              const params = isWithingsWeight ? `?source=withings&unit=${unit || 'lbs'}` : '';
              window.open(`/trends/${instanceId}${params}`, '_blank');
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Stat + Trend */}
      <div className="flex items-end gap-2 mb-3">
        <span className="text-3xl font-black leading-none tracking-tight text-theme-text-primary">
          {isWithingsWeight ? analysis.totalValue : analysis.totalValue.toLocaleString()}
        </span>
        {isWithingsWeight && (
          <span className="text-sm font-medium text-theme-text-tertiary mb-0.5">{unit || 'lbs'}</span>
        )}
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ml-auto ${tc.bg} ${tc.color} ${tc.border}`}>
          <TrendIcon className="w-2.5 h-2.5 mr-0.5" />
          {tc.text}
        </span>
      </div>

      {/* Chart — lazy-loaded recharts */}
      <div className="rounded-lg overflow-hidden -mx-1">
        <RechartsChart
          data={data}
          gradientId={gradientId}
          isWithingsWeight={isWithingsWeight}
          rangeDays={rangeDays}
          unit={unit}
        />
      </div>

      {/* Footer */}
      <p className="text-[10px] font-medium text-theme-text-tertiary mt-2">
        {isWithingsWeight ? `Avg over ${rangeDays}d` : `Last ${rangeDays} days`}
      </p>
    </motion.div>
  );
}
