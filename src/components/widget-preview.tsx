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
  // Specialized widgets
  birthdays: Icons.Cake,
  social_events: Icons.PartyPopper,
  holidays: Icons.Gift,
  mood: Icons.Smile,
  journal: Icons.Notebook,
  gratitude: Icons.Sparkles,
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
    const key = widget.icon.replace(/^Lucide/, '');
    Icon = (Icons as any)[key] ?? (Icons as any)[widget.icon] ?? null;
  } else if (typeof widget.icon === 'function') {
    Icon = widget.icon;
  }

  // Fallback to icon based on template id if unresolved
  if (!Icon) {
    Icon = idToIconMap[widget.id] ?? (Icons as any)[widget.id?.charAt(0).toUpperCase() + widget.id?.slice(1)] ?? null;
  }

  // Lucide icons are React.forwardRef objects (typeof === 'object'), but they can be
  // used directly as components. Treat any truthy value as a valid icon component.
  const SafeIcon = Icon as any;

  if (process.env.NODE_ENV === 'development') {
    console.log('⧗ preview icon debug\tid:', widget.id, '\ticon prop:', widget.icon, '\tresolved:', Icon?.name ?? 'null');
  }

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
      {/* Specialized widget content matching dashboard display */}
      {widget.id === 'birthdays' && widget.birthdayData ? (
        <div className="mt-1">
          {widget.birthdayData.friendName && widget.birthdayData.birthDate ? (
            <>
              <p className="text-xs font-medium text-gray-700">{widget.birthdayData.friendName}</p>
              <p className="text-xs text-gray-500">
                {new Date(widget.birthdayData.birthDate).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Click to add birthday</p>
          )}
        </div>
      ) : widget.id === 'social_events' && widget.eventData ? (
        <div className="mt-1">
          {widget.eventData.eventName && widget.eventData.eventDate ? (
            <>
              <p className="text-xs font-medium text-gray-700">{widget.eventData.eventName}</p>
              <p className="text-xs text-gray-500">
                {new Date(widget.eventData.eventDate).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Click to add event</p>
          )}
        </div>
      ) : widget.id === 'holidays' && widget.holidayData ? (
        <div className="mt-1">
          {widget.holidayData.holidayName && widget.holidayData.holidayDate ? (
            <>
              <p className="text-xs font-medium text-gray-700">{widget.holidayData.holidayName}</p>
              <p className="text-xs text-gray-500">
                {new Date(widget.holidayData.holidayDate).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Click to add holiday</p>
          )}
        </div>
      ) : widget.id === 'mood' && widget.moodData ? (
        <div className="mt-1">
          {widget.moodData.currentMood ? (
            <div className="flex items-center gap-1">
              <span className="text-sm">
                {['😢', '😕', '😐', '😊', '😁'][widget.moodData.currentMood - 1]}
              </span>
              <span className="text-xs text-gray-600">
                {['Very Poor', 'Poor', 'Neutral', 'Good', 'Excellent'][widget.moodData.currentMood - 1]}
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Tap to log mood</p>
          )}
        </div>
      ) : widget.id === 'journal' && widget.journalData ? (
        <div className="mt-1">
          {widget.journalData.todaysEntry ? (
            <>
              <p className="text-xs text-gray-700 truncate">
                {widget.journalData.todaysEntry.slice(0, 50)}...
              </p>
              <p className="text-xs text-gray-500">
                {widget.journalData.todaysEntry.split(' ').length} words
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">No entry today</p>
          )}
        </div>
      ) : widget.id === 'gratitude' && widget.gratitudeData ? (
        <div className="mt-1">
          {widget.gratitudeData.gratitudeItems && widget.gratitudeData.gratitudeItems.length > 0 && widget.gratitudeData.gratitudeItems[0] ? (
            <>
              <p className="text-xs text-gray-700 truncate">
                {widget.gratitudeData.gratitudeItems[0]}
              </p>
              <p className="text-xs text-gray-500">
                {widget.gratitudeData.gratitudeItems.filter(item => item.trim()).length} items
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">What are you grateful for?</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-gray-500 truncate">
          Target: {widget.target} {widget.unit}
        </p>
      )}
      {widget.schedule && !['birthdays', 'social_events', 'holidays', 'mood', 'journal', 'gratitude'].includes(widget.id) && (
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