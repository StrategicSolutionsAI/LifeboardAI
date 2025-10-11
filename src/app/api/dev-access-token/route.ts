import { NextResponse } from "next/server";
import { supabaseServer } from "@/utils/supabase/server";

export async function GET() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ access_token: session.access_token });
}