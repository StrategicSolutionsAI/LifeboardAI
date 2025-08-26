import React from 'react';
import { WidgetInstance } from '@/types/widgets';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{widget.name}</CardTitle>
        {widget.description ? (
          <CardDescription>{widget.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {/* Widget content placeholder; individual widget components will control their inner content */}
      </CardContent>
    </Card>
  );
};

export default WidgetComponent;
