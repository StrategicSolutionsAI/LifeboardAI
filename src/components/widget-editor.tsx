"use client";

import { WidgetInstance } from "@/types/widgets";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { WidgetPreview } from "./widget-preview";
import { Button } from "@/components/ui/button";

// Colour map reused
const COLORS = [
  "blue","green","red","orange","purple","indigo","amber","teal","rose","cyan","yellow","sky","emerald","violet","lime","fuchsia","gray","slate","stone",
];

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const getColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500", orange: "bg-orange-500", purple: "bg-purple-500", indigo: "bg-indigo-500", amber: "bg-amber-500", teal: "bg-teal-500", rose: "bg-rose-500", cyan: "bg-cyan-500", yellow: "bg-yellow-500", sky: "bg-sky-500", emerald: "bg-emerald-500", violet: "bg-violet-500", lime: "bg-lime-500", fuchsia: "bg-fuchsia-500", gray: "bg-gray-500", slate: "bg-slate-500", stone: "bg-stone-500"
  }
  return colorMap[color] || "bg-gray-500"
}

interface WidgetEditorProps {
  widget: WidgetInstance | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: WidgetInstance) => void;
}

export default function WidgetEditorSheet({ widget, open, onClose, onSave }: WidgetEditorProps) {
  const [draft, setDraft] = useState<WidgetInstance | null>(widget);
  const [isFitbitConnected, setIsFitbitConnected] = useState(false);
  const [isGoogleFitConnected, setIsGoogleFitConnected] = useState(false);

  // Check if Fitbit or Google Fit is connected
  useEffect(() => {
    const checkConnections = async () => {
      try {
        // Fitbit
        const fitbitRes = await fetch('/api/integrations/status?provider=fitbit');
        const fitbitData = await fitbitRes.json();
        setIsFitbitConnected(fitbitData.connected);

        // Google Fit
        const gfRes = await fetch('/api/integrations/status?provider=googlefit');
        const gfData = await gfRes.json();
        setIsGoogleFitConnected(gfData.connected);
      } catch (error) {
        console.error('Error checking integration connections:', error);
      }
    };
    checkConnections();
  }, []);

  // keep draft in sync when widget changes
  if (widget && draft?.instanceId !== widget.instanceId) {
    setDraft(widget);
  }

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Edit Widget</SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-4 overflow-y-auto h-[calc(100vh-100px)]">
          <WidgetPreview widget={draft} />

          {/* Target */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Daily target</p>
            <div className="flex items-center gap-2">
              <button aria-label="Decrease target" className="px-2 py-1 rounded bg-gray-100" onClick={() => setDraft(p => p ? { ...p, target: Math.max(0,p.target-1)}:p)}>-</button>
              <input aria-label="Target value" type="number" value={draft.target} onChange={e=>setDraft(p=>p?{...p,target:Number(e.target.value)}:p)} className="w-16 text-center border rounded" />
              <span className="text-sm text-gray-600">{draft.unit}</span>
              <button className="px-2 py-1 rounded bg-gray-100" onClick={() => setDraft(p => p ? { ...p, target: p.target+1}:p)}>+</button>
            </div>
          </div>

          {/* Data Source Selector - Only for water widget with Fitbit connected */}
          {['water','steps'].includes(draft.id) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Data Source</p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="dataSource"
                    value="manual"
                    checked={draft.dataSource === 'manual'}
                    onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'manual' } : prev)}
                    className="text-indigo-600"
                  />
                  <span className="text-sm">Manual tracking</span>
                </label>
                {isFitbitConnected && (
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="dataSource"
                      value="fitbit"
                      checked={draft.dataSource === 'fitbit'}
                      onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'fitbit' } : prev)}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Fitbit (automatic)</span>
                  </label>
                )}
                {isGoogleFitConnected && (
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="dataSource"
                      value="googlefit"
                      checked={draft.dataSource === 'googlefit'}
                      onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'googlefit' } : prev)}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Google Fit (automatic)</span>
                  </label>
                )}
              </div>
              {draft.dataSource === 'fitbit' && (
                <p className="text-xs text-gray-500 mt-1">
                  {draft.name} will sync automatically from your Fitbit device
                </p>
              )}
            </div>
          )}

          {/* Colour */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} aria-label={c} className={`w-6 h-6 rounded-full border-2 ${getColorClass(c)} ${draft.color===c?'ring-2 ring-indigo-500':'border-white'}`} onClick={()=>setDraft(p=>p?{...p,color:c}:p)} />
              ))}
            </div>
          </div>

          {/* Schedule */}
          {draft.schedule && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Schedule</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d,idx)=>(
                  <button key={d} className={`w-8 h-8 text-[11px] rounded-full border ${draft.schedule[idx]?'bg-indigo-500 text-white':'bg-white text-gray-600'}`} onClick={()=>setDraft(p=>p?{...p,schedule:p.schedule.map((v,i)=>i===idx?!v:v) as boolean[]}:p)}>{d.charAt(0)}</button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <Button className="flex-1" onClick={()=>{draft && onSave(draft); onClose();}}>Save</Button>
            <SheetClose asChild>
              <Button variant="outline" className="flex-1">Cancel</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 