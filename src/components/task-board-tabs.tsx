"use client";

import { List, LayoutGrid, Filter } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TaskFilterPanel, type TaskFilterState, activeFilterCount } from "@/components/task-filter-panel";

export type TaskTabId = "lists" | "board";

interface TaskBoardTabsProps {
  activeTab: TaskTabId;
  onTabChange: (tab: TaskTabId) => void;
  filters: TaskFilterState;
  onFiltersChange: (f: TaskFilterState) => void;
  bucketOptions: string[];
}

const tabs: { id: TaskTabId; label: string; icon: React.ReactNode }[] = [
  { id: "lists", label: "Lists", icon: <List size={18} /> },
  { id: "board", label: "Board", icon: <LayoutGrid size={18} /> },
];

export function TaskBoardTabs({
  activeTab,
  onTabChange,
  filters,
  onFiltersChange,
  bucketOptions,
}: TaskBoardTabsProps) {
  const count = activeFilterCount(filters);

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-5 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-1.5 pb-3 transition-colors ${
              activeTab === tab.id ? "text-[#314158]" : "text-[#596881] hover:text-[#314158]"
            }`}
          >
            <span className="[&>svg]:stroke-current">{tab.icon}</span>
            <span className="text-[12px] tracking-[0.88px] uppercase font-medium">
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B1916A] rounded-full" />
            )}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#dcdcde] bg-white shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[#faf8f5] transition-colors"
          >
            <Filter size={16} className="text-[#181624]" />
            <span className="text-[13px] text-[#181624]">Filter</span>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-[#B1916A] text-white text-[10px] font-semibold leading-none">
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-auto max-h-[calc(100vh-200px)] overflow-y-auto p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-warm-lg z-50"
        >
          <TaskFilterPanel
            filters={filters}
            onChange={onFiltersChange}
            bucketOptions={bucketOptions}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
