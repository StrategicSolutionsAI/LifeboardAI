import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  iconBgClassName?: string; // e.g., bg-amber-100
  className?: string;
}

export function MetricTile({
  label,
  value,
  unit,
  icon,
  iconBgClassName,
  className,
}: MetricTileProps) {
  return (
    <Card className={cn("p-4 shadow-sm", className)}>
      <CardContent className="p-0">
        <div className="flex flex-col">
          <div className="text-xs text-[#8e99a8] uppercase mb-1">{label}</div>
          <div className="flex items-baseline">
            <span className="text-xl font-semibold text-[#314158]">{value}</span>
            {unit ? <span className="text-xs text-[#8e99a8] ml-1">{unit}</span> : null}
          </div>
          {icon ? (
            <div className={cn("ml-auto w-6 h-6 rounded-full flex items-center justify-center", iconBgClassName)}>
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

