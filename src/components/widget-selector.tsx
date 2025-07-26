"use client";
import React from 'react';
import { ChevronDown } from 'lucide-react';
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
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedWidgetData = selectedWidget === 'all' 
    ? null 
    : widgets.find(w => w.instanceId === selectedWidget);

  const displayText = selectedWidget === 'all' 
    ? 'All Widgets' 
    : selectedWidgetData?.name || 'Select Widget';

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto top-full left-0">
            {showAllOption && (
              <button
                onClick={() => {
                  onWidgetChange('all');
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  selectedWidget === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900'
                }`}
              >
                All Widgets
              </button>
            )}
            
            {widgets.map((widget) => (
              <button
                key={widget.instanceId}
                onClick={() => {
                  onWidgetChange(widget.instanceId);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center ${
                  selectedWidget === widget.instanceId ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900'
                }`}
              >
                <span className="mr-2">{typeof widget.icon === 'string' ? widget.icon : '📊'}</span>
                <span className="truncate">{widget.name}</span>
              </button>
            ))}
            
            {widgets.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                No widgets available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
