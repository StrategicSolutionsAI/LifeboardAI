import { useCallback, useEffect, useState } from "react";
import { VALID_STICKER_IDS } from "@/components/calendar-stickers";

export type CalendarStickerMap = Record<string, string[]>;

const STORAGE_KEY = "lifeboard-calendar-stickers";
export const MAX_STICKERS_PER_DAY = 5;

/** Map old sticker IDs (v1) → new life-event IDs (v2). */
const STICKER_MIGRATION: Record<string, string> = {
  celebrate: "celebration",
  "self-care": "self-care",
  "coffee-break": "rest-day",
  sunshine: "holiday",
  focus: "deadline",
  movement: "self-care",
};

const migrateStickerId = (id: string): string | null => {
  if (VALID_STICKER_IDS.has(id)) return id;
  const mapped = STICKER_MIGRATION[id];
  return mapped && VALID_STICKER_IDS.has(mapped) ? mapped : null;
};

const sanitizeStickerMap = (input: unknown): CalendarStickerMap => {
  if (!input || typeof input !== "object") return {};

  const next: CalendarStickerMap = {};
  for (const [dateKey, value] of Object.entries(input)) {
    if (!Array.isArray(value)) continue;

    const seen = new Set<string>();
    const sanitized: string[] = [];

    for (const item of value) {
      if (typeof item !== "string" || item.trim().length === 0) continue;
      const migrated = migrateStickerId(item);
      if (!migrated || seen.has(migrated)) continue;
      seen.add(migrated);
      sanitized.push(migrated);
      if (sanitized.length >= MAX_STICKERS_PER_DAY) break;
    }

    if (sanitized.length > 0) {
      next[dateKey] = sanitized;
    }
  }

  return next;
};

const readInitialState = (): CalendarStickerMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return sanitizeStickerMap(parsed);
  } catch {
    return {};
  }
};

export function useCalendarStickers() {
  const [stickersByDate, setStickersByDate] = useState<CalendarStickerMap>(() => readInitialState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stickersByDate));
  }, [stickersByDate]);

  const addStickerToDate = useCallback((dateStr: string, stickerId: string) => {
    if (!dateStr || !stickerId) return;

    setStickersByDate((prev) => {
      const existing = prev[dateStr] ?? [];
      if (existing.includes(stickerId)) return prev;
      if (existing.length >= MAX_STICKERS_PER_DAY) return prev;

      return {
        ...prev,
        [dateStr]: [...existing, stickerId],
      };
    });
  }, []);

  const removeStickerFromDate = useCallback((dateStr: string, stickerId: string) => {
    if (!dateStr || !stickerId) return;

    setStickersByDate((prev) => {
      const existing = prev[dateStr];
      if (!existing) return prev;

      const updated = existing.filter((id) => id !== stickerId);
      if (updated.length === 0) {
        const { [dateStr]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [dateStr]: updated,
      };
    });
  }, []);

  const clearStickersForDate = useCallback((dateStr: string) => {
    if (!dateStr) return;

    setStickersByDate((prev) => {
      if (!(dateStr in prev)) return prev;
      const { [dateStr]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    stickersByDate,
    addStickerToDate,
    removeStickerFromDate,
    clearStickersForDate,
  };
}
