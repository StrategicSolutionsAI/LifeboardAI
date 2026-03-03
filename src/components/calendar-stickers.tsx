"use client";

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
import type { CalendarStickerMap } from "@/hooks/use-calendar-stickers";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface StickerOption {
  id: string;
  label: string;
  icon: LucideIcon;
  backgroundClass: string;
  textClass: string;
  ringClass: string;
}

export const STICKER_OPTIONS: StickerOption[] = [
  { id: "holiday",     label: "Holiday",     icon: TreePine,      backgroundClass: "bg-emerald-50",  textClass: "text-emerald-600",  ringClass: "ring-emerald-200/70" },
  { id: "birthday",    label: "Birthday",    icon: Cake,          backgroundClass: "bg-pink-50",     textClass: "text-pink-500",     ringClass: "ring-pink-200/70" },
  { id: "travel",      label: "Travel",      icon: Plane,         backgroundClass: "bg-sky-50",      textClass: "text-sky-500",      ringClass: "ring-sky-200/70" },
  { id: "date-night",  label: "Date Night",  icon: Heart,         backgroundClass: "bg-rose-50",     textClass: "text-rose-500",     ringClass: "ring-rose-200/70" },
  { id: "payday",      label: "Payday",      icon: Wallet,        backgroundClass: "bg-lime-50",     textClass: "text-lime-600",     ringClass: "ring-lime-200/70" },
  { id: "doctor",      label: "Doctor",      icon: Stethoscope,   backgroundClass: "bg-teal-50",     textClass: "text-teal-600",     ringClass: "ring-teal-200/70" },
  { id: "school",      label: "School",      icon: GraduationCap, backgroundClass: "bg-indigo-50",   textClass: "text-indigo-500",   ringClass: "ring-indigo-200/70" },
  { id: "deadline",    label: "Deadline",    icon: AlarmClock,    backgroundClass: "bg-orange-50",   textClass: "text-orange-500",   ringClass: "ring-orange-200/70" },
  { id: "self-care",   label: "Self-care",   icon: Sparkles,      backgroundClass: "bg-violet-50",   textClass: "text-violet-500",   ringClass: "ring-violet-200/70" },
  { id: "celebration", label: "Celebration", icon: PartyPopper,   backgroundClass: "bg-amber-50",    textClass: "text-amber-600",    ringClass: "ring-amber-200/70" },
  { id: "rest-day",    label: "Rest Day",    icon: Moon,          backgroundClass: "bg-slate-50",    textClass: "text-slate-500",    ringClass: "ring-slate-200/70" },
  { id: "family",      label: "Family",      icon: Users,         backgroundClass: "bg-cyan-50",     textClass: "text-cyan-600",     ringClass: "ring-cyan-200/70" },
];

export const STICKER_LOOKUP: Record<string, StickerOption> = Object.fromEntries(
  STICKER_OPTIONS.map((opt) => [opt.id, opt]),
);

export const VALID_STICKER_IDS = new Set(STICKER_OPTIONS.map((o) => o.id));

export const STICKER_PALETTE_WIDTH = 280;
export const STICKER_PALETTE_HEIGHT = 360;

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
}

export const StickerChips = ({ dayStr, stickersByDate, size = "sm" }: StickerChipsProps) => {
  const dayStickers = stickersByDate[dayStr] ?? [];
  if (dayStickers.length === 0) return null;

  const chipSize = size === "sm" ? "w-[18px] h-[18px]" : "w-[22px] h-[22px]";
  const iconPx = size === "sm" ? 10 : 12;

  return (
    <div className="flex items-center gap-0.5 flex-wrap mb-0.5">
      {dayStickers.map((stickerId) => {
        const option = STICKER_LOOKUP[stickerId];
        if (!option) return null;
        const Icon = option.icon;
        return (
          <span
            key={`${dayStr}-chip-${stickerId}`}
            className={`inline-flex items-center justify-center rounded-full ${chipSize} ${option.backgroundClass} ${option.textClass} ring-1 ${option.ringClass}`}
            title={option.label}
          >
            <Icon size={iconPx} strokeWidth={2} />
          </span>
        );
      })}
    </div>
  );
};

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

export const StickerAddButtonCompact = ({
  dayStr,
  stickersByDate,
  maxStickersPerDay,
  activeStickerDay,
  setActiveStickerDay,
  setStickerPalettePosition,
  stickerTriggerRef,
}: StickerAddButtonCompactProps) => {
  const dayStickers = stickersByDate[dayStr] ?? [];
  const reachedLimit = dayStickers.length >= maxStickersPerDay;

  return (
    <button
      type="button"
      ref={dayStr === activeStickerDay ? stickerTriggerRef : undefined}
      className={`lb-sticker-add opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${
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
};

// ---------------------------------------------------------------------------
// StickerPalette — single shared portal palette
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
      className="fixed z-[1200] max-h-[80vh] w-[280px] overflow-hidden rounded-xl border border-theme-neutral-300 bg-white/95 p-3 shadow-xl ring-1 ring-theme-neutral-300 backdrop-blur-sm"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-theme-text-tertiary/70">
          Add sticker
        </span>
        <button
          type="button"
          className="text-[11px] text-theme-text-tertiary/70 transition hover:text-theme-text-subtle focus:outline-none focus:ring-1 focus:ring-[rgba(163,133,96,0.4)] rounded px-1"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          Close
        </button>
      </div>

      {/* Sticker grid — 4 columns */}
      <div className="grid grid-cols-4 gap-1.5">
        {STICKER_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = dayStickers.includes(option.id);
          const disabled = !isSelected && reachedLimit;
          return (
            <button
              key={option.id}
              type="button"
              className={[
                "flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-theme-text-tertiary transition focus:outline-none focus:ring-[3px] focus:ring-theme-focus/15",
                isSelected
                  ? `${option.backgroundClass} ${option.textClass} ring-2 ${option.ringClass} shadow-sm`
                  : "bg-theme-surface-alt hover:bg-theme-brand-tint-light",
                disabled ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
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
              <Icon className="h-4 w-4" />
              <span className="text-[9px] font-medium leading-tight">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-2 text-[10px] text-theme-text-tertiary/60">
        <p>{dayStickers.length}/{maxStickersPerDay} stickers · tap to toggle</p>
      </div>

      {dayStickers.length > 0 && (
        <button
          type="button"
          className="mt-1.5 w-full rounded-lg border border-theme-neutral-300 px-2 py-1 text-[11px] font-medium text-theme-text-tertiary transition hover:bg-theme-surface-alt focus:outline-none focus:ring-1 focus:ring-[rgba(163,133,96,0.4)]"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          Clear stickers
        </button>
      )}
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
  const stickerButtonCommon =
    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent shadow-sm transition hover:shadow-warm focus:outline-none focus:ring-[3px] focus:ring-theme-focus/15";

  return (
    <div className={className ?? ""}>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
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
            "order-first inline-flex w-full items-center justify-center gap-1 rounded-full border border-dashed bg-white px-2.5 py-1.5 text-[11px] font-semibold text-theme-text-subtle shadow-sm transition focus:outline-none focus:ring-[3px] focus:ring-theme-focus/15 sm:order-none sm:w-auto sm:px-3",
            reachedLimit
              ? "border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-600"
              : "border-theme-neutral-300 hover:border-theme-secondary hover:text-theme-primary-600",
          ].join(" ")}
          aria-haspopup="dialog"
          aria-expanded={activeStickerDay === dayStr}
          aria-label={reachedLimit ? `Sticker limit reached (${maxStickersPerDay})` : "Add sticker"}
          title={reachedLimit ? `Sticker limit reached (${maxStickersPerDay})` : "Add sticker"}
        >
          <Sticker className="h-3.5 w-3.5" />
          <span className="ml-1">Sticker</span>
        </button>

        {/* Existing stickers */}
        {dayStickers.map((stickerId) => {
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
              className={`${stickerButtonCommon} ${option.backgroundClass} ${option.textClass} ring-1 ${option.ringClass}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
