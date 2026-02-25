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
    <div className="sticky top-0 z-10 mb-6 rounded-xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
          className="h-8 flex-1 border-border/70 text-sm"
          disabled={isAdding}
        />
        <Button
          size="sm"
          onClick={() => void handleQuickAdd()}
          disabled={!quickAddInput.trim() || isAdding}
          className="h-8 gap-1.5 px-3"
        >
          <Plus className="h-4 w-4" />
          {isAdding ? "Adding..." : "Add"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          const variant =
            isActive && filter.emphasis === "destructive"
              ? "destructive"
              : isActive
                ? "default"
                : "ghost";

          return (
            <Button
              key={filter.key}
              type="button"
              size="sm"
              variant={variant}
              disabled={filter.disabled}
              onClick={() => onFilterChange(filter.key)}
              className="h-7 gap-1 rounded-md px-2.5 text-xs"
            >
              {filter.label}
              <span className="opacity-80">{filter.count}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
