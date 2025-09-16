"use client";

import { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/utils/supabase/client';
import SectionLoadTimer from '@/components/section-load-timer';
import { SidebarLayout } from "@/components/sidebar-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, BarChart3, Calendar, RefreshCw } from "lucide-react";

interface Point { date: string; value: number }
type TimeRange = '7d' | '30d' | '90d'
interface TrendAnalysis { totalValue: number; dailyAverage: number; trend: 'up' | 'down' | 'stable'; trendPercentage: number; bestDay: { date: string; value: number } | null }

export default function TrendsPageClient({ params }: { params: { instanceId: string } }) {
  const { instanceId } = params;
  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isMobile, setIsMobile] = useState(false);

  const rangeDays = { '7d': 7, '30d': 30, '90d': 90 } as const;

  const loadData = async (days: number) => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/trends/${instanceId}?days=${days}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json.data);
    } catch (err: any) { setError(err.message) }
  };

  useEffect(() => { (async () => { setLoading(true); await loadData(rangeDays[timeRange]); setLoading(false) })() }, [instanceId, timeRange]);

  useEffect(() => {
    const onResize = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleRefresh = async () => { setRefreshing(true); await loadData(rangeDays[timeRange]); setRefreshing(false) };
  const handleTimeRangeChange = (range: TimeRange) => setTimeRange(range);

  const analysis: TrendAnalysis = useMemo(() => {
    if (!data || data.length === 0) return { totalValue: 0, dailyAverage: 0, trend: 'stable', trendPercentage: 0, bestDay: null };
    const totalValue = data.reduce((s, p) => s + p.value, 0);
    const dailyAverage = totalValue / data.length;
    const bestDay = data.reduce((best, cur) => cur.value > (best?.value || 0) ? cur : best, data[0]);
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;
    if (data.length >= 2) {
      const firstHalf = data.slice(0, Math.floor(data.length / 2));
      const secondHalf = data.slice(Math.floor(data.length / 2));
      const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;
      if (firstAvg > 0) { trendPercentage = ((secondAvg - firstAvg) / firstAvg) * 100; trend = Math.abs(trendPercentage) < 5 ? 'stable' : trendPercentage > 0 ? 'up' : 'down' }
    }
    return { totalValue, dailyAverage, trend, trendPercentage: Math.abs(trendPercentage), bestDay };
  }, [data]);

  const formatTooltip = (value: number, _name: string, props: any) => { const date = new Date(props.payload?.date).toLocaleDateString(); return [`${value}`, `${date}`] };

  if (loading) {
    return (
      <SidebarLayout>
        <SectionLoadTimer name="/trends/[instanceId]" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
          <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96" /></div>
          <div className="flex gap-2"><Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-20" /><Skeleton className="h-10 w-20" /></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => (<Card key={i}><CardHeader className="pb-3"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-3 w-20" /></CardContent></Card>))}</div>
          <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <SectionLoadTimer name="/trends/[instanceId]" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle className="text-red-800 flex items-center gap-2"><BarChart3 className="h-5 w-5" />Unable to Load Trends</CardTitle><CardDescription className="text-red-600">{error.replace(/<[^>]+>/g, '').slice(0, 120)}{error.length > 120 ? '…' : ''}</CardDescription></CardHeader><CardContent><Button onClick={handleRefresh} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Try Again</Button></CardContent></Card>
        </div>
      </SidebarLayout>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SidebarLayout>
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <Card className="text-center py-12"><CardContent><BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><CardTitle className="mb-2">No Data Available</CardTitle><CardDescription className="mb-4">There's no trend data for the selected time period. Try refreshing or selecting a different time range.</CardDescription><Button onClick={handleRefresh} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh Data</Button></CardContent></Card>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <SectionLoadTimer name="/trends/[instanceId]" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Widget Trends</h1>
            <p className="text-muted-foreground">Track your progress and identify patterns over time</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing} className="self-start sm:self-center"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>

        <Card><CardContent className="p-4"><div className="flex flex-wrap gap-2">{(Object.keys(rangeDays) as TimeRange[]).map((range) => (
          <Button key={range} onClick={() => handleTimeRangeChange(range)} variant={timeRange === range ? "default" : "outline"} size="sm" className="min-w-16"><Calendar className="mr-1 h-3 w-3" />{range.toUpperCase()}</Button>
        ))}</div></CardContent></Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Total Values</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analysis.totalValue.toLocaleString()}</div><p className="text-xs text-muted-foreground">Last {rangeDays[timeRange]} days</p></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Daily Average</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analysis.dailyAverage.toFixed(1)}</div><p className="text-xs text-muted-foreground">Per day average</p></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Trend</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2">{analysis.trend === 'up' && (<><TrendingUp className="h-4 w-4 text-green-600" /><Badge variant="secondary" className="bg-green-100 text-green-800">+{analysis.trendPercentage.toFixed(1)}%</Badge></>)}{analysis.trend === 'down' && (<><TrendingDown className="h-4 w-4 text-red-600" /><Badge variant="secondary" className="bg-red-100 text-red-800">-{analysis.trendPercentage.toFixed(1)}%</Badge></>)}{analysis.trend === 'stable' && (<><Minus className="h-4 w-4 text-blue-600" /><Badge variant="secondary" className="bg-blue-100 text-blue-800">Stable</Badge></>)}</div><p className="text-xs text-muted-foreground mt-1">Period comparison</p></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Best Day</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analysis.bestDay?.value || 0}</div><p className="text-xs text-muted-foreground">{analysis.bestDay ? new Date(analysis.bestDay.date).toLocaleDateString() : 'N/A'}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Progress Over Time</CardTitle>
            <CardDescription>Daily values for the last {rangeDays[timeRange]} days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
              <BarChart
                data={data}
                margin={isMobile ? { top: 10, right: 10, left: 10, bottom: 20 } : { top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={isMobile ? false : { fontSize: 12 }}
                  interval="preserveStartEnd"
                  angle={isMobile ? 0 : -45}
                  textAnchor={isMobile ? 'middle' : 'end'}
                  height={isMobile ? 20 : 60}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: isMobile ? 10 : 12 }} />
                <Tooltip formatter={formatTooltip} labelStyle={{ color: '#374151' }} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} className="hover:opacity-80 transition-opacity" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
