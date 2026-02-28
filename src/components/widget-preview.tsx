"use client";

import { WidgetInstance } from "@/types/widgets";
import React from "react";
import { iconMap } from "@/lib/dashboard-utils";

// Local colour utility (same as widget-library)
const colorClassMap: Record<string, string> = {
  blue: "bg-warm-500",
  green: "bg-green-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  purple: "bg-amber-500",
  indigo: "bg-warm-500",
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


// Re-use a tiny version of the dashboard card so users can see changes instantly
export function WidgetPreview({
  widget,
  draggable = false,
  onDragStart,
  onUpdate,
  bucketColor
}: {
  widget: WidgetInstance;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onUpdate?: (widget: WidgetInstance) => void;
  bucketColor?: string;
}) {
  let Icon: any = null;
  if (typeof widget.icon === 'string') {
    const key = widget.icon.replace(/^Lucide/, '');
    Icon = iconMap[key] ?? iconMap[widget.icon] ?? null;
  } else if (typeof widget.icon === 'function') {
    Icon = widget.icon;
  }

  // Fallback to icon based on template id if unresolved
  if (!Icon && widget.id) {
    Icon = iconMap[widget.id] ?? iconMap[widget.id.charAt(0).toUpperCase() + widget.id.slice(1)] ?? null;
  }

  // Lucide icons are React.forwardRef objects (typeof === 'object'), but they can be
  // used directly as components. Treat any truthy value as a valid icon component.
  const SafeIcon = Icon as any;

  return (
    <div 
      className={`w-48 rounded-lg border bg-white p-3 shadow-sm ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      data-widget-id={widget.instanceId}
    >
      {/* Social widgets with headline next to icon */}
      {(widget.id === 'birthdays' && widget.birthdayData && widget.birthdayData.friendName) ? (
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: bucketColor || '#B1916A' }}
            >
              {SafeIcon ? (
                <SafeIcon className="h-4 w-4 text-white" />
              ) : (
                <span className="text-white text-xs">?</span>
              )}
            </div>
            <span className="text-sm font-medium truncate">{widget.birthdayData.friendName}</span>
          </div>
          <div className="mt-1 pl-8">
            <p className="text-xs text-theme-text-tertiary">
              {widget.birthdayData.birthDate ? new Date(widget.birthdayData.birthDate).toLocaleDateString() : 'Birthday not set'}
            </p>
          </div>
        </>
      ) : (widget.id === 'social_events' && widget.eventData && widget.eventData.eventName) ? (
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: bucketColor || '#B1916A' }}
            >
              {SafeIcon ? (
                <SafeIcon className="h-4 w-4 text-white" />
              ) : (
                <span className="text-white text-xs">?</span>
              )}
            </div>
            <span className="text-sm font-medium truncate">{widget.eventData.eventName}</span>
          </div>
          <div className="mt-1 pl-8">
            <p className="text-xs text-theme-text-tertiary">
              {widget.eventData.eventDate ? new Date(widget.eventData.eventDate).toLocaleDateString() : 'Event date not set'}
            </p>
          </div>
        </>
      ) : (widget.id === 'holidays' && widget.holidayData && widget.holidayData.holidayName) ? (
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: bucketColor || '#B1916A' }}
            >
              {SafeIcon ? (
                <SafeIcon className="h-4 w-4 text-white" />
              ) : (
                <span className="text-white text-xs">?</span>
              )}
            </div>
            <span className="text-sm font-medium truncate">{widget.holidayData.holidayName}</span>
          </div>
          <div className="mt-1 pl-8">
            <p className="text-xs text-theme-text-tertiary">
              {widget.holidayData.holidayDate ? new Date(widget.holidayData.holidayDate).toLocaleDateString() : 'Date not set'}
            </p>
          </div>
        </>
      ) : (
        /* Regular widgets with standard layout */
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: bucketColor || '#B1916A' }}
            >
              {SafeIcon ? (
                <SafeIcon className="h-4 w-4 text-white" />
              ) : (
                <span className="text-white text-xs">?</span>
              )}
            </div>
            {widget.id === 'birthdays' && widget.birthdayData && widget.birthdayData.friendName ? (
              <span className="text-sm font-medium truncate">{widget.birthdayData.friendName}</span>
            ) : widget.id === 'quit_habit' && widget.quitHabitData && widget.quitHabitData.habitName ? (
              <span className="text-sm font-medium truncate">{widget.quitHabitData.habitName}</span>
            ) : widget.id === 'social_events' && widget.eventData && widget.eventData.eventName ? (
              <span className="text-sm font-medium truncate">{widget.eventData.eventName}</span>
            ) : widget.id === 'holidays' && widget.holidayData && widget.holidayData.holidayName ? (
              <span className="text-sm font-medium truncate">{widget.holidayData.holidayName}</span>
            ) : (
              <span className="text-sm font-medium truncate">{widget.name}</span>
            )}
          </div>

          {/* Empty states for social widgets */}
          {widget.id === 'birthdays' && widget.birthdayData ? (
            <div className="mt-1">
              <p className="text-xs text-theme-text-tertiary">Click to add birthday</p>
            </div>
          ) : widget.id === 'social_events' && widget.eventData ? (
            <div className="mt-1">
              <p className="text-xs text-theme-text-tertiary">Click to add event</p>
            </div>
          ) : widget.id === 'holidays' && widget.holidayData ? (
            <div className="mt-1">
              <p className="text-xs text-theme-text-tertiary">Click to add holiday</p>
            </div>
          ) : widget.id === 'quit_habit' && widget.quitHabitData ? (
            <div className="mt-1">
              {widget.quitHabitData.habitName && widget.quitHabitData.quitDate ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">🚫</span>
                    <p className="text-xs font-medium text-theme-text-body">
                      Quitting {widget.quitHabitData.habitName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">📅</span>
                    <p className="text-xs text-theme-text-tertiary">
                      Since {new Date(widget.quitHabitData.quitDate).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">
                    {(() => {
                      const quitDate = new Date(widget.quitHabitData.quitDate);
                      const today = new Date();
                      const daysSince = Math.floor((today.getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24));
                      return `${daysSince} days clean`;
                    })()}
                  </p>
                  {widget.quitHabitData.costPerDay && widget.quitHabitData.costPerDay > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">💰</span>
                      <p className="text-xs text-theme-text-tertiary">
                        Daily savings: {widget.quitHabitData.currency || '$'}{widget.quitHabitData.costPerDay.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {onUpdate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const today = new Date().toISOString().split('T')[0];
                        const quitDate = new Date(widget.quitHabitData?.quitDate || '');
                        const daysSince = Math.floor((new Date().getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24));
                        
                        // Add check-in milestone
                        const updatedWidget = {
                          ...widget,
                          quitHabitData: {
                            ...widget.quitHabitData,
                            milestones: [
                              ...(widget.quitHabitData?.milestones || []),
                              {
                                days: daysSince,
                                label: `Day ${daysSince} Check-in`,
                                achieved: true,
                                achievedDate: today
                              }
                            ]
                          }
                        };
                        
                        onUpdate(updatedWidget);
                        alert(`✅ Great job! You've successfully stayed clean for ${daysSince} days. Keep it up!`);
                      }}
                      className="w-full mt-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium border border-green-200 hover:bg-green-200 transition-colors"
                    >
                      ✅ Check In for Today
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-theme-text-tertiary">Click to set up habit tracking</p>
              )}
            </div>
          ) : widget.id === 'weight' && widget.weightData ? (
            <div className="mt-1">
              {widget.weightData.currentWeight ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">⚖️</span>
                    <p className="text-xs font-medium text-theme-text-body">
                      Current Weight
                    </p>
                  </div>
                  <p className="text-lg font-bold text-amber-600">
                    {widget.weightData.currentWeight} {widget.weightData.unit || widget.unit || 'lbs'}
                  </p>
                  
                  {widget.weightData.startingWeight && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">📈</span>
                      <p className={`text-xs ${
                        widget.weightData.currentWeight < widget.weightData.startingWeight 
                          ? 'text-green-600' 
                          : widget.weightData.currentWeight > widget.weightData.startingWeight 
                          ? 'text-orange-600' 
                          : 'text-theme-text-subtle'
                      }`}>
                        {widget.weightData.currentWeight < widget.weightData.startingWeight ? 'Lost' : 
                         widget.weightData.currentWeight > widget.weightData.startingWeight ? 'Gained' : 'No change'}: {Math.abs(widget.weightData.currentWeight - widget.weightData.startingWeight).toFixed(1)} {widget.weightData.unit || widget.unit || 'lbs'}
                      </p>
                    </div>
                  )}
                  
                  {widget.weightData.goalWeight && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">🎯</span>
                      <p className="text-xs text-warm-600">
                        Goal: {widget.weightData.goalWeight} {widget.weightData.unit || widget.unit || 'lbs'}
                      </p>
                    </div>
                  )}
                  
                  {widget.weightData.entries && widget.weightData.entries.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">📊</span>
                      <p className="text-xs text-theme-text-tertiary">
                        {widget.weightData.entries.length} entries logged
                      </p>
                    </div>
                  )}
                  
                  {onUpdate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const weight = prompt(`Enter today's weight (${widget.weightData?.unit || widget.unit || 'lbs'}):`);
                        if (weight && !isNaN(parseFloat(weight))) {
                          const today = new Date().toISOString().split('T')[0];
                          const newWeight = parseFloat(weight);
                          
                          const updatedWidget = {
                            ...widget,
                            weightData: {
                              ...widget.weightData,
                              currentWeight: newWeight,
                              entries: [
                                ...(widget.weightData?.entries || []),
                                {
                                  date: today,
                                  weight: newWeight,
                                  note: 'Quick log from widget'
                                }
                              ],
                              lastEntryDate: today
                            }
                          };
                          
                          onUpdate(updatedWidget);
                          alert(`✅ Weight logged: ${weight} ${widget.weightData?.unit || widget.unit || 'lbs'}`);
                        }
                      }}
                      className="w-full mt-2 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium border border-purple-200 hover:bg-amber-200 transition-colors"
                    >
                      📝 Log Weight
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-theme-text-tertiary">Click to set up weight tracking</p>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* Other specialized widget content */}
      {widget.id === 'mood' && widget.moodData ? (
        <div className="mt-1">
          {widget.moodData.currentMood ? (
            <div className="flex items-center gap-1">
              <span className="text-sm">
                {['😢', '😕', '😐', '😊', '😁'][widget.moodData.currentMood - 1]}
              </span>
              <span className="text-xs text-theme-text-subtle">
                {['Very Poor', 'Poor', 'Neutral', 'Good', 'Excellent'][widget.moodData.currentMood - 1]}
              </span>
            </div>
          ) : (
            <p className="text-xs text-theme-text-tertiary">Tap to log mood</p>
          )}
        </div>
      ) : widget.id === 'journal' && widget.journalData ? (
        <div className="mt-1">
          {widget.journalData.todaysEntry ? (
            <>
              <p className="text-xs text-theme-text-body truncate">
                {widget.journalData.todaysEntry.slice(0, 50)}...
              </p>
              <p className="text-xs text-theme-text-tertiary">
                {widget.journalData.todaysEntry.split(' ').length} words
              </p>
            </>
          ) : (
            <p className="text-xs text-theme-text-tertiary">No entry today</p>
          )}
        </div>
      ) : widget.id === 'gratitude' && widget.gratitudeData ? (
        <div className="mt-1">
          {widget.gratitudeData.gratitudeItems && widget.gratitudeData.gratitudeItems.length > 0 && widget.gratitudeData.gratitudeItems[0] ? (
            <>
              <p className="text-xs text-theme-text-body truncate">
                {widget.gratitudeData.gratitudeItems[0]}
              </p>
              <p className="text-xs text-theme-text-tertiary">
                {widget.gratitudeData.gratitudeItems.filter(item => item.trim()).length} items
              </p>
            </>
          ) : (
            <p className="text-xs text-theme-text-tertiary">What are you grateful for?</p>
          )}
        </div>
      ) : null}
    </div>
  );
} 
