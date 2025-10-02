"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

interface TasksDailyProgressProps {
  completedToday: number;
  totalToday: number;
  streakDays?: number;
}

export function TasksDailyProgress({
  completedToday,
  totalToday,
  streakDays = 0,
}: TasksDailyProgressProps) {
  const percentage = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  
  return (
    <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 rounded-xl border border-blue-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Today's Progress</span>
        </div>
        {streakDays > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-orange-100 rounded-full">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-medium text-orange-700">{streakDays} day streak</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue-700">
          {completedToday} of {totalToday} tasks completed
        </span>
        <span className="text-sm font-bold text-blue-700">{percentage}%</span>
      </div>
      
      <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {percentage === 100 && totalToday > 0 && (
        <p className="text-sm text-blue-700 mt-3 font-medium text-center">
          🎉 Amazing! You've completed all your tasks for today!
        </p>
      )}
    </div>
  );
}
