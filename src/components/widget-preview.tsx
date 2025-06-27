"use client";

import { WidgetInstance } from "@/types/widgets";
import React from "react";
import * as Icons from "lucide-react";

// Local colour utility (same as widget-library)
const colorClassMap: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  yellow: "bg-yellow-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  lime: "bg-lime-500",
  fuchsia: "bg-fuchsia-500",
  gray: "bg-gray-500",
  slate: "bg-slate-500",
  stone: "bg-stone-500",
};

const getColorClass = (color: string) => colorClassMap[color] || "bg-gray-500";

// Mapping of widget template IDs to Lucide icons (minimal set used in preview)
const idToIconMap: Record<string, any> = {
  water: Icons.Droplets,
  calories: Icons.Flame,
  steps: Icons.Target,
  weight: Icons.Scale,
  heartrate: Icons.Heart,
  sleep: Icons.Moon,
  exercise: Icons.Activity,
  caffeine: Icons.Coffee,
};

// Re-use a tiny version of the dashboard card so users can see changes instantly
export function WidgetPreview({ 
  widget, 
  draggable = false, 
  onDragStart 
}: { 
  widget: WidgetInstance; 
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  let Icon: any = null;
  if (typeof widget.icon === 'string') {
    Icon = (Icons as any)[widget.icon] ?? null;
  } else if (typeof widget.icon === 'function') {
    Icon = widget.icon;
  }

  // Fallback to icon based on template id if unresolved or invalid
  if (!Icon || typeof Icon !== 'function') {
    Icon = idToIconMap[widget.id] ?? (Icons as any)[widget.id?.charAt(0).toUpperCase() + widget.id?.slice(1)] ?? null;
  }

  const SafeIcon = typeof Icon === 'function' ? Icon : null;

  return (
    <div 
      className={`w-48 rounded-lg border bg-white p-3 shadow-sm ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      data-widget-id={widget.instanceId}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded flex items-center justify-center ${getColorClass(
            widget.color ?? "gray"
          )}`}
        >
          {SafeIcon ? (
            <SafeIcon className="h-4 w-4 text-white" />
          ) : (
            <span className="text-white text-xs">?</span>
          )}
        </div>
        <span className="text-sm font-medium truncate">{widget.name}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500 truncate">
        Target: {widget.target} {widget.unit}
      </p>
      {widget.schedule && (
        <p className="mt-1 text-[10px] text-gray-400 truncate">
          {widget.schedule
            .map((enabled, idx) => {
              const labels = ["S","M","T","W","T","F","S"];
              return enabled ? labels[idx] : "·";
            })
            .join(" ")}
        </p>
      )}
    </div>
  );
} 