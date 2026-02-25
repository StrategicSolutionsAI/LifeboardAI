"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Calendar, Sparkles, ChevronLeft, ChevronRight } from "lucide-react"
import { format, addDays } from "date-fns"

interface Task {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  color: string
}

export function TaskColumn() {
  const today = new Date()

  const calendarDays = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(today, i)
    return {
      date: d.getDate(),
      day: format(d, 'EEE'),
      active: i === 0,
    }
  })
  


  const tasks = [
    {
      date: "Nov 13",
      dayLabel: "Today Tuesday",
      items: [
        {
          id: "1",
          text: "Create user flow",
          completed: false,
          priority: 'high' as const,
          color: "bg-[#bb9e7b]"
        },
        {
          id: "2", 
          text: "Create onboarding pages",
          completed: false,
          priority: 'high' as const,
          color: "bg-[#bb9e7b]"
        },
        {
          id: "3",
          text: "Discuss about UX issue with Nik",
          completed: false,
          priority: 'medium' as const,
          color: "bg-[#b8b0a8]"
        }
      ]
    },
    {
      date: "Nov 14",
      dayLabel: "Wednesday",
      items: [
        {
          id: "4",
          text: "Create user flow",
          completed: false,
          priority: 'high' as const,
          color: "bg-red-500"
        },
        {
          id: "5",
          text: "Create onboarding pages", 
          completed: false,
          priority: 'medium' as const,
          color: "bg-orange-500"
        },
        {
          id: "6",
          text: "Discuss about UX issue with Nik",
          completed: false,
          priority: 'low' as const,
          color: "bg-[#bb9e7b]"
        }
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Calendar Widget */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#314158]">{format(today, 'MMMM yyyy')}</h3>
          <div className="flex items-center space-x-2">
            <ChevronLeft className="w-4 h-4 text-[#8e99a8]" />
            <ChevronRight className="w-4 h-4 text-[#8e99a8]" />
          </div>
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {calendarDays.map((day) => (
            <div 
              key={day.date}
              className={`text-center p-2 rounded-lg transition-colors ${
                day.active 
                  ? 'bg-[#bb9e7b] text-white' 
                  : 'text-[#6b7688] hover:bg-[#f5f0eb]'
              }`}
            >
              <div className="text-xs font-medium">{day.date}</div>
              <div className="text-xs">{day.day}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Task Lists */}
      <div className="space-y-4">
        {tasks.map((taskGroup) => (
          <Card key={taskGroup.date} className="p-4">
            <div className="mb-4">
              <h4 className="font-semibold text-[#314158]">{taskGroup.date}</h4>
              <p className="text-sm text-[#8e99a8]">{taskGroup.dayLabel}</p>
              <p className="text-xs text-[#8e99a8] mt-1">TO DO LIST</p>
            </div>

            <div className="space-y-3">
              {taskGroup.items.map((task) => (
                <div key={task.id} className="flex items-center space-x-3">
                  <Checkbox
                    checked={task.completed}
                    className="rounded-full"
                  />
                  <div className={`w-2 h-2 rounded-full ${task.color}`}></div>
                  <span className={`text-sm flex-1 ${
                    task.completed 
                      ? 'line-through text-[#8e99a8]' 
                      : 'text-[#314158]'
                  }`}>
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
