import React from 'react'
import { Card } from '@/components/ui/card'

export function CalendarDaySkeleton() {
  return (
    <div className="h-full p-2">
      <div className="mb-2 h-6 w-10 bg-gray-200 rounded animate-pulse" />
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="h-4 bg-gray-100 rounded animate-pulse"
            style={{ width: `${60 + i * 10}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function CalendarWeekSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="bg-white p-2 min-h-[100px]">
          <CalendarDaySkeleton />
        </div>
      ))}
    </div>
  )
}

export function CalendarMonthSkeleton() {
  return (
    <div className="space-y-px">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      {[...Array(5)].map((_, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-px bg-gray-200">
          {[...Array(7)].map((_, dayIndex) => (
            <div 
              key={dayIndex} 
              className="bg-white p-2 min-h-[80px] border border-gray-100"
            >
              <div className="mb-1 h-5 w-8 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-1">
                {[1, 2].map((i) => (
                  <div 
                    key={i} 
                    className="h-3 bg-gray-100 rounded animate-pulse"
                    style={{ width: `${50 + i * 15}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function TaskListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {/* Section header skeleton */}
      <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
      
      {/* Task items skeleton */}
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-3 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-4 w-4 bg-gray-300 rounded mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded" style={{ width: `${70 + i * 5}%` }} />
              <div className="flex gap-2">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function HourlyPlannerSkeleton() {
  return (
    <div className="space-y-1 p-4">
      {/* Time slots */}
      {['7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM'].map((time) => (
        <div key={time} className="flex gap-2 items-center">
          <div className="w-12 text-xs text-gray-500">{time}</div>
          <div className="flex-1 h-12 bg-gray-50 border border-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function CalendarHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  )
}
