import { NextRequest, NextResponse } from "next/server";
import { createShoppingItemSchema, updateShoppingItemSchema, deleteShoppingItemSchema } from "@/lib/validations";
import { SHOPPING_LIST_SELECT_COLUMNS as SELECT_COLUMNS, mapRowToItem } from "@/repositories/shopping-list";
import { withAuth, withAuthAndBody } from "@/lib/api-utils";

const TABLE = "shopping_list_items";

export const GET = withAuth(async (req, { supabase, user }) => {
  const sp = req.nextUrl.searchParams;
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
}, "GET /api/shopping-list");

export const POST = withAuthAndBody(createShoppingItemSchema, async (req, { supabase, user, body }) => {
  const name = body.name.trim();

  const bucket =
    typeof body.bucket === "string" && body.bucket.trim().length > 0
      ? body.bucket.trim()
      : null;

  const quantity =
    typeof body.quantity === "string" && body.quantity.trim().length > 0
      ? body.quantity.trim()
      : null;

  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;

  const neededBy =
    typeof body.neededBy === "string" && body.neededBy.trim().length > 0
      ? body.neededBy.trim()
      : null;

  const assigneeId =
    typeof body.assigneeId === "string" && body.assigneeId.trim().length > 0
      ? body.assigneeId.trim()
      : null;

  const insert = {
    user_id: user.id,
    bucket,
    name,
    quantity,
    notes,
    needed_by: neededBy,
    assignee_id: assigneeId,
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
}, "POST /api/shopping-list");

export const PATCH = withAuthAndBody(updateShoppingItemSchema, async (req, { supabase, user, body }) => {
  const id = body.id;

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
}, "PATCH /api/shopping-list");

export const DELETE = withAuthAndBody(deleteShoppingItemSchema, async (req, { supabase, user, body }) => {
  const id = body.id;

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
}, "DELETE /api/shopping-list");
