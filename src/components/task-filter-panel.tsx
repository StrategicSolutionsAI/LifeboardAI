"use client";

import { ArrowUp, ArrowDown, X } from "lucide-react";

export type DueDatePreset = "overdue" | "today" | "this-week" | "this-month";
export type TaskSortOption = "manual" | "dueDate" | "bucket" | "name";

export interface TaskFilterState {
  buckets: string[];
  dueDateRange: DueDatePreset | null;
  sortBy: TaskSortOption;
  sortDirection: "asc" | "desc";
  status: "all" | "open" | "completed";
}

export const defaultTaskFilters: TaskFilterState = {
  buckets: [],
  dueDateRange: null,
  sortBy: "manual",
  sortDirection: "asc",
  status: "all",
};

export function activeFilterCount(f: TaskFilterState): number {
  let count = 0;
  if (f.buckets.length > 0) count++;
  if (f.dueDateRange !== null) count++;
  if (f.status !== "all") count++;
  if (f.sortBy !== defaultTaskFilters.sortBy || f.sortDirection !== defaultTaskFilters.sortDirection) count++;
  return count;
}

const datePresets: { id: DueDatePreset; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "this-week", label: "This week" },
  { id: "this-month", label: "This month" },
];

const statusOptions: { id: TaskFilterState["status"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "completed", label: "Completed" },
];

const sortOptions: { id: TaskSortOption; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "dueDate", label: "Due date" },
  { id: "bucket", label: "Bucket" },
  { id: "name", label: "Task name" },
];

interface TaskFilterPanelProps {
  filters: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  bucketOptions: string[];
}

export function TaskFilterPanel({
  filters,
  onChange,
  bucketOptions,
}: TaskFilterPanelProps) {
  const toggleBucket = (bucket: string) => {
    const has = filters.buckets.includes(bucket);
    onChange({
      ...filters,
      buckets: has
        ? filters.buckets.filter((x) => x !== bucket)
        : [...filters.buckets, bucket],
    });
  };

  const setDateRange = (preset: DueDatePreset) => {
    onChange({
      ...filters,
      dueDateRange: filters.dueDateRange === preset ? null : preset,
    });
  };

  const setStatus = (status: TaskFilterState["status"]) => {
    onChange({ ...filters, status });
  };

  const setSortBy = (opt: TaskSortOption) => {
    if (opt === "manual") {
      onChange({ ...filters, sortBy: "manual", sortDirection: "asc" });
      return;
    }
    if (filters.sortBy === opt) {
      onChange({
        ...filters,
        sortDirection: filters.sortDirection === "asc" ? "desc" : "asc",
      });
    } else {
      onChange({ ...filters, sortBy: opt, sortDirection: "asc" });
    }
  };

  const clearAll = () => onChange(defaultTaskFilters);
  const count = activeFilterCount(filters);

  return (
    <div className="flex flex-col gap-4 w-[280px]">
      {/* Status */}
      <Section label="Status">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((s) => {
            const active = filters.status === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={`px-3 py-1.5 rounded-lg border text-[13px] transition-colors ${
                  active
                    ? "bg-[rgba(177,145,106,0.12)] border-[rgba(177,145,106,0.35)] text-[#314158]"
                    : "bg-white border-[#e2e8f0] text-[#596881] hover:border-[#cbd5e1]"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Due Date */}
      <Section label="Due Date">
        <div className="flex flex-wrap gap-2">
          {datePresets.map((d) => {
            const active = filters.dueDateRange === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDateRange(d.id)}
                className={`px-3 py-1.5 rounded-lg border text-[13px] transition-colors ${
                  active
                    ? "bg-[rgba(177,145,106,0.12)] border-[rgba(177,145,106,0.35)] text-[#314158]"
                    : "bg-white border-[#e2e8f0] text-[#596881] hover:border-[#cbd5e1]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Bucket */}
      {bucketOptions.length > 0 && (
        <Section label="Bucket">
          <div className="flex flex-wrap gap-2">
            {bucketOptions.map((bucket) => {
              const active = filters.buckets.includes(bucket);
              return (
                <button
                  key={bucket}
                  onClick={() => toggleBucket(bucket)}
                  className={`px-2.5 py-1 rounded-md border text-[12px] transition-colors ${
                    active
                      ? "bg-[rgba(177,145,106,0.12)] border-[rgba(177,145,106,0.35)] text-[#314158]"
                      : "bg-white border-[#e2e8f0] text-[#596881] hover:border-[#cbd5e1]"
                  }`}
                >
                  {bucket}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Sort */}
      <Section label="Sort by">
        <div className="flex items-center flex-wrap gap-2">
          {sortOptions.map((s) => {
            const active = filters.sortBy === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSortBy(s.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] transition-colors ${
                  active
                    ? "bg-[rgba(177,145,106,0.12)] border-[rgba(177,145,106,0.35)] text-[#314158]"
                    : "bg-white border-[#e2e8f0] text-[#596881] hover:border-[#cbd5e1]"
                }`}
              >
                {s.label}
                {active && s.id !== "manual" &&
                  (filters.sortDirection === "asc" ? (
                    <ArrowUp size={12} />
                  ) : (
                    <ArrowDown size={12} />
                  ))}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Footer */}
      {count > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#e2e8f0]">
          <span className="text-[12px] text-[#8e99a8]">
            {count} active {count === 1 ? "filter" : "filters"}
          </span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[12px] text-[#B1916A] hover:text-[#96784f] transition-colors"
          >
            <X size={12} />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] tracking-[0.6px] uppercase text-[#8e99a8] font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}
