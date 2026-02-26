import { NextResponse } from "next/server";
import { supabaseServer } from "@/utils/supabase/server";

// Dev-only endpoint - returns access token for debugging
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ access_token: session.access_token });
}
