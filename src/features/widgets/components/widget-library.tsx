"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, Plus } from "lucide-react"
import { WidgetPreview } from "./widget-preview"
import type { WidgetInstance, WidgetTemplate } from "@/types/widgets"
import { hexToRgba } from "@/lib/dashboard-utils"
import { widgetTemplates } from "@/lib/widget-templates"


// Calidora-aligned color palette for widget swatches
const getColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    tan: "bg-theme-primary",
    green: "bg-theme-success",
    blue: "bg-theme-info",
    purple: "bg-[#8B7FD4]",
    pink: "bg-[#D07AA4]",
    gold: "bg-theme-warning",
    orange: "bg-[#E28A5D]",
    teal: "bg-[#5E9B8C]",
    slate: "bg-theme-text-tertiary",
    stone: "bg-theme-neutral-400",
  }
  return colorMap[color] || "bg-theme-primary"
}

// Semi-opaque variant: pastel bg + colored icon
const getSemiOpaqueClasses = (color: string): { bg: string; text: string } => {
  const map: Record<string, { bg: string; text: string }> = {
    tan:    { bg: "bg-theme-surface-selected",    text: "text-theme-primary" },
    green:  { bg: "bg-emerald-100",  text: "text-theme-success" },
    blue:   { bg: "bg-blue-100",     text: "text-theme-info" },
    purple: { bg: "bg-purple-100",   text: "text-[#8B7FD4]" },
    pink:   { bg: "bg-pink-100",     text: "text-[#D07AA4]" },
    gold:   { bg: "bg-amber-100",    text: "text-theme-warning" },
    orange: { bg: "bg-orange-100",   text: "text-[#E28A5D]" },
    teal:   { bg: "bg-teal-100",     text: "text-[#5E9B8C]" },
    slate:  { bg: "bg-slate-100",    text: "text-theme-text-tertiary" },
    stone:  { bg: "bg-stone-100",    text: "text-theme-neutral-400" },
  }
  return map[color] || map.tan
}

const COLORS = [
  "tan", "green", "blue", "purple", "pink", "gold", "orange", "teal", "slate", "stone"
];

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface WidgetLibraryProps {
  onAdd?: (widget: any) => void;
  bucket?: string;
  bucketColor?: string;
}

export function WidgetLibrary({ onAdd = () => {}, bucket = "General", bucketColor }: WidgetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // For now, we'll use a simple approach: let the user choose which category to view
  // and provide recommendations based on the current bucket

  // Get all distinct categories from widgetTemplates
  const allCategories = Array.from(new Set(widgetTemplates.map(w => w.category)));
  
  // Initial recommended category based on bucket name
  const getRecommendedCategory = (bucketName: string): string => {
    const lowerBucket = bucketName.toLowerCase();
    
    // Direct matches
    if (lowerBucket === 'health' || lowerBucket === 'fitness') return 'health';
    if (lowerBucket === 'wellness' || lowerBucket === 'personal') return 'wellness';
    if (lowerBucket === 'medical') return 'medical';
    if (lowerBucket === 'household' || lowerBucket === 'home') return 'household';
    if (lowerBucket === 'family') return 'family';
    if (lowerBucket === 'social') return 'social';
    if (lowerBucket === 'work' || lowerBucket === 'projects' || lowerBucket === 'side projects') return 'work';
    if (lowerBucket === 'finance' || lowerBucket === 'money' || lowerBucket === 'budget') return 'finance';
    
    // Partial matches
    if (lowerBucket.includes('health')) return 'health';
    if (lowerBucket.includes('wellness')) return 'wellness';
    if (lowerBucket.includes('medical')) return 'medical';
    if (lowerBucket.includes('family')) return 'family';
    if (lowerBucket.includes('social')) return 'social';
    if (lowerBucket.includes('work') || lowerBucket.includes('project')) return 'work';
    if (lowerBucket.includes('finance') || lowerBucket.includes('money')) return 'finance';
    if (lowerBucket.includes('house') || lowerBucket.includes('home')) return 'household';
    
    // Check for meal-related buckets
    if (lowerBucket.includes('meal') || lowerBucket.includes('food')) return 'family'; // meal planning is in family category
    
    // Check for hobby/travel buckets
    if (lowerBucket.includes('hobby') || lowerBucket.includes('hobbies')) return 'wellness'; // self-care activities
    if (lowerBucket.includes('travel')) return 'social'; // events and planning
    
    return 'all'; // Default to showing all widgets if no match
  };
  
  // State for selected category (defaults to recommended based on bucket)
  const [selectedCategory, setSelectedCategory] = useState<string>(getRecommendedCategory(bucket));
  const [selectedTemplate, setSelectedTemplate] = useState<WidgetTemplate | null>(null);
  const [draftWidget, setDraftWidget] = useState<WidgetInstance | null>(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  
  // Check for connected integrations (parallel fetch)
  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const [fitbitRes, gfRes] = await Promise.all([
          fetch('/api/integrations/status?provider=fitbit'),
          fetch('/api/integrations/status?provider=google-fit'),
        ]);
        const [fitbitData, gfData] = await Promise.all([
          fitbitRes.json(),
          gfRes.json(),
        ]);
        const connected: string[] = [];
        if (fitbitData.connected) connected.push('fitbit');
        if (gfData.connected) connected.push('google-fit');
        if (connected.length > 0) setConnectedIntegrations(connected);
      } catch (error) {
        console.error('Error checking integrations:', error);
      }
    };
    checkIntegrations();
  }, []);
  
  // Whenever a new template is chosen initialise a draft instance
  useEffect(() => {
    if (selectedTemplate) {
      setDraftWidget({
        ...selectedTemplate,
        instanceId: "draft",
        target: selectedTemplate.defaultTarget,
        schedule: [true, true, true, true, true, true, true],
        color: selectedTemplate.color ?? "#B1916A",
        createdAt: new Date().toISOString(),
        dataSource: "manual", // Default to manual
      });
    } else {
      setDraftWidget(null);
    }
  }, [selectedTemplate]);
  
  // Update selected category when bucket changes
  useEffect(() => {
    const recommendedCategory = getRecommendedCategory(bucket);
    setSelectedCategory(recommendedCategory);
  }, [bucket]);
  
  // Filter widgets by search term and selected category
  let filteredWidgets = widgetTemplates.filter(widget => {
    // Match search term
    const matchesSearch = !searchQuery || 
                         widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Match selected category or show all if 'all' is selected
    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-6">
      {/* Left: list & filters */}
      <div className="flex-1 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary/70 w-4 h-4" />
          <input
            type="text"
            placeholder="Search widgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-theme-neutral-300/80 rounded-xl focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary outline-none transition-all duration-200 ease-out"
          />
        </div>
        
        {/* Category Filter */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-theme-text-body">Category</span>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap sm:overflow-visible sm:gap-1">
            <button
              className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ease-out ${selectedCategory === 'all'
                ? 'bg-theme-brand-tint text-theme-text-primary font-medium'
                : 'bg-theme-brand-tint-light text-theme-text-subtle hover:bg-theme-skeleton'}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {allCategories.map(category => (
              <button
                key={category}
                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ease-out relative ${selectedCategory === category
                  ? 'bg-theme-brand-tint text-theme-text-primary font-medium'
                  : 'bg-theme-brand-tint-light text-theme-text-subtle hover:bg-theme-skeleton'} ${
                    getRecommendedCategory(bucket) === category && selectedCategory !== category 
                      ? 'ring-2 ring-theme-primary/40 ring-offset-1' 
                      : ''
                  }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
                {getRecommendedCategory(bucket) === category && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-theme-primary rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Show a hint if not viewing the recommended category */}
        {selectedCategory !== getRecommendedCategory(bucket) && selectedCategory !== 'all' && (
          <div className="text-sm text-theme-text-tertiary flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-theme-primary rounded-full animate-pulse" />
            <span>Tip: Try the <button 
              onClick={() => setSelectedCategory(getRecommendedCategory(bucket))} 
              className="text-theme-primary hover:underline font-medium"
            >
              {getRecommendedCategory(bucket).charAt(0).toUpperCase() + getRecommendedCategory(bucket).slice(1)}
            </button> category for widgets that match your "{bucket}" bucket</span>
          </div>
        )}

        {/* Widget Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:max-h-[70vh] lg:overflow-y-auto">
          {filteredWidgets.map((widget) => {
            const Icon = widget.icon
            return (
              <Card key={widget.id} className={`hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer ${selectedTemplate?.id === widget.id ? 'ring-2 ring-theme-primary' : ''}`} onClick={() => setSelectedTemplate(widget)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={bucketColor ? { backgroundColor: hexToRgba(bucketColor, 0.15) } : { backgroundColor: 'rgba(177,145,106,0.15)' }}>
                      <Icon className="w-5 h-5" style={{ color: bucketColor || '#B1916A' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                      <p className="text-xs text-theme-text-tertiary mt-1">{widget.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-theme-text-tertiary">
                      Target: {widget.defaultTarget} {widget.unit}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(widget);
                      }}
                      className="text-xs px-3 py-1"
                    >
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {filteredWidgets.length === 0 && (
          <div className="text-center py-8 text-theme-text-tertiary">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No widgets found matching your criteria</p>
          </div>
        )}
      </div> {/* end left column */}

      {/* Right: live preview & config */}
      <div className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-6">
        <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-theme-text-body">Preview</h4>
          {draftWidget ? (
            <>
              <div className="mt-3">
                <WidgetPreview widget={draftWidget} bucketColor={bucketColor} />
              </div>

              {/* Target input */}
              <div className="pt-4 space-y-2 border-t">
                <p className="text-xs font-medium text-theme-text-subtle">Daily target</p>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Decrease target"
                    className="px-2 py-1 rounded bg-theme-brand-tint-light hover:bg-theme-skeleton"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, target: Math.max(0, prev.target - 1) } : prev
                      )
                    }
                  >
                    –
                  </button>
                  <input
                    type="number"
                    value={draftWidget.target}
                    onChange={(e) =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, target: Number(e.target.value) } : prev
                      )
                    }
                    className="w-16 text-center border rounded"
                    aria-label="Target value"
                  />
                  <span className="text-sm text-theme-text-subtle">{draftWidget.unit}</span>
                  <button
                    aria-label="Increase target"
                    className="px-2 py-1 rounded bg-theme-brand-tint-light hover:bg-theme-skeleton"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, target: prev.target + 1 } : prev
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Data Source Selector - Only for water widget with Fitbit connected */}
              {['water','steps'].includes(draftWidget.id) && (connectedIntegrations.includes('fitbit') || connectedIntegrations.includes('googlefit')) && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-theme-text-subtle">Data Source</p>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="dataSource"
                        value="manual"
                        checked={draftWidget.dataSource === 'manual'}
                        onChange={() => setDraftWidget(prev => prev ? { ...prev, dataSource: 'manual' } : prev)}
                        className="text-theme-primary"
                      />
                      <span className="text-sm">Manual tracking</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="dataSource"
                        value="fitbit"
                        checked={draftWidget.dataSource === 'fitbit'}
                        onChange={() => setDraftWidget(prev => prev ? { ...prev, dataSource: 'fitbit' } : prev)}
                        className="text-theme-primary"
                      />
                      <span className="text-sm">Fitbit (automatic)</span>
                    </label>
                    {connectedIntegrations.includes('googlefit') && (
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="dataSource"
                          value="googlefit"
                          checked={draftWidget.dataSource === 'googlefit'}
                          onChange={() => setDraftWidget(prev => prev ? { ...prev, dataSource: 'googlefit' } : prev)}
                          className="text-theme-primary"
                        />
                        <span className="text-sm">Google Fit (automatic)</span>
                      </label>
                    )}
                  </div>
                  {draftWidget.dataSource === 'fitbit' && (
                    <p className="text-xs text-theme-text-tertiary mt-1">
                      {draftWidget.name} will sync automatically from your Fitbit device
                    </p>
                  )}
                </div>
              )}

              {/* Schedule picker */}
              <div className="space-y-2 pt-4 border-t">
                <p className="text-xs font-medium text-theme-text-subtle">Schedule</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, idx) => (
                    <button
                      key={d}
                      aria-label={d}
                      className={`w-8 h-8 text-[11px] rounded-full border ${draftWidget.schedule[idx] ? 'bg-theme-primary text-white' : 'bg-white text-theme-text-subtle'} hover:bg-theme-brand-tint`}
                      onClick={() =>
                        setDraftWidget((prev) =>
                          prev
                            ? {
                                ...prev,
                                schedule: prev.schedule.map((v, i) =>
                                  i === idx ? !v : v
                                ) as boolean[],
                              }
                            : prev
                        )
                      }
                    >
                      {d.charAt(0)}
                    </button>
                  ))}
                </div>
                {/* Presets */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    className="text-[11px] px-2 py-1 rounded bg-theme-brand-tint-light hover:bg-theme-skeleton"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, schedule: [true, true, true, true, true, true, true] } : prev
                      )
                    }
                  >Every day</button>
                  <button
                    className="text-[11px] px-2 py-1 rounded bg-theme-brand-tint-light hover:bg-theme-skeleton"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, schedule: [false, true, true, true, true, true, false] } : prev
                      )
                    }
                  >Weekdays</button>
                  <button
                    className="text-[11px] px-2 py-1 rounded bg-theme-brand-tint-light hover:bg-theme-skeleton"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, schedule: [true, false, true, false, true, false, true] } : prev
                      )
                    }
                  >Alternate</button>
                </div>
              </div>

              <button
                className="w-full mt-4 py-2 rounded bg-theme-primary hover:bg-theme-primary-600 text-white text-sm font-medium"
                onClick={() => {
                  if (!draftWidget) return;
                  // Convert component to its name string for persistence
                  let iconField: string | any = draftWidget.icon;
                  if (typeof draftWidget.icon === 'function') {
                    iconField = (draftWidget.icon as any).displayName || (draftWidget.icon as any).name || '';
                  }
                  const instance: WidgetInstance = {
                    ...draftWidget,
                    icon: iconField,
                    instanceId: `widget-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                  };
                  onAdd(instance);
                }}
              >
                Add Widget
              </button>
            </>
          ) : (
            <p className="mt-3 text-xs text-theme-text-tertiary">Select a widget to see a preview</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Re-export for backwards compatibility
export { widgetTemplates } from "@/lib/widget-templates";
