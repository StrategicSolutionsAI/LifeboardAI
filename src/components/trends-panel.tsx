"use client";
import { useState } from 'react';
import WidgetTrendChart from './widget-trend-chart';
import MoodCalendar from './mood-calendar';
import WidgetSelector from './widget-selector';
import { WidgetInstance } from '@/types/widgets';

const ranges = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
] as const;

interface TrendsPanelProps {
  widgets: WidgetInstance[];
  bucketName?: string;
}

export default function TrendsPanel({ widgets, bucketName }: TrendsPanelProps) {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [selectedWidget, setSelectedWidget] = useState<string | 'all'>('all');
  
  // Check if we should show mood calendar - only when specific mood widget is selected
  const isWellnessBucket = bucketName?.toLowerCase() === 'wellness';
  const selectedMoodWidget = widgets.find(w => w.instanceId === selectedWidget && (w.id === 'mood' || w.name?.toLowerCase().includes('mood')));
  const showMoodCalendar = isWellnessBucket && selectedMoodWidget;



  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Widget Trends Section */}
      {widgets.length > 0 && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h2 className="text-xl font-semibold">Widget Trends</h2>
            <WidgetSelector
              widgets={widgets}
              selectedWidget={selectedWidget}
              onWidgetChange={setSelectedWidget}
              showAllOption={true}
              className="w-40 sm:w-48"
            />
          </div>
          
          {/* Range picker */}
          <div className="mb-4 flex flex-wrap gap-2">
            {ranges.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-2 py-1 rounded text-sm ${
                  rangeDays === days
                    ? 'bg-warm-500 text-white'
                    : 'bg-[#f5f0eb] text-[#6b7688] hover:bg-[#ebe5de]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(selectedWidget === 'all' ? widgets : widgets.filter(w => w.instanceId === selectedWidget)).map((w) => (
              <WidgetTrendChart
                key={w.instanceId}
                instanceId={w.instanceId}
                name={w.name}
                rangeDays={rangeDays}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mood Calendar - Only show in Wellness bucket when mood widget selected */}
      {showMoodCalendar && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Mood Tracking</h2>
          <MoodCalendar compact={false} />
        </div>
      )}
    </div>
  );
}
