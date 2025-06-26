"use client";
import WidgetTrendChart from './widget-trend-chart';
import { WidgetInstance } from '@/types/widgets';

export default function TrendsPanel({ widgets }: { widgets: WidgetInstance[] }) {
  if (widgets.length === 0) {
    return <div className="p-6 text-gray-500">No widgets yet. Add some on the Overview tab!</div>;
  }

  return (
    <div className="p-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {widgets.map((w) => (
        <WidgetTrendChart key={w.instanceId} instanceId={w.instanceId} name={w.name} />
      ))}
    </div>
  );
} 