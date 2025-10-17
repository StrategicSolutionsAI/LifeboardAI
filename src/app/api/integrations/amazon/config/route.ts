import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const PROVIDER = "amazon";

async function requireUser() {
  const supabase = supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null };
  }
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, token_data, updated_at, created_at")
    .eq("user_id", user.id)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Amazon integration config", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: Boolean(data.access_token),
    config: data.token_data ?? null,
    updatedAt: data.updated_at ?? null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const accessKey = (body.accessKey ?? "").toString().trim();
    const secretKey = (body.secretKey ?? "").toString().trim();
    const region = (body.region ?? "").toString().trim().toLowerCase() || "us";

    if (!accessKey) {
      return NextResponse.json({ error: "accessKey required" }, { status: 400 });
    }

    const defaultFrequencyDaysRaw = body.defaultFrequencyDays;
    let defaultFrequencyDays: number | null = null;
    if (defaultFrequencyDaysRaw !== undefined && defaultFrequencyDaysRaw !== null && defaultFrequencyDaysRaw !== "") {
      const parsed = Number(defaultFrequencyDaysRaw);
      if (Number.isFinite(parsed) && parsed > 0) {
        defaultFrequencyDays = Math.floor(parsed);
      }
    }

    const defaultQuantityRaw = body.defaultQuantity;
    let defaultQuantity: number | null = null;
    if (defaultQuantityRaw !== undefined && defaultQuantityRaw !== null && defaultQuantityRaw !== "") {
      const parsed = Number(defaultQuantityRaw);
      if (Number.isFinite(parsed) && parsed > 0) {
        defaultQuantity = Math.max(1, Math.floor(parsed));
      }
    }

    const defaultPurchaseMode = body.defaultPurchaseMode === "subscription" ? "subscription" : "one-time";

    const { supabase, user } = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("user_integrations")
      .select("refresh_token, token_data, created_at")
      .eq("user_id", user.id)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to load existing Amazon integration", existingError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const createdAt = existing?.created_at ?? nowIso;
    const refreshToken =
      secretKey.length > 0 ? secretKey : existing?.refresh_token ?? null;
    const nextTokenData = {
      ...(existing?.token_data ?? {}),
      region,
      defaultFrequencyDays,
      defaultQuantity,
      defaultPurchaseMode,
      updatedAt: nowIso,
    };

    const { error: upsertError } = await supabase.from("user_integrations").upsert(
      {
        user_id: user.id,
        provider: PROVIDER,
        access_token: accessKey,
        refresh_token: refreshToken,
        token_data: nextTokenData,
        created_at: createdAt,
        updated_at: nowIso,
      },
      { onConflict: "user_id,provider" },
    );

    if (upsertError) {
      console.error("Failed to store Amazon integration data", upsertError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/integrations/amazon/config error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
