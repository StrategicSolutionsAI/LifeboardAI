"use client";
import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/utils/supabase/client';

interface Point { date: string; value: number; }
export default function WidgetTrendChart({ instanceId, name, rangeDays = 30 }: { instanceId: string; name: string; rangeDays?: number }) {
  const [data, setData] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/trends/${instanceId}?days=${rangeDays}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      }
    };
    load();
  }, [instanceId, rangeDays]);

  if (error) {
    const short = error.replace(/<[^>]+>/g, '').slice(0, 120) + (error.length > 120 ? '…' : '');
    return <div className="text-red-500 text-sm">Error: {short}</div>;
  }
  if (!data) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="w-full max-w-md p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-sm font-medium mb-2 text-gray-800">{name}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 8 }} interval="preserveStartEnd" minTickGap={20} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24}/>
          <Tooltip />
          <Bar dataKey="value" fill="#4f46e5" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 