"use client";

import { List, LayoutGrid, Columns3, Filter } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TaskFilterPanel, type TaskFilterState, activeFilterCount } from "@/features/tasks/components/task-filter-panel";
import type { FamilyMemberOption } from "@/hooks/use-family-members";

export type TaskTabId = "lists" | "board" | "kanban";

interface TaskBoardTabsProps {
  activeTab: TaskTabId;
  onTabChange: (tab: TaskTabId) => void;
  filters: TaskFilterState;
  onFiltersChange: (f: TaskFilterState) => void;
  bucketOptions: string[];
  bucketColors?: Record<string, string>;
  familyMembers?: FamilyMemberOption[];
}

const tabs: { id: TaskTabId; label: string; icon: React.ReactNode }[] = [
  { id: "lists", label: "Lists", icon: <List size={18} /> },
  { id: "board", label: "Board", icon: <LayoutGrid size={18} /> },
  { id: "kanban", label: "Kanban", icon: <Columns3 size={18} /> },
];

export function TaskBoardTabs({
  activeTab,
  onTabChange,
  filters,
  onFiltersChange,
  bucketOptions,
  bucketColors,
  familyMembers,
}: TaskBoardTabsProps) {
  const count = activeFilterCount(filters);

  return (
    <div className="flex items-center justify-between w-full border-b border-theme-neutral-300/50">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 transition-all duration-200 ease-out rounded-t-lg ${
              activeTab === tab.id
                ? "text-theme-text-primary"
                : "text-theme-text-tertiary hover:text-theme-text-secondary hover:bg-theme-brand-tint-subtle"
            }`}
          >
            <span className="[&>svg]:stroke-current">{tab.icon}</span>
            <span className="text-xs tracking-[0.5px] uppercase font-medium">
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-theme-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out ${
              count > 0
                ? "bg-theme-brand-tint-light text-theme-text-primary ring-1 ring-theme-focus/25"
                : "text-theme-text-tertiary hover:bg-theme-brand-tint-subtle hover:text-theme-text-secondary"
            }`}
          >
            <Filter size={14} />
            <span>Filter</span>
            {count > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-theme-primary text-white text-[9px] font-bold leading-none">
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-auto max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-200px)] overflow-y-auto p-3 sm:p-4 bg-white border border-theme-neutral-300/80 rounded-xl shadow-warm-lg z-50"
        >
          <TaskFilterPanel
            filters={filters}
            onChange={onFiltersChange}
            bucketOptions={bucketOptions}
            bucketColors={bucketColors}
            familyMembers={familyMembers}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
