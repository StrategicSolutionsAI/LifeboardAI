import { NextRequest, NextResponse } from "next/server";
import { createNoteSchema, updateNoteSchema, deleteNoteSchema } from "@/lib/validations";
import { NOTE_SELECT_COLUMNS as SELECT_COLUMNS, mapRowToNote } from "@/repositories/notes";
import { withAuth, withAuthAndBody } from "@/lib/api-utils";

const TABLE = "notes";

export const GET = withAuth(async (req, { supabase, user }) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to load notes", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const notes = (data ?? []).map(mapRowToNote);
  return NextResponse.json({ notes });
}, "GET /api/notes");

export const POST = withAuthAndBody(createNoteSchema, async (req, { supabase, user, body }) => {
  const title = (body.title ?? "").trim();
  const noteBody = (body.body ?? "").trim();

  const insert = {
    user_id: user.id,
    title,
    body: noteBody,
    is_pinned: false,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    console.error("Failed to insert note", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ note: mapRowToNote(data) }, { status: 201 });
}, "POST /api/notes");

export const PATCH = withAuthAndBody(updateNoteSchema, async (req, { supabase, user, body }) => {
  const id = body.id;
  const updates: Record<string, any> = {};

  if ("title" in body) {
    updates.title = (body.title ?? "").trim();
  }

  if ("body" in body) {
    updates.body = (body.body ?? "").trim();
  }

  if ("isPinned" in body) {
    updates.is_pinned = Boolean(body.isPinned);
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
    console.error("Failed to update note", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ note: mapRowToNote(data) });
}, "PATCH /api/notes");

export const DELETE = withAuthAndBody(deleteNoteSchema, async (req, { supabase, user, body }) => {
  const id = body.id;

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete note", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, "DELETE /api/notes");
