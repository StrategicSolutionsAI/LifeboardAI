"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  TreePine,
  Cake,
  Plane,
  Heart,
  Wallet,
  Stethoscope,
  GraduationCap,
  AlarmClock,
  Sparkles,
  PartyPopper,
  Moon,
  Users,
  Sticker,
} from "lucide-react";
import type { CalendarStickerMap } from "@/features/calendar/hooks/use-calendar-stickers";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface StickerOption {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Saturated fill color for the sticker body */
  color: string;
  /** Slightly darker shade for bottom edge / shadow tint */
  colorDark: string;
  /** Light tint for unselected/preview state */
  colorLight: string;
}

export const STICKER_OPTIONS: StickerOption[] = [
  { id: "holiday",     label: "Holiday",     icon: TreePine,      color: "#34d399", colorDark: "#059669", colorLight: "#d1fae5" },
  { id: "birthday",    label: "Birthday",    icon: Cake,          color: "#f472b6", colorDark: "#db2777", colorLight: "#fce7f3" },
  { id: "travel",      label: "Travel",      icon: Plane,         color: "#38bdf8", colorDark: "#0284c7", colorLight: "#e0f2fe" },
  { id: "date-night",  label: "Date Night",  icon: Heart,         color: "#fb7185", colorDark: "#e11d48", colorLight: "#fff1f2" },
  { id: "payday",      label: "Payday",      icon: Wallet,        color: "#a3e635", colorDark: "#65a30d", colorLight: "#ecfccb" },
  { id: "doctor",      label: "Doctor",      icon: Stethoscope,   color: "#2dd4bf", colorDark: "#0d9488", colorLight: "#ccfbf1" },
  { id: "school",      label: "School",      icon: GraduationCap, color: "#818cf8", colorDark: "#4f46e5", colorLight: "#e0e7ff" },
  { id: "deadline",    label: "Deadline",    icon: AlarmClock,    color: "#fb923c", colorDark: "#ea580c", colorLight: "#fff7ed" },
  { id: "self-care",   label: "Self-care",   icon: Sparkles,      color: "#a78bfa", colorDark: "#7c3aed", colorLight: "#f5f3ff" },
  { id: "celebration", label: "Celebration", icon: PartyPopper,   color: "#fbbf24", colorDark: "#d97706", colorLight: "#fffbeb" },
  { id: "rest-day",    label: "Rest Day",    icon: Moon,          color: "#94a3b8", colorDark: "#475569", colorLight: "#f1f5f9" },
  { id: "family",      label: "Family",      icon: Users,         color: "#22d3ee", colorDark: "#0891b2", colorLight: "#ecfeff" },
];

export const STICKER_LOOKUP: Record<string, StickerOption> = Object.fromEntries(
  STICKER_OPTIONS.map((opt) => [opt.id, opt]),
);

export const VALID_STICKER_IDS = new Set(STICKER_OPTIONS.map((o) => o.id));

export const STICKER_PALETTE_WIDTH = 300;
export const STICKER_PALETTE_HEIGHT = 420;

// ---------------------------------------------------------------------------
// Shared sticker style builders
// ---------------------------------------------------------------------------

/** The glossy gradient overlay that gives the "vinyl sticker" sheen */
const glossOverlay = "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0) 60%)";

/** Builds the inline style for a sticker body */
const stickerStyle = (
  option: StickerOption,
  size: "sm" | "md" | "lg" = "md",
): React.CSSProperties => ({
  background: `${glossOverlay}, ${option.color}`,
  border: size === "sm" ? "2px solid white" : "2.5px solid white",
  borderRadius: size === "sm" ? 6 : 10,
  boxShadow: [
    `0 ${size === "sm" ? 1 : 2}px ${size === "sm" ? 3 : 6}px rgba(0,0,0,0.12)`,
    `0 ${size === "sm" ? 1 : 2}px ${size === "sm" ? 6 : 12}px ${option.colorDark}22`,
    `inset 0 -${size === "sm" ? 1 : 1.5}px 0 ${option.colorDark}33`,
  ].join(", "),
});

// ---------------------------------------------------------------------------
// Positioning helper
// ---------------------------------------------------------------------------

export const computeStickerPalettePosition = (target: HTMLElement) => {
  const rect = target.getBoundingClientRect();
  const vw = typeof window !== "undefined" ? window.innerWidth : STICKER_PALETTE_WIDTH;
  const vh = typeof window !== "undefined" ? window.innerHeight : STICKER_PALETTE_HEIGHT;

  const preferredLeft = rect.left + rect.width / 2 - STICKER_PALETTE_WIDTH / 2;
  const clampedLeft = Math.min(Math.max(preferredLeft, 12), vw - STICKER_PALETTE_WIDTH - 12);

  const preferredTop = rect.bottom + 8;
  const clampedTop = Math.min(Math.max(preferredTop, 12), vh - STICKER_PALETTE_HEIGHT - 12);

  return { top: clampedTop, left: clampedLeft };
};

// ---------------------------------------------------------------------------
// StickerChips — compact read-only display for month/week cells
// ---------------------------------------------------------------------------

interface StickerChipsProps {
  dayStr: string;
  stickersByDate: CalendarStickerMap;
  size?: "sm" | "md";
  onRemove?: (dateStr: string, stickerId: string) => void;
}

export const StickerChips = React.memo(function StickerChips({ dayStr, stickersByDate, size = "sm", onRemove }: StickerChipsProps) {
  const dayStickers = stickersByDate[dayStr] ?? [];
  if (dayStickers.length === 0) return null;

  const dim = size === "sm" ? 20 : 24;
  const iconPx = size === "sm" ? 11 : 13;
  const Tag = onRemove ? "button" : "span";

  return (
    <div className="flex items-center gap-0.5 flex-wrap mb-0.5">
      {dayStickers.map((stickerId) => {
        const option = STICKER_LOOKUP[stickerId];
        if (!option) return null;
        const Icon = option.icon;
        return (
          <Tag
            key={`${dayStr}-chip-${stickerId}`}
            type={onRemove ? "button" : undefined}
            className={`inline-flex items-center justify-center select-none ${onRemove ? "transition-all duration-150 hover:scale-110 hover:brightness-110 active:scale-90 cursor-pointer" : ""}`}
            style={{
              width: dim,
              height: dim,
              ...stickerStyle(option, "sm"),
            }}
            title={onRemove ? `Remove ${option.label}` : option.label}
            aria-label={onRemove ? `Remove ${option.label} sticker` : undefined}
            onClick={onRemove ? (e: React.MouseEvent) => { e.stopPropagation(); onRemove(dayStr, stickerId); } : undefined}
          >
            <Icon size={iconPx} strokeWidth={2.5} color="white" />
          </Tag>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// StickerAddButtonCompact — hover-revealed trigger for month/week headers
// ---------------------------------------------------------------------------

interface StickerAddButtonCompactProps {
  dayStr: string;
  stickersByDate: CalendarStickerMap;
  maxStickersPerDay: number;
  activeStickerDay: string | null;
  setActiveStickerDay: (day: string | null) => void;
  setStickerPalettePosition: (pos: { top: number; left: number } | null) => void;
  stickerTriggerRef: React.MutableRefObject<HTMLButtonElement | null>;
}

export const StickerAddButtonCompact = React.memo(function StickerAddButtonCompact({
  dayStr,
  stickersByDate,
  maxStickersPerDay,
  activeStickerDay,
  setActiveStickerDay,
  setStickerPalettePosition,
  stickerTriggerRef,
}: StickerAddButtonCompactProps) {
  const dayStickers = stickersByDate[dayStr] ?? [];
  const reachedLimit = dayStickers.length >= maxStickersPerDay;

  return (
    <button
      type="button"
      ref={dayStr === activeStickerDay ? stickerTriggerRef : undefined}
      className={`lb-sticker-add opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 rounded transition-all ${
        reachedLimit
          ? "text-rose-400 hover:bg-rose-50"
          : "text-theme-text-tertiary hover:bg-theme-brand-tint-strong hover:text-theme-text-secondary"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLButtonElement;

        if (activeStickerDay === dayStr) {
          setActiveStickerDay(null);
          return;
        }

        stickerTriggerRef.current = target;
        setStickerPalettePosition(computeStickerPalettePosition(target));
        setActiveStickerDay(dayStr);
      }}
      title={reachedLimit ? `Sticker limit reached (${maxStickersPerDay})` : "Add sticker"}
      aria-label={reachedLimit ? `Sticker limit reached (${maxStickersPerDay})` : "Add sticker"}
      aria-haspopup="dialog"
      aria-expanded={activeStickerDay === dayStr}
    >
      <Sticker className="h-3.5 w-3.5" />
    </button>
  );
});

// ---------------------------------------------------------------------------
// StickerPalette — sticker sheet picker
// ---------------------------------------------------------------------------

interface StickerPaletteProps {
  dayStr: string;
  dayStickers: string[];
  maxStickersPerDay: number;
  position: { top: number; left: number };
  paletteRef: React.MutableRefObject<HTMLDivElement | null>;
  onAdd: (stickerId: string) => void;
  onRemove: (stickerId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export const StickerPalette = ({
  dayStr,
  dayStickers,
  maxStickersPerDay,
  position,
  paletteRef,
  onAdd,
  onRemove,
  onClear,
  onClose,
}: StickerPaletteProps) => {
  const reachedLimit = dayStickers.length >= maxStickersPerDay;

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      ref={paletteRef}
      className="fixed z-[1200] max-h-[80dvh] w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-2xl p-3 sm:p-4"
      style={{
        top: position.top,
        left: position.left,
        // Sticker sheet backing paper texture
        background: "linear-gradient(180deg, #fafafa 0%, #f5f5f4 100%)",
        border: "1px solid #e7e5e4",
        boxShadow: "0 10px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-1.5">
        <Sticker size={13} className="text-stone-400" />
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
            Sticker Sheet
          </span>
          <span className="text-2xs font-medium text-stone-500">
            {new Date(dayStr + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>

      {/* Sticker grid — 3 columns */}
      <div
        className="grid grid-cols-3 gap-2.5 rounded-xl p-3"
        style={{
          // Subtle grid backing — like the peel-off backing sheet
          background: "repeating-linear-gradient(0deg, transparent, transparent 31px, #e7e5e433 31px, #e7e5e433 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, #e7e5e433 31px, #e7e5e433 32px)",
          border: "1px dashed #d6d3d1",
        }}
      >
        {STICKER_OPTIONS.map((option, idx) => {
          const Icon = option.icon;
          const isSelected = dayStickers.includes(option.id);
          const disabled = !isSelected && reachedLimit;
          return (
            <button
              key={option.id}
              type="button"
              className="group/sticker relative flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200 focus:outline-none"
              style={{
                opacity: disabled ? 0.3 : 1,
                cursor: disabled && !isSelected ? "not-allowed" : "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelected) {
                  onRemove(option.id);
                } else if (!disabled) {
                  onAdd(option.id);
                }
              }}
              aria-pressed={isSelected}
              aria-label={isSelected ? `Remove ${option.label}` : `Add ${option.label}`}
              disabled={disabled && !isSelected}
            >
              {/* The sticker itself */}
              <span
                className="inline-flex items-center justify-center transition-transform duration-200 group-hover/sticker:scale-110 group-active/sticker:scale-95"
                style={{
                  width: 42,
                  height: 42,
                  ...stickerStyle(option, "lg"),
                  ...(!isSelected
                    ? {
                        boxShadow: "0 1px 2px rgba(0,0,0,0.06), inset 0 -1px 0 rgba(0,0,0,0.05)",
                      }
                    : {}),
                }}
              >
                <Icon size={20} strokeWidth={2.2} color="white" />
              </span>
              <span className="text-3xs font-semibold text-stone-500 leading-tight mt-0.5">
                {option.label}
              </span>
              {/* "Peeled off" checkmark */}
              {isSelected && (
                <span
                  className="absolute -right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-3xs font-bold text-white"
                  style={{
                    background: option.colorDark,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                >
                  &#x2713;
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-col gap-2">
        <span className="text-2xs font-medium text-stone-400 text-center">
          {dayStickers.length}/{maxStickersPerDay} placed
        </span>
        <button
          type="button"
          className="w-full rounded-lg bg-theme-primary px-3 py-2 text-xs font-semibold text-white shadow-warm-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-theme-focus/40"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
};

// ---------------------------------------------------------------------------
// StickerRow — full sticker row for day view header
// ---------------------------------------------------------------------------

interface StickerRowProps {
  dayStr: string;
  className?: string;
  stickersByDate: CalendarStickerMap;
  maxStickersPerDay: number;
  activeStickerDay: string | null;
  setActiveStickerDay: (day: string | null) => void;
  setStickerPalettePosition: (pos: { top: number; left: number } | null) => void;
  stickerTriggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  removeStickerFromDate: (dateStr: string, stickerId: string) => void;
}

export const StickerRow = ({
  dayStr,
  className,
  stickersByDate,
  maxStickersPerDay,
  activeStickerDay,
  setActiveStickerDay,
  setStickerPalettePosition,
  stickerTriggerRef,
  removeStickerFromDate,
}: StickerRowProps) => {
  const dayStickers = stickersByDate[dayStr] ?? [];
  const reachedLimit = dayStickers.length >= maxStickersPerDay;

  return (
    <div className={className ?? ""}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Add sticker trigger */}
        <button
          type="button"
          ref={dayStr === activeStickerDay ? stickerTriggerRef : undefined}
          onClick={(e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;

            if (activeStickerDay === dayStr) {
              setActiveStickerDay(null);
              return;
            }

            stickerTriggerRef.current = target;
            setStickerPalettePosition(computeStickerPalettePosition(target));
            setActiveStickerDay(dayStr);
          }}
          className={[
            "order-first inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-stone-300 sm:order-none sm:w-auto sm:px-3.5",
            reachedLimit
              ? "border-rose-300 bg-rose-50/50 text-rose-400 hover:border-rose-400"
              : "border-stone-300 bg-white/80 text-stone-400 hover:border-stone-400 hover:bg-stone-50 hover:text-stone-500",
          ].join(" ")}
          aria-haspopup="dialog"
          aria-expanded={activeStickerDay === dayStr}
          aria-label={reachedLimit ? `Sticker limit reached (${maxStickersPerDay})` : "Add sticker"}
          title={reachedLimit ? `Sticker limit reached (${maxStickersPerDay})` : "Add sticker"}
        >
          <Sticker className="h-3.5 w-3.5" />
          <span>Add Sticker</span>
        </button>

        {/* Existing stickers — physical planner sticker style */}
        {dayStickers.map((stickerId, idx) => {
          const option = STICKER_LOOKUP[stickerId];
          if (!option) return null;
          const Icon = option.icon;
          return (
            <button
              key={`${dayStr}-${stickerId}`}
              type="button"
              title={`Remove ${option.label} sticker`}
              aria-label={`Remove ${option.label} sticker`}
              onClick={(e) => {
                e.stopPropagation();
                removeStickerFromDate(dayStr, stickerId);
              }}
              className="group/sticker inline-flex items-center gap-1.5 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-1 active:scale-95"
              style={{
                ...stickerStyle(option, "md"),
                padding: "5px 10px 5px 8px",
              }}
            >
              <Icon size={14} strokeWidth={2.5} color="white" />
              <span className="text-2xs font-bold text-white/90 drop-shadow-sm">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
