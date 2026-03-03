"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";

interface TasksDailyProgressProps {
  completedToday: number;
  totalToday: number;
  streakDays?: number;
}

const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const;

function getStreakMilestone(days: number): number | null {
  for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
    if (days >= STREAK_MILESTONES[i]) return STREAK_MILESTONES[i];
  }
  return null;
}

export function TasksDailyProgress({
  completedToday,
  totalToday,
  streakDays = 0,
}: TasksDailyProgressProps) {
  const percentage = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const prevPercentage = useRef(percentage);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (percentage === 100 && prevPercentage.current < 100 && totalToday > 0) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 2000);
      return () => clearTimeout(timer);
    }
    prevPercentage.current = percentage;
  }, [percentage, totalToday]);

  const milestone = getStreakMilestone(streakDays);

  return (
    <div className={`mb-6 p-5 bg-gradient-to-r from-warm-50 via-warm-100 to-warm-50 rounded-xl border border-warm-200 shadow-sm ${celebrating ? "animate-celebration-pulse" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-warm-600" />
          <span className="font-semibold text-theme-text-primary">Today&apos;s Progress</span>
        </div>
        <div className="flex items-center gap-2">
          {milestone && STREAK_MILESTONES.includes(streakDays as typeof STREAK_MILESTONES[number]) && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full animate-row-enter">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span className="text-xs font-semibold text-amber-700">{streakDays}-day streak!</span>
            </div>
          )}
          {streakDays > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-orange-100 rounded-full">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-medium text-orange-700">{streakDays} day streak</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-warm-700">
          {completedToday} of {totalToday} tasks completed
        </span>
        <span className="text-sm font-bold text-warm-700">{percentage}%</span>
      </div>

      <div className="relative w-full bg-white/60 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-warm-500 to-warm-600 h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${percentage}%` }}
        />
        {celebrating && (
          <div className="absolute inset-0 rounded-full animate-shimmer" />
        )}
      </div>

      {percentage === 100 && totalToday > 0 && (
        <p className={`text-sm text-warm-700 mt-3 font-medium text-center ${celebrating ? "animate-row-enter" : ""}`}>
          🎉 Amazing! You&apos;ve completed all your tasks for today!
        </p>
      )}
    </div>
  );
}
