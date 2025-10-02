"use client";

import React, { useState } from "react";
import { Plus, Filter, SortAsc } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TasksQuickActionsProps {
  onQuickAdd: (taskContent: string) => void;
  taskCounts: {
    all: number;
    today: number;
    overdue: number;
    highPriority: number;
  };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function TasksQuickActions({
  onQuickAdd,
  taskCounts,
  activeFilter,
  onFilterChange,
}: TasksQuickActionsProps) {
  const [quickAddInput, setQuickAddInput] = useState("");

  const handleQuickAdd = () => {
    if (quickAddInput.trim()) {
      onQuickAdd(quickAddInput.trim());
      setQuickAddInput("");
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 p-4 mb-6 shadow-sm">
      {/* Quick Add Input */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={quickAddInput}
          onChange={(e) => setQuickAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleQuickAdd();
            }
          }}
          placeholder="Quick add task... (e.g., 'Buy groceries tomorrow')"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        <button
          onClick={handleQuickAdd}
          disabled={!quickAddInput.trim()}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={activeFilter === "all" ? "default" : "outline"}
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onFilterChange("all")}
        >
          All Tasks ({taskCounts.all})
        </Badge>
        <Badge
          variant={activeFilter === "today" ? "default" : "outline"}
          className="cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => onFilterChange("today")}
        >
          Today ({taskCounts.today})
        </Badge>
        {taskCounts.overdue > 0 && (
          <Badge
            variant={activeFilter === "overdue" ? "destructive" : "outline"}
            className="cursor-pointer hover:bg-red-50 transition-colors"
            onClick={() => onFilterChange("overdue")}
          >
            ⚠️ Overdue ({taskCounts.overdue})
          </Badge>
        )}
        <Badge
          variant={activeFilter === "high-priority" ? "default" : "outline"}
          className="cursor-pointer hover:bg-orange-50 transition-colors"
          onClick={() => onFilterChange("high-priority")}
        >
          High Priority ({taskCounts.highPriority})
        </Badge>
      </div>
    </div>
  );
}
