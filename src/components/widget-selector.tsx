"use client";
import React, { useId } from 'react';
import { WidgetInstance } from '@/types/widgets';

interface WidgetSelectorProps {
  widgets: WidgetInstance[];
  selectedWidget: string | 'all';
  onWidgetChange: (widgetId: string | 'all') => void;
  showAllOption?: boolean;
  className?: string;
}

export default function WidgetSelector({ 
  widgets, 
  selectedWidget, 
  onWidgetChange, 
  showAllOption = true,
  className = ""
}: WidgetSelectorProps) {
  const selectorId = useId();
  const labelId = `${selectorId}-label`;

  return (
    <div className={`relative ${className}`}>
      <label id={labelId} htmlFor={selectorId} className="sr-only">
        Select widget
      </label>
      <select
        id={selectorId}
        aria-labelledby={labelId}
        value={selectedWidget}
        onChange={(event) => {
          const next = event.target.value;
          onWidgetChange(next === 'all' ? 'all' : next);
        }}
        className="w-full rounded-md border border-theme-neutral-300 bg-white px-3 py-2 text-sm text-theme-text-primary shadow-sm focus:border-warm-500 focus:outline-none focus:ring-2 focus:ring-warm-500"
      >
        {showAllOption && (
          <option value="all">All Widgets</option>
        )}
        {widgets.map((widget) => (
          <option key={widget.instanceId} value={widget.instanceId}>
            {widget.name}
          </option>
        ))}
        {widgets.length === 0 && !showAllOption && (
          <option value="" disabled>
            No widgets available
          </option>
        )}
      </select>
    </div>
  );
}
