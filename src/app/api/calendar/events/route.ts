import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { withAuth } from "@/lib/api-utils";

function formatHourSlot(time?: string | null): string | null {
  if (!time) return null;
  const [hoursStr, minutesStr = "00"] = time.split(":");
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);

  if (!Number.isFinite(hours) || hours < 0 || hours > 23 || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  const isPm = hours >= 12;
  const period = isPm ? "PM" : "AM";
  const normalizedHour = hours % 12 === 0 ? 12 : hours % 12;
  const paddedMinutes = minutes.toString().padStart(2, "0");
  const minutePart = minutes > 0 ? `:${paddedMinutes}` : "";
  return `hour-${normalizedHour}${minutePart}${period}`;
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    hourSlot: row.hour_slot ?? null,
    allDay: Boolean(row.all_day),
    bucket: row.bucket ?? null,
    duration: row.duration ?? null,
    source: row.source ?? null,
    externalId: row.external_id ?? null,
  };
}

export const POST = withAuth(async (req, { supabase, user }) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const title = (body.title ?? "").toString().trim();
  const startDate = (body.date ?? "").toString().trim();

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  if (!startDate) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }

  const source =
    typeof body.source === "string" && body.source.trim().length > 0
      ? body.source.trim()
      : "manual";

  const externalId =
    typeof body.externalId === "string" && body.externalId.trim().length > 0
      ? body.externalId.trim()
      : crypto.randomUUID();

  const description =
    typeof body.description === "string" && body.description.trim().length > 0
      ? body.description.trim()
      : null;

  const bucket =
    typeof body.bucket === "string" && body.bucket.trim().length > 0
      ? body.bucket.trim()
      : null;

  const allDay = body.allDay === true;
  const timeInput =
    typeof body.time === "string" && body.time.trim().length > 0
      ? body.time.trim()
      : null;

  const hourSlot = !allDay ? formatHourSlot(timeInput) : null;

  const durationMinutesRaw =
    typeof body.durationMinutes === "number"
      ? body.durationMinutes
      : typeof body.durationMinutes === "string" && body.durationMinutes.trim().length > 0
      ? Number.parseInt(body.durationMinutes, 10)
      : null;

  const durationMinutes =
    !allDay && Number.isFinite(durationMinutesRaw) && (durationMinutesRaw as number) > 0
      ? (durationMinutesRaw as number)
      : null;

  let startTimeIso: string | null = null;
  let endTimeIso: string | null = null;
  let endDate = startDate;

  if (!allDay && timeInput) {
    const [hoursStr, minutesStr = "00"] = timeInput.split(":");
    startTimeIso = `${startDate}T${hoursStr.padStart(2, "0")}:${minutesStr.padStart(2, "0")}:00Z`;

    if (durationMinutes) {
      const baseForDuration = `${startDate}T${hoursStr.padStart(2, "0")}:${minutesStr.padStart(2, "0")}:00`;
      const end = addMinutes(new Date(`${baseForDuration}Z`), durationMinutes);
      const yyyy = end.getUTCFullYear().toString().padStart(4, "0");
      const mm = (end.getUTCMonth() + 1).toString().padStart(2, "0");
      const dd = end.getUTCDate().toString().padStart(2, "0");
      const hh = end.getUTCHours().toString().padStart(2, "0");
      const min = end.getUTCMinutes().toString().padStart(2, "0");
      endDate = `${yyyy}-${mm}-${dd}`;
      endTimeIso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`;
    }
  }

  const commonFields = {
    title,
    description,
    content: description ?? title,
    start_date: startDate,
    end_date: endDate,
    due_date: startDate,
    hour_slot: hourSlot,
    start_time: startTimeIso,
    end_time: endTimeIso,
    bucket,
    duration: durationMinutes,
    all_day: allDay || !hourSlot,
    completed: false,
    position: null,
    rrule: null,
    repeat_rule: null,
    updated_at: new Date().toISOString(),
    source,
  };

  const { data: existing, error: fetchError } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("user_id", user.id)
    .eq("external_id", externalId)
    .eq("source", source)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to lookup calendar event before insert", fetchError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  let result;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("calendar_events")
      .update(commonFields)
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update calendar event", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    result = data;
  } else {
    const insertPayload = {
      ...commonFields,
      user_id: user.id,
      external_id: externalId,
    };
    const { data, error } = await supabase
      .from("calendar_events")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert calendar event", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    result = data;
  }

  return NextResponse.json({ event: mapRow(result) }, { status: 201 });
}, "POST /api/calendar/events");
