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
  const supabase = supabaseService();

  // We expect the caller to send a Bearer token. If missing, reject.
  const authHeader = _req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const user = userData.user;

  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceStr = since.toISOString().slice(0, 10);

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
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const ds = d.toISOString().slice(0, 10);
    const row = (data ?? []).find((r: any) => r.date === ds);
    result.push({ date: ds, value: row?.value ?? 0 });
  }
  return NextResponse.json({ data: result });
} 