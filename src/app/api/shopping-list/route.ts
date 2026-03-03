import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/utils/supabase/server";
import { supabaseFromBearer } from "@/utils/supabase/bearer";
import { handleApiError } from "@/lib/api-error-handler";
import { createShoppingItemSchema, updateShoppingItemSchema, deleteShoppingItemSchema, parseBody } from "@/lib/validations";
import { SHOPPING_LIST_SELECT_COLUMNS as SELECT_COLUMNS, mapRowToItem } from "@/repositories/shopping-list";

const TABLE = "shopping_list_items";

function getClientFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return supabaseFromBearer(authHeader.slice(7));
  }
  return supabaseServer();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const bucketFilter = sp.get("bucket");
    const taskIdFilter = sp.get("taskId");
    const includePurchased = sp.get("includePurchased") === "true";

    let query = supabase
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (bucketFilter) {
      query = query.eq("bucket", bucketFilter);
    }

    if (taskIdFilter) {
      query = query.eq("task_id", taskIdFilter);
    }

    if (!includePurchased) {
      query = query.eq("is_purchased", false);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load shopping list items", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const items = (data ?? []).map(mapRowToItem);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, "GET /api/shopping-list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = parseBody(createShoppingItemSchema, rawBody);
    if (parsed.response) return parsed.response;
    const { name: rawName, ...restBody } = parsed.data;
    const name = rawName.trim();

    const supabase = getClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const bucket =
      typeof restBody.bucket === "string" && restBody.bucket.trim().length > 0
        ? restBody.bucket.trim()
        : null;

    const quantity =
      typeof restBody.quantity === "string" && restBody.quantity.trim().length > 0
        ? restBody.quantity.trim()
        : null;

    const notes =
      typeof restBody.notes === "string" && restBody.notes.trim().length > 0
        ? restBody.notes.trim()
        : null;

    const neededBy =
      typeof restBody.neededBy === "string" && restBody.neededBy.trim().length > 0
        ? restBody.neededBy.trim()
        : null;

    const insert = {
      user_id: user.id,
      bucket,
      name,
      quantity,
      notes,
      needed_by: neededBy,
      is_purchased: false,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(insert)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("Failed to insert shopping list item", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(
      { item: mapRowToItem(data) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/shopping-list");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = parseBody(updateShoppingItemSchema, rawBody);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const id = body.id;

    const supabase = getClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const updates: Record<string, any> = {};

    if ("bucket" in body) {
      const bucket = body.bucket;
      updates.bucket =
        typeof bucket === "string" && bucket.trim().length > 0
          ? bucket.trim()
          : null;
    }

    if ("name" in body) {
      const name = (body.name ?? "").toString().trim();
      if (!name) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
      updates.name = name;
    }

    if ("quantity" in body) {
      const quantity = body.quantity;
      updates.quantity =
        typeof quantity === "string" && quantity.trim().length > 0
          ? quantity.trim()
          : null;
    }

    if ("notes" in body) {
      const notes = body.notes;
      updates.notes =
        typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null;
    }

    if ("neededBy" in body) {
      const neededBy = body.neededBy;
      updates.needed_by =
        typeof neededBy === "string" && neededBy.trim().length > 0
          ? neededBy.trim()
          : null;
    }

    if ("isPurchased" in body) {
      updates.is_purchased = Boolean(body.isPurchased);
    }

    if ("calendarEventId" in body) {
      const value = body.calendarEventId;
      updates.calendar_event_id =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if ("calendarEventCreatedAt" in body) {
      const value = body.calendarEventCreatedAt;
      updates.calendar_event_created_at =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if ("widgetInstanceId" in body) {
      const value = body.widgetInstanceId;
      updates.widget_instance_id =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if ("widgetCreatedAt" in body) {
      const value = body.widgetCreatedAt;
      updates.widget_created_at =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if ("widgetBucket" in body) {
      const value = body.widgetBucket;
      updates.widget_bucket =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if ("taskId" in body) {
      const value = body.taskId;
      updates.task_id =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if ("taskCreatedAt" in body) {
      const value = body.taskCreatedAt;
      updates.task_created_at =
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("Failed to update shopping list item", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ item: mapRowToItem(data) });
  } catch (error) {
    return handleApiError(error, "PATCH /api/shopping-list");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = parseBody(deleteShoppingItemSchema, rawBody);
    if (parsed.response) return parsed.response;
    const id = parsed.data.id;

    const supabase = getClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to delete shopping list item", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "DELETE /api/shopping-list");
  }
}
