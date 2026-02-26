"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TasksQuickActionFilter {
  key: string;
  label: string;
  count: number;
  disabled?: boolean;
  emphasis?: "default" | "destructive";
}

interface TasksQuickActionsProps {
  onQuickAdd: (taskContent: string) => Promise<void> | void;
  filters: TasksQuickActionFilter[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  quickAddPlaceholder?: string;
}

export function TasksQuickActions({
  onQuickAdd,
  filters,
  activeFilter,
  onFilterChange,
  quickAddPlaceholder = "Add a task...",
}: TasksQuickActionsProps) {
  const [quickAddInput, setQuickAddInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleQuickAdd = async () => {
    const trimmed = quickAddInput.trim();
    if (!trimmed || isAdding) {
      return;
    }

    setIsAdding(true);
    try {
      await Promise.resolve(onQuickAdd(trimmed));
      setQuickAddInput("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 mb-6 rounded-xl border border-[#dbd6cf]/80 bg-white/95 p-3 shadow-[0px_1px_3px_rgba(163,133,96,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={quickAddInput}
          onChange={(e) => setQuickAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleQuickAdd();
            }
          }}
          placeholder={quickAddPlaceholder}
          className="h-8 flex-1 border-[#dbd6cf] text-sm text-[#314158] placeholder:text-[#b5b0a8] focus-visible:ring-[rgba(177,145,106,0.3)]"
          disabled={isAdding}
        />
        <button
          onClick={() => void handleQuickAdd()}
          disabled={!quickAddInput.trim() || isAdding}
          className="h-8 px-3 rounded-lg bg-[#B1916A] text-white text-[13px] font-medium hover:bg-[#96784f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          const isDestructive = filter.emphasis === "destructive";

          return (
            <button
              key={filter.key}
              type="button"
              disabled={filter.disabled}
              onClick={() => onFilterChange(filter.key)}
              className={`h-7 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 ease-out flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive && isDestructive
                  ? "bg-red-500 text-white shadow-sm"
                  : isActive
                    ? "bg-[#B1916A] text-white shadow-sm"
                    : "text-[#596881] hover:bg-[rgba(183,148,106,0.08)] hover:text-[#314158]"
              }`}
            >
              {filter.label}
              <span className="opacity-80">{filter.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
