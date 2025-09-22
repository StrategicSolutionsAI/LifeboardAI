"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw } from "lucide-react";

interface Point { 
  date: string; 
  value: number; 
}

interface WidgetAnalysis {
  totalValue: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export default function WidgetTrendChart({ 
  instanceId, 
  name, 
  rangeDays = 30 
}: { 
  instanceId: string; 
  name: string; 
  rangeDays?: number;
}) {
  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/trends/${instanceId}?days=${rangeDays}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [instanceId, rangeDays]);

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
      return {
        totalValue: 0,
        trend: 'stable',
        trendPercentage: 0
      };
    }

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;

    if (data.length >= 4) {
      const quarter = Math.floor(data.length / 4);
      const firstQuarter = data.slice(0, quarter);
      const lastQuarter = data.slice(-quarter);
      
      const firstAvg = firstQuarter.reduce((sum, p) => sum + p.value, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, p) => sum + p.value, 0) / lastQuarter.length;
      
      if (firstAvg > 0) {
        trendPercentage = ((lastAvg - firstAvg) / firstAvg) * 100;
        trend = Math.abs(trendPercentage) < 3 ? 'stable' : 
                trendPercentage > 0 ? 'up' : 'down';
      }
    }

    return {
      totalValue,
      trend,
      trendPercentage: Math.abs(trendPercentage)
    };
  }, [data]);

  const formatTooltip = (value: number, name: string, props: any) => {
    const date = new Date(props.payload?.date).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
    return [`${value}`, date];
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-3 w-16" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const shortError = error.replace(/<[^>]+>/g, '').slice(0, 80) + (error.length > 80 ? '…' : '');
    return (
      <Card className="w-full max-w-md border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-red-800 flex items-center justify-between">
            {name}
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 text-red-600 hover:text-red-800 hover:bg-red-100"
              disabled={refreshing}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
          <CardDescription className="text-xs text-red-600">
            {shortError}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="w-full border-red-300 text-red-700 hover:bg-red-100"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            {name}
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
              disabled={refreshing}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">No data available</p>
          <Button onClick={handleRefresh} size="sm" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{name}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
              disabled={refreshing}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => window.open(`/trends/${instanceId}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">
            {analysis.totalValue.toLocaleString()}
          </span>
          {analysis.trend === 'up' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
              <TrendingUp className="w-2.5 h-2.5 mr-1" />
              +{analysis.trendPercentage.toFixed(0)}%
            </Badge>
          )}
          {analysis.trend === 'down' && (
            <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs px-1.5 py-0.5">
              <TrendingDown className="w-2.5 h-2.5 mr-1" />
              -{analysis.trendPercentage.toFixed(0)}%
            </Badge>
          )}
          {analysis.trend === 'stable' && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
              <Minus className="w-2.5 h-2.5 mr-1" />
              Stable
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="2 2" className="opacity-20" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 8 }} 
              interval="preserveStartEnd" 
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip 
              formatter={formatTooltip}
              labelStyle={{ fontSize: '11px', color: '#374151' }}
              contentStyle={{ 
                fontSize: '11px',
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                padding: '6px 8px'
              }}
            />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))" 
              radius={[2, 2, 0, 0]}
              className="hover:opacity-80 transition-opacity"
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">
          Last {rangeDays} days • Click <ExternalLink className="inline w-3 h-3" /> for details
        </p>
      </CardContent>
    </Card>
  );
}