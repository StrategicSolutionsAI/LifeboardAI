import React from 'react';
import { WidgetInstance } from '@/types/widgets';

const WidgetComponent = ({ 
    widget,
    onUpdate,
    onRemove,
    onDuplicate,
    onProgress,
    progress
}: { 
    widget: WidgetInstance,
    onUpdate: (widget: WidgetInstance) => void,
    onRemove: (instanceId: string) => void,
    onDuplicate: (widget: WidgetInstance) => void,
    onProgress: (widget: WidgetInstance) => void,
    progress: any
}) => {
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-bold">{widget.name}</h3>
      <p className="text-sm text-gray-500">{widget.description}</p>
    </div>
  );
};

export default WidgetComponent;
