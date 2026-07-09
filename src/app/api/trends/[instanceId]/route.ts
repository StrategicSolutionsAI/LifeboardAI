import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Reusable helper to create a Supabase client that does **not** attempt to parse
// any cookies (we only use Bearer tokens for auth in this route)
function supabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export async function GET(_req: Request, { params }: { params: { instanceId: string } }) {
  // We expect the caller to send a Bearer token. If missing, reject.
  const authHeader = _req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];

  // Create a Supabase client with the user's JWT attached so that
  // row-level security policies evaluating auth.uid() work correctly.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );

  // Basic sanity check that the token is valid
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const user = userData.user;

  // Parse ?days= query param, allow 7,30,90,365. Default 30.
  const url = new URL(_req.url);
  const daysParam = parseInt(url.searchParams.get('days') ?? '30', 10);
  const allowed = [7, 30, 90, 365];
  const days = allowed.includes(daysParam) ? daysParam : 30;

  // Anchor the axis on the CLIENT's local "today" (?end=YYYY-MM-DD): progress
  // rows are written with client-local dates, so a server-derived (UTC) axis
  // runs a day ahead of the newest rows during evening hours west of
  // Greenwich. Server-local today stays the fallback for callers without it.
  const endParam = url.searchParams.get('end');
  const endDate = endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam)
    ? new Date(`${endParam}T00:00:00Z`)
    : (() => {
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      })();

  // Whole-day steps in UTC space keep the anchor date free of timezone drift
  const axisDate = (i: number): string => {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - ((days - 1) - i));
    return d.toISOString().slice(0, 10);
  };

  const sinceStr = axisDate(0);

  const { data, error } = await supabase
    .from('widget_progress_history')
    .select('date, value')
    .eq('user_id', user!.id)
    .eq('widget_instance_id', params.instanceId)
    .gte('date', sinceStr)
    .order('date');

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fill missing dates with 0
  const result: { date: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const ds = axisDate(i);
    const row = (data ?? []).find((r: Record<string, unknown>) => (r.date as string).slice(0, 10) === ds);
    result.push({ date: ds, value: row?.value ?? 0 });
  }
  const res = NextResponse.json({ data: result });
  res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
  return res;
}