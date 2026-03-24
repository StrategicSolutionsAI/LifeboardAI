"use client";

export const NATIVE_CALENDAR_DND_MIME = "application/x-lifeboard-calendar-dnd";

export type NativeCalendarDragPayload =
  | {
      type: "calendar-task";
      taskId: string;
      sourceDate: string;
    }
  | {
      type: "habit";
      instanceId: string;
      bucketName: string;
    };

export function writeNativeCalendarDragPayload(
  dataTransfer: DataTransfer | null,
  payload: NativeCalendarDragPayload,
) {
  if (!dataTransfer) return;
  const serialized = JSON.stringify(payload);
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(NATIVE_CALENDAR_DND_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
}

export function hasNativeCalendarDragPayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types || []).includes(NATIVE_CALENDAR_DND_MIME);
}

export function readNativeCalendarDragPayload(dataTransfer: DataTransfer | null): NativeCalendarDragPayload | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(NATIVE_CALENDAR_DND_MIME) || dataTransfer.getData("text/plain");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<NativeCalendarDragPayload>;
    if (parsed?.type === "calendar-task" && typeof parsed.taskId === "string" && typeof parsed.sourceDate === "string") {
      return {
        type: "calendar-task",
        taskId: parsed.taskId,
        sourceDate: parsed.sourceDate,
      };
    }
    if (parsed?.type === "habit" && typeof parsed.instanceId === "string" && typeof parsed.bucketName === "string") {
      return {
        type: "habit",
        instanceId: parsed.instanceId,
        bucketName: parsed.bucketName,
      };
    }
  } catch {}

  return null;
}
