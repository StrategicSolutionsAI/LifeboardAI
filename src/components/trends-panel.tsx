"use client";
import { useState } from 'react';
import WidgetTrendChart from './widget-trend-chart';
import { WidgetInstance } from '@/types/widgets';

const ranges = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
] as const;

export default function TrendsPanel({ widgets }: { widgets: WidgetInstance[] }) {
  if (widgets.length === 0) {
    return (
      <div className="p-6 text-gray-500">
        No widgets yet. Add some on the Overview tab!
      </div>
    );
  }

  const [rangeDays, setRangeDays] = useState<number>(30);

  return (
    <div className="p-6">
      {/* Range picker */}
      <div className="mb-4 flex gap-2">
        {ranges.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => setRangeDays(days)}
            className={`px-2 py-1 rounded text-sm ${
              rangeDays === days
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {widgets.map((w) => (
          <WidgetTrendChart
            key={w.instanceId}
            instanceId={w.instanceId}
            name={w.name}
            rangeDays={rangeDays}
          />
        ))}
      </div>
    </div>
  );
}