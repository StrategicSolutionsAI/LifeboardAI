"use client";

import { List, LayoutGrid, Columns3, Filter } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TaskFilterPanel, type TaskFilterState, activeFilterCount } from "@/components/task-filter-panel";

export type TaskTabId = "lists" | "board" | "kanban";

interface TaskBoardTabsProps {
  activeTab: TaskTabId;
  onTabChange: (tab: TaskTabId) => void;
  filters: TaskFilterState;
  onFiltersChange: (f: TaskFilterState) => void;
  bucketOptions: string[];
  bucketColors?: Record<string, string>;
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
}: TaskBoardTabsProps) {
  const count = activeFilterCount(filters);

  return (
    <div className="flex items-center justify-between w-full border-b border-[rgba(219,214,207,0.5)]">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 transition-all duration-200 ease-out rounded-t-lg ${
              activeTab === tab.id
                ? "text-[#314158]"
                : "text-[#8e99a8] hover:text-[#596881] hover:bg-[rgba(177,145,106,0.04)]"
            }`}
          >
            <span className="[&>svg]:stroke-current">{tab.icon}</span>
            <span className="text-[12px] tracking-[0.5px] uppercase font-medium">
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#B1916A] rounded-full" />
            )}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ease-out ${
              count > 0
                ? "bg-[rgba(177,145,106,0.1)] text-[#314158] ring-1 ring-[rgba(177,145,106,0.25)]"
                : "text-[#8e99a8] hover:bg-[rgba(177,145,106,0.06)] hover:text-[#596881]"
            }`}
          >
            <Filter size={14} />
            <span>Filter</span>
            {count > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#B1916A] text-white text-[9px] font-bold leading-none">
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-auto max-h-[calc(100vh-200px)] overflow-y-auto p-4 bg-white border border-[#dbd6cf]/80 rounded-xl shadow-warm-lg z-50"
        >
          <TaskFilterPanel
            filters={filters}
            onChange={onFiltersChange}
            bucketOptions={bucketOptions}
            bucketColors={bucketColors}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
