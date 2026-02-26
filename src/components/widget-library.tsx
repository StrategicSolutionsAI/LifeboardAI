"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Droplets, 
  Flame, 
  Target, 
  Scale, 
  Heart, 
  Moon, 
  Activity,
  Coffee,
  Search,
  Filter,
  Smile,
  Notebook,
  Brain,
  Sparkles,
  Wind,
  Move,
  Quote,
  Smartphone,
  Gauge,
  CheckSquare,
  CalendarClock,
  Pill,
  ShieldOff,
  ClipboardList,
  DollarSign,
  Brush,
  Hammer,
  Wrench,
  ListChecks,
  Users,
  CalendarDays,
  Utensils,
  Wallet,
  Image as ImageIcon,
  HeartPulse,
  Car,
  Cake,
  PartyPopper,
  Gift,
  Briefcase,
  Timer,
  PiggyBank,
  TrendingUp,
  Home as HomeIcon,
  Flag,
  Plus,
  } from "lucide-react"
import { WidgetPreview } from "./widget-preview"
import type { WidgetInstance } from "@/types/widgets"
import { hexToRgba } from "@/lib/dashboard-utils"

export interface WidgetTemplate {
  id: string
  name: string
  description: string
  icon: any
  category: string
  color: string
  defaultTarget: number
  unit: string
  units: string[]
}

const widgetTemplates: WidgetTemplate[] = [
  {
    id: "water",
    name: "Water Intake",
    description: "Track daily water consumption",
    icon: Droplets,
    category: "health",
    color: "blue",
    defaultTarget: 8,
    unit: "cups",
    units: ["cups","ml","oz"],
  },
  {
    id: "calories",
    name: "Calories Burned", 
    description: "Monitor daily calorie expenditure",
    icon: Flame,
    category: "health",
    color: "orange",
    defaultTarget: 2500,
    unit: "cal",
    units: ["cal"]
  },
  {
    id: "steps",
    name: "Daily Steps",
    description: "Count your steps throughout the day",
    icon: Target,
    category: "health", 
    color: "green",
    defaultTarget: 10000,
    unit: "steps",
    units: ["steps"]
  },
  {
    id: "weight",
    name: "Weight Tracking",
    description: "Monitor weight changes over time",
    icon: Scale,
    category: "health",
    color: "purple",
    defaultTarget: 150,
    unit: "lbs",
    units: ["lbs","kg"]
  },
  {
    id: "heartrate",
    name: "Heart Rate",
    description: "Track resting heart rate",
    icon: Heart,
    category: "health",
    color: "pink",
    defaultTarget: 70,
    unit: "bpm",
    units: ["bpm"]
  },
  {
    id: "sleep",
    name: "Sleep Duration",
    description: "Monitor nightly sleep hours",
    icon: Moon,
    category: "health",
    color: "purple",
    defaultTarget: 8,
    unit: "hours",
    units: ["hours"]
  },
  {
    id: "exercise",
    name: "Exercise Tracker",
    description: "Track workouts, set weekly goals, and monitor fitness progress",
    icon: Activity,
    category: "health",
    color: "green",
    defaultTarget: 3,
    unit: "workouts",
    units: ["workouts"]
  },
  {
    id: "caffeine",
    name: "Caffeine Intake",
    description: "Monitor daily caffeine consumption",
    icon: Coffee,
    category: "health",
    color: "gold",
    defaultTarget: 2,
    unit: "cups",
    units: ["cups"]
  },
  {
    id: "nutrition",
    name: "Daily Nutrition",
    description: "Track your daily meals and nutrition intake with breakfast, lunch, dinner, and snacks",
    icon: Utensils,
    category: "health",
    color: "green",
    defaultTarget: 1,
    unit: "meals",
    units: ["meals"]
  },
  {
    id: "mood",
    name: "Mood Tracker",
    description: "Log how you feel each day",
    icon: Smile,
    category: "wellness",
    color: "teal",
    defaultTarget: 1,
    unit: "entry",
    units: ["entry"]
  },
  {
    id: "journal",
    name: "Daily Journal",
    description: "Capture your thoughts and reflections",
    icon: Notebook,
    category: "wellness",
    color: "pink",
    defaultTarget: 1,
    unit: "entry",
    units: ["entry"]
  },
  {
    id: "meditation",
    name: "Meditation Minutes",
    description: "Track daily meditation time",
    icon: Brain,
    category: "wellness",
    color: "blue",
    defaultTarget: 10,
    unit: "min",
    units: ["min"]
  },
  {
    id: "gratitude",
    name: "Gratitude Journal",
    description: "Note what you're thankful for",
    icon: Sparkles,
    category: "wellness",
    color: "gold",
    defaultTarget: 1,
    unit: "entry",
    units: ["entry"]
  },
  {
    id: "breathwork",
    name: "Breathwork Timer",
    description: "Guided 4-7-8 breathing sessions",
    icon: Wind,
    category: "wellness",
    color: "blue",
    defaultTarget: 5,
    unit: "min",
    units: ["min"]
  },
  {
    id: "stretch",
    name: "Stretch Breaks",
    description: "Reminders to move and stretch",
    icon: Move,
    category: "wellness",
    color: "green",
    defaultTarget: 3,
    unit: "breaks",
    units: ["breaks"]
  },
  {
    id: "affirmations",
    name: "Daily Affirmations",
    description: "Positive affirmation carousel",
    icon: Quote,
    category: "wellness",
    color: "purple",
    defaultTarget: 1,
    unit: "set",
    units: ["set"]
  },
  {
    id: "screen_time",
    name: "Screen-Time Log",
    description: "Track non-work screen minutes",
    icon: Smartphone,
    category: "wellness",
    color: "gold",
    defaultTarget: 60,
    unit: "min",
    units: ["min"]
  },
  {
    id: "stress",
    name: "Stress Check-in",
    description: "1-10 scale quick log",
    icon: Gauge,
    category: "wellness",
    color: "pink",
    defaultTarget: 1,
    unit: "entry",
    units: ["entry"]
  },
  {
    id: "self_care",
    name: "Self-Care Checklist",
    description: "Custom daily self-care items",
    icon: CheckSquare,
    category: "wellness",
    color: "green",
    defaultTarget: 1,
    unit: "list",
    units: ["list"]
  },
  {
    id: "doctor_appt",
    name: "Doctor Appointments",
    description: "Upcoming medical visits and reminders",
    icon: CalendarClock,
    category: "medical",
    color: "purple",
    defaultTarget: 1,
    unit: "event",
    units: ["event"]
  },
  {
    id: "medication",
    name: "Medication Tracker",
    description: "Track doses and refill reminders",
    icon: Pill,
    category: "medical",
    color: "pink",
    defaultTarget: 1,
    unit: "dose",
    units: ["dose"]
  },
  {
    id: "quit_habit",
    name: "Habit You're Quitting",
    description: "Track progress and milestones for breaking bad habits",
    icon: ShieldOff,
    category: "medical",
    color: "slate",
    defaultTarget: 1,
    unit: "day",
    units: ["day"]
  },
  {
    id: "symptom_log",
    name: "Symptom Diary",
    description: "Record symptoms for consultations",
    icon: ClipboardList,
    category: "medical",
    color: "orange",
    defaultTarget: 1,
    unit: "entry",
    units: ["entry"]
  },
  {
    id: "medical_bills",
    name: "Medical Bills",
    description: "Track upcoming medical payments",
    icon: DollarSign,
    category: "medical",
    color: "slate",
    defaultTarget: 1,
    unit: "bill",
    units: ["bill"]
  },
  {
    id: "chores",
    name: "Chores Checklist",
    description: "Daily and weekly household chores",
    icon: ListChecks,
    category: "household",
    color: "gold",
    defaultTarget: 1,
    unit: "list",
    units: ["list"]
  },
  {
    id: "home_projects",
    name: "Home Projects",
    description: "DIY and improvement tasks",
    icon: Hammer,
    category: "household",
    color: "blue",
    defaultTarget: 1,
    unit: "project",
    units: ["project"]
  },
  {
    id: "maintenance",
    name: "Maintenance Schedule",
    description: "Filter changes, inspections, etc.",
    icon: Wrench,
    category: "household",
    color: "green",
    defaultTarget: 1,
    unit: "task",
    units: ["task"]
  },
  {
    id: "cleaning",
    name: "Deep Cleaning",
    description: "Monthly thorough cleaning tasks",
    icon: Brush,
    category: "household",
    color: "purple",
    defaultTarget: 1,
    unit: "task",
    units: ["task"]
  },
  {
    id: "family_members",
    name: "Family Members",
    description: "Roster with contact info & birthdays",
    icon: Users,
    category: "family",
    color: "purple",
    defaultTarget: 1,
    unit: "list",
    units: ["list"]
  },
  {
    id: "family_calendar",
    name: "Family Calendar",
    description: "Shared events & birthdays",
    icon: CalendarDays,
    category: "family",
    color: "blue",
    defaultTarget: 1,
    unit: "event",
    units: ["event"]
  },
  {
    id: "family_chores",
    name: "Chore Assignments",
    description: "Who is responsible today",
    icon: ClipboardList,
    category: "family",
    color: "green",
    defaultTarget: 1,
    unit: "task",
    units: ["task"]
  },
  {
    id: "meal_plan",
    name: "Meal Plan",
    description: "Weekly dinner plan & groceries",
    icon: Utensils,
    category: "family",
    color: "gold",
    defaultTarget: 1,
    unit: "week",
    units: ["week"]
  },
  {
    id: "family_budget",
    name: "Allowance / Budget",
    description: "Track allowances & shared expenses",
    icon: Wallet,
    category: "family",
    color: "purple",
    defaultTarget: 1,
    unit: "budget",
    units: ["budget"]
  },
  {
    id: "photo_carousel",
    name: "Photo Carousel",
    description: "Recent family memories",
    icon: ImageIcon,
    category: "family",
    color: "pink",
    defaultTarget: 1,
    unit: "photo",
    units: ["photo"]
  },
  {
    id: "emergency_info",
    name: "Health & Emergency Info",
    description: "Allergies, contacts, insurance",
    icon: HeartPulse,
    category: "family",
    color: "pink",
    defaultTarget: 1,
    unit: "entry",
    units: ["entry"]
  },
  {
    id: "carpool",
    name: "Carpool Schedule",
    description: "Who's driving where & when",
    icon: Car,
    category: "family",
    color: "blue",
    defaultTarget: 1,
    unit: "ride",
    units: ["ride"]
  },
  {
    id: "birthdays",
    name: "Birthdays",
    description: "Upcoming birthdays",
    icon: Cake,
    category: "social",
    color: "pink",
    defaultTarget: 1,
    unit: "birthday",
    units: ["birthday"]
  },
  {
    id: "social_events",
    name: "Events",
    description: "Concerts, meetups, parties",
    icon: PartyPopper,
    category: "social",
    color: "purple",
    defaultTarget: 1,
    unit: "event",
    units: ["event"]
  },
  {
    id: "holidays",
    name: "Holidays",
    description: "Public and personal holidays",
    icon: Gift,
    category: "social",
    color: "green",
    defaultTarget: 1,
    unit: "holiday",
    units: ["holiday"]
  },
  {
    id: "work_projects",
    name: "Projects Dashboard",
    description: "Status of active projects",
    icon: Briefcase,
    category: "work",
    color: "blue",
    defaultTarget: 1,
    unit: "project",
    units: ["project"]
  },
  {
    id: "work_deadlines",
    name: "Deadlines",
    description: "Upcoming milestones & due dates",
    icon: CalendarClock,
    category: "work",
    color: "orange",
    defaultTarget: 1,
    unit: "deadline",
    units: ["deadline"]
  },
  {
    id: "pomodoro",
    name: "Pomodoro Timer",
    description: "25-minute focus sessions",
    icon: Timer,
    category: "work",
    color: "teal",
    defaultTarget: 1,
    unit: "session",
    units: ["session"]
  },
  {
    id: "finance_budget",
    name: "Budget Planner",
    description: "Track monthly budget vs spend",
    icon: Wallet,
    category: "finance",
    color: "green",
    defaultTarget: 1,
    unit: "budget",
    units: ["budget"]
  },
  {
    id: "savings_tracker",
    name: "Savings Tracker",
    description: "Monitor savings progress",
    icon: PiggyBank,
    category: "finance",
    color: "green",
    defaultTarget: 1,
    unit: "amount",
    units: ["amount"]
  },
  {
    id: "net_worth",
    name: "Net Worth",
    description: "Assets minus liabilities snapshot",
    icon: TrendingUp,
    category: "finance",
    color: "purple",
    defaultTarget: 1,
    unit: "amount",
    units: ["amount"]
  },
  {
    id: "properties",
    name: "Properties",
    description: "Track real-estate assets",
    icon: HomeIcon,
    category: "finance",
    color: "gold",
    defaultTarget: 1,
    unit: "property",
    units: ["property"]
  },
  {
    id: "financial_goals",
    name: "Financial Goals",
    description: "Milestones toward big purchases",
    icon: Flag,
    category: "finance",
    color: "pink",
    defaultTarget: 1,
    unit: "goal",
    units: ["goal"]
  }
]


// Calidora-aligned color palette for widget swatches
const getColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    tan: "bg-[#B1916A]",
    green: "bg-[#48B882]",
    blue: "bg-[#4AADE0]",
    purple: "bg-[#8B7FD4]",
    pink: "bg-[#D07AA4]",
    gold: "bg-[#C4A44E]",
    orange: "bg-[#E28A5D]",
    teal: "bg-[#5E9B8C]",
    slate: "bg-[#8e99a8]",
    stone: "bg-[#b8b0a8]",
  }
  return colorMap[color] || "bg-[#B1916A]"
}

// Semi-opaque variant: pastel bg + colored icon
const getSemiOpaqueClasses = (color: string): { bg: string; text: string } => {
  const map: Record<string, { bg: string; text: string }> = {
    tan:    { bg: "bg-[#f5ede4]",    text: "text-[#B1916A]" },
    green:  { bg: "bg-emerald-100",  text: "text-[#48B882]" },
    blue:   { bg: "bg-blue-100",     text: "text-[#4AADE0]" },
    purple: { bg: "bg-purple-100",   text: "text-[#8B7FD4]" },
    pink:   { bg: "bg-pink-100",     text: "text-[#D07AA4]" },
    gold:   { bg: "bg-amber-100",    text: "text-[#C4A44E]" },
    orange: { bg: "bg-orange-100",   text: "text-[#E28A5D]" },
    teal:   { bg: "bg-teal-100",     text: "text-[#5E9B8C]" },
    slate:  { bg: "bg-slate-100",    text: "text-[#8e99a8]" },
    stone:  { bg: "bg-stone-100",    text: "text-[#b8b0a8]" },
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
        color: selectedTemplate.color,
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8e99a8]/70 w-4 h-4" />
          <input
            type="text"
            placeholder="Search widgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#dbd6cf]/80 rounded-xl focus:ring-2 focus:ring-[#B1916A]/30 focus:border-[#B1916A] outline-none transition-all duration-200 ease-out"
          />
        </div>
        
        {/* Category Filter */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-[#4a5568]">Category</span>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap sm:overflow-visible sm:gap-1">
            <button
              className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ease-out ${selectedCategory === 'all'
                ? 'bg-[rgba(177,145,106,0.12)] text-[#314158] font-medium'
                : 'bg-[rgba(183,148,106,0.08)] text-[#6b7688] hover:bg-[#ebe5de]'}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {allCategories.map(category => (
              <button
                key={category}
                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ease-out relative ${selectedCategory === category
                  ? 'bg-[rgba(177,145,106,0.12)] text-[#314158] font-medium'
                  : 'bg-[rgba(183,148,106,0.08)] text-[#6b7688] hover:bg-[#ebe5de]'} ${
                    getRecommendedCategory(bucket) === category && selectedCategory !== category 
                      ? 'ring-2 ring-[#B1916A]/40 ring-offset-1' 
                      : ''
                  }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
                {getRecommendedCategory(bucket) === category && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#B1916A] rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Show a hint if not viewing the recommended category */}
        {selectedCategory !== getRecommendedCategory(bucket) && selectedCategory !== 'all' && (
          <div className="text-sm text-[#8e99a8] flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#B1916A] rounded-full animate-pulse" />
            <span>Tip: Try the <button 
              onClick={() => setSelectedCategory(getRecommendedCategory(bucket))} 
              className="text-[#B1916A] hover:underline font-medium"
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
              <Card key={widget.id} className={`hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer ${selectedTemplate?.id === widget.id ? 'ring-2 ring-[#B1916A]' : ''}`} onClick={() => setSelectedTemplate(widget)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={bucketColor ? { backgroundColor: hexToRgba(bucketColor, 0.15) } : { backgroundColor: 'rgba(177,145,106,0.15)' }}>
                      <Icon className="w-5 h-5" style={{ color: bucketColor || '#B1916A' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                      <p className="text-xs text-[#8e99a8] mt-1">{widget.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[#8e99a8]">
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
          <div className="text-center py-8 text-[#8e99a8]">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No widgets found matching your criteria</p>
          </div>
        )}
      </div> {/* end left column */}

      {/* Right: live preview & config */}
      <div className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-6">
        <div className="rounded-xl border border-[#dbd6cf] bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-[#4a5568]">Preview</h4>
          {draftWidget ? (
            <>
              <div className="mt-3">
                <WidgetPreview widget={draftWidget} bucketColor={bucketColor} />
              </div>

              {/* Target input */}
              <div className="pt-4 space-y-2 border-t">
                <p className="text-xs font-medium text-[#6b7688]">Daily target</p>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Decrease target"
                    className="px-2 py-1 rounded bg-[rgba(183,148,106,0.08)] hover:bg-[#ebe5de]"
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
                  <span className="text-sm text-[#6b7688]">{draftWidget.unit}</span>
                  <button
                    aria-label="Increase target"
                    className="px-2 py-1 rounded bg-[rgba(183,148,106,0.08)] hover:bg-[#ebe5de]"
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
                  <p className="text-xs font-medium text-[#6b7688]">Data Source</p>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="dataSource"
                        value="manual"
                        checked={draftWidget.dataSource === 'manual'}
                        onChange={() => setDraftWidget(prev => prev ? { ...prev, dataSource: 'manual' } : prev)}
                        className="text-[#B1916A]"
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
                        className="text-[#B1916A]"
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
                          className="text-[#B1916A]"
                        />
                        <span className="text-sm">Google Fit (automatic)</span>
                      </label>
                    )}
                  </div>
                  {draftWidget.dataSource === 'fitbit' && (
                    <p className="text-xs text-[#8e99a8] mt-1">
                      {draftWidget.name} will sync automatically from your Fitbit device
                    </p>
                  )}
                </div>
              )}

              {/* Schedule picker */}
              <div className="space-y-2 pt-4 border-t">
                <p className="text-xs font-medium text-[#6b7688]">Schedule</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, idx) => (
                    <button
                      key={d}
                      aria-label={d}
                      className={`w-8 h-8 text-[11px] rounded-full border ${draftWidget.schedule[idx] ? 'bg-[#B1916A] text-white' : 'bg-white text-[#6b7688]'} hover:bg-[rgba(177,145,106,0.12)]`}
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
                    className="text-[11px] px-2 py-1 rounded bg-[rgba(183,148,106,0.08)] hover:bg-[#ebe5de]"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, schedule: [true, true, true, true, true, true, true] } : prev
                      )
                    }
                  >Every day</button>
                  <button
                    className="text-[11px] px-2 py-1 rounded bg-[rgba(183,148,106,0.08)] hover:bg-[#ebe5de]"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, schedule: [false, true, true, true, true, true, false] } : prev
                      )
                    }
                  >Weekdays</button>
                  <button
                    className="text-[11px] px-2 py-1 rounded bg-[rgba(183,148,106,0.08)] hover:bg-[#ebe5de]"
                    onClick={() =>
                      setDraftWidget((prev) =>
                        prev ? { ...prev, schedule: [true, false, true, false, true, false, true] } : prev
                      )
                    }
                  >Alternate</button>
                </div>
              </div>

              <button
                className="w-full mt-4 py-2 rounded bg-[#B1916A] hover:bg-[#a07f5a] text-white text-sm font-medium"
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
            <p className="mt-3 text-xs text-[#8e99a8]">Select a widget to see a preview</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Export the widget templates for use in other components
export { widgetTemplates };
