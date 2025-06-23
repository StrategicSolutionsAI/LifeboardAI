"use client"

import { useState } from "react"
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
  } from "lucide-react"

export interface WidgetTemplate {
  id: string
  name: string
  description: string
  icon: any
  category: string
  color: string
  defaultTarget: number
  unit: string
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
    unit: "cups"
  },
  {
    id: "calories",
    name: "Calories Burned", 
    description: "Monitor daily calorie expenditure",
    icon: Flame,
    category: "health",
    color: "orange",
    defaultTarget: 2500,
    unit: "cal"
  },
  {
    id: "steps",
    name: "Daily Steps",
    description: "Count your steps throughout the day",
    icon: Target,
    category: "health", 
    color: "green",
    defaultTarget: 10000,
    unit: "steps"
  },
  {
    id: "weight",
    name: "Weight Tracking",
    description: "Monitor weight changes over time",
    icon: Scale,
    category: "health",
    color: "purple",
    defaultTarget: 150,
    unit: "lbs"
  },
  {
    id: "heartrate",
    name: "Heart Rate",
    description: "Track resting heart rate",
    icon: Heart,
    category: "health",
    color: "red",
    defaultTarget: 70,
    unit: "bpm"
  },
  {
    id: "sleep",
    name: "Sleep Duration",
    description: "Monitor nightly sleep hours",
    icon: Moon,
    category: "health",
    color: "indigo",
    defaultTarget: 8,
    unit: "hours"
  },
  {
    id: "exercise",
    name: "Exercise Minutes",
    description: "Track daily exercise time",
    icon: Activity,
    category: "health",
    color: "green",
    defaultTarget: 30,
    unit: "min"
  },
  {
    id: "caffeine",
    name: "Caffeine Intake",
    description: "Monitor daily caffeine consumption",
    icon: Coffee,
    category: "health",
    color: "amber",
    defaultTarget: 2,
    unit: "cups"
  },
  {
    id: "mood",
    name: "Mood Tracker",
    description: "Log how you feel each day",
    icon: Smile,
    category: "wellness",
    color: "teal",
    defaultTarget: 1,
    unit: "entry"
  },
  {
    id: "journal",
    name: "Daily Journal",
    description: "Capture your thoughts and reflections",
    icon: Notebook,
    category: "wellness",
    color: "rose",
    defaultTarget: 1,
    unit: "entry"
  },
  {
    id: "meditation",
    name: "Meditation Minutes",
    description: "Track daily meditation time",
    icon: Brain,
    category: "wellness",
    color: "cyan",
    defaultTarget: 10,
    unit: "min"
  },
  {
    id: "gratitude",
    name: "Gratitude Journal",
    description: "Note what you're thankful for",
    icon: Sparkles,
    category: "wellness",
    color: "yellow",
    defaultTarget: 1,
    unit: "entry"
  },
  {
    id: "breathwork",
    name: "Breathwork Timer",
    description: "Guided 4-7-8 breathing sessions",
    icon: Wind,
    category: "wellness",
    color: "sky",
    defaultTarget: 5,
    unit: "min"
  },
  {
    id: "stretch",
    name: "Stretch Breaks",
    description: "Reminders to move and stretch",
    icon: Move,
    category: "wellness",
    color: "emerald",
    defaultTarget: 3,
    unit: "breaks"
  },
  {
    id: "affirmations",
    name: "Daily Affirmations",
    description: "Positive affirmation carousel",
    icon: Quote,
    category: "wellness",
    color: "violet",
    defaultTarget: 1,
    unit: "set"
  },
  {
    id: "screen_time",
    name: "Screen-Time Log",
    description: "Track non-work screen minutes",
    icon: Smartphone,
    category: "wellness",
    color: "amber",
    defaultTarget: 60,
    unit: "min"
  },
  {
    id: "stress",
    name: "Stress Check-in",
    description: "1-10 scale quick log",
    icon: Gauge,
    category: "wellness",
    color: "red",
    defaultTarget: 1,
    unit: "entry"
  },
  {
    id: "self_care",
    name: "Self-Care Checklist",
    description: "Custom daily self-care items",
    icon: CheckSquare,
    category: "wellness",
    color: "lime",
    defaultTarget: 1,
    unit: "list"
  },
  {
    id: "doctor_appt",
    name: "Doctor Appointments",
    description: "Upcoming medical visits and reminders",
    icon: CalendarClock,
    category: "medical",
    color: "indigo",
    defaultTarget: 1,
    unit: "event"
  },
  {
    id: "medication",
    name: "Medication Tracker",
    description: "Track doses and refill reminders",
    icon: Pill,
    category: "medical",
    color: "fuchsia",
    defaultTarget: 1,
    unit: "dose"
  },
  {
    id: "quit_habit",
    name: "Quit Habit Tracker",
    description: "Days since last cigarette/soda etc.",
    icon: ShieldOff,
    category: "medical",
    color: "gray",
    defaultTarget: 1,
    unit: "day"
  },
  {
    id: "symptom_log",
    name: "Symptom Diary",
    description: "Record symptoms for consultations",
    icon: ClipboardList,
    category: "medical",
    color: "orange",
    defaultTarget: 1,
    unit: "entry"
  },
  {
    id: "medical_bills",
    name: "Medical Bills",
    description: "Track upcoming medical payments",
    icon: DollarSign,
    category: "medical",
    color: "slate",
    defaultTarget: 1,
    unit: "bill"
  },
  {
    id: "chores",
    name: "Chores Checklist",
    description: "Daily and weekly household chores",
    icon: ListChecks,
    category: "household",
    color: "amber",
    defaultTarget: 1,
    unit: "list"
  },
  {
    id: "home_projects",
    name: "Home Projects",
    description: "DIY and improvement tasks",
    icon: Hammer,
    category: "household",
    color: "blue",
    defaultTarget: 1,
    unit: "project"
  },
  {
    id: "maintenance",
    name: "Maintenance Schedule",
    description: "Filter changes, inspections, etc.",
    icon: Wrench,
    category: "household",
    color: "green",
    defaultTarget: 1,
    unit: "task"
  },
  {
    id: "cleaning",
    name: "Deep Cleaning",
    description: "Monthly thorough cleaning tasks",
    icon: Brush,
    category: "household",
    color: "purple",
    defaultTarget: 1,
    unit: "task"
  },
  {
    id: "family_members",
    name: "Family Members",
    description: "Roster with contact info & birthdays",
    icon: Users,
    category: "family",
    color: "indigo",
    defaultTarget: 1,
    unit: "list"
  },
  {
    id: "family_calendar",
    name: "Family Calendar",
    description: "Shared events & birthdays",
    icon: CalendarDays,
    category: "family",
    color: "sky",
    defaultTarget: 1,
    unit: "event"
  },
  {
    id: "family_chores",
    name: "Chore Assignments",
    description: "Who is responsible today",
    icon: ClipboardList,
    category: "family",
    color: "green",
    defaultTarget: 1,
    unit: "task"
  },
  {
    id: "meal_plan",
    name: "Meal Plan",
    description: "Weekly dinner plan & groceries",
    icon: Utensils,
    category: "family",
    color: "amber",
    defaultTarget: 1,
    unit: "week"
  },
  {
    id: "family_budget",
    name: "Allowance / Budget",
    description: "Track allowances & shared expenses",
    icon: Wallet,
    category: "family",
    color: "violet",
    defaultTarget: 1,
    unit: "budget"
  },
  {
    id: "photo_carousel",
    name: "Photo Carousel",
    description: "Recent family memories",
    icon: ImageIcon,
    category: "family",
    color: "rose",
    defaultTarget: 1,
    unit: "photo"
  },
  {
    id: "emergency_info",
    name: "Health & Emergency Info",
    description: "Allergies, contacts, insurance",
    icon: HeartPulse,
    category: "family",
    color: "red",
    defaultTarget: 1,
    unit: "entry"
  },
  {
    id: "carpool",
    name: "Carpool Schedule",
    description: "Who’s driving where & when",
    icon: Car,
    category: "family",
    color: "cyan",
    defaultTarget: 1,
    unit: "ride"
  },
  {
    id: "birthdays",
    name: "Birthdays",
    description: "Upcoming birthdays",
    icon: Cake,
    category: "social",
    color: "rose",
    defaultTarget: 1,
    unit: "birthday"
  },
  {
    id: "social_events",
    name: "Events",
    description: "Concerts, meetups, parties",
    icon: PartyPopper,
    category: "social",
    color: "indigo",
    defaultTarget: 1,
    unit: "event"
  },
  {
    id: "holidays",
    name: "Holidays",
    description: "Public and personal holidays",
    icon: Gift,
    category: "social",
    color: "emerald",
    defaultTarget: 1,
    unit: "holiday"
  },
  {
    id: "work_projects",
    name: "Projects Dashboard",
    description: "Status of active projects",
    icon: Briefcase,
    category: "work",
    color: "blue",
    defaultTarget: 1,
    unit: "project"
  },
  {
    id: "work_deadlines",
    name: "Deadlines",
    description: "Upcoming milestones & due dates",
    icon: CalendarClock,
    category: "work",
    color: "orange",
    defaultTarget: 1,
    unit: "deadline"
  },
  {
    id: "pomodoro",
    name: "Pomodoro Timer",
    description: "25-minute focus sessions",
    icon: Timer,
    category: "work",
    color: "teal",
    defaultTarget: 1,
    unit: "session"
  },
  {
    id: "finance_budget",
    name: "Budget Planner",
    description: "Track monthly budget vs spend",
    icon: Wallet,
    category: "finance",
    color: "lime",
    defaultTarget: 1,
    unit: "budget"
  },
  {
    id: "savings_tracker",
    name: "Savings Tracker",
    description: "Monitor savings progress",
    icon: PiggyBank,
    category: "finance",
    color: "emerald",
    defaultTarget: 1,
    unit: "amount"
  },
  {
    id: "net_worth",
    name: "Net Worth",
    description: "Assets minus liabilities snapshot",
    icon: TrendingUp,
    category: "finance",
    color: "violet",
    defaultTarget: 1,
    unit: "amount"
  },
  {
    id: "properties",
    name: "Properties",
    description: "Track real-estate assets",
    icon: HomeIcon,
    category: "finance",
    color: "amber",
    defaultTarget: 1,
    unit: "property"
  },
  {
    id: "financial_goals",
    name: "Financial Goals",
    description: "Milestones toward big purchases",
    icon: Flag,
    category: "finance",
    color: "fuchsia",
    defaultTarget: 1,
    unit: "goal"
  }
]


// Helper function to convert color name to Tailwind class
const getColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    red: "bg-red-500",
    orange: "bg-orange-500",
    purple: "bg-purple-500",
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    teal: "bg-teal-500",
    rose: "bg-rose-500",
    cyan: "bg-cyan-500",
    yellow: "bg-yellow-500",
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    lime: "bg-lime-500",
    fuchsia: "bg-fuchsia-500",
    gray: "bg-gray-500",
    slate: "bg-slate-500",
    stone: "bg-stone-500"
  }
  return colorMap[color] || "bg-gray-500" // Default to gray if color not found
}

interface WidgetLibraryProps { onAdd: (widget: WidgetTemplate) => void; bucket: string }

export function WidgetLibrary({ onAdd, bucket }: WidgetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // For now, we'll use a simple approach: let the user choose which category to view
  // and provide recommendations based on the current bucket
  console.log('Current bucket:', bucket);
  
  // Get all distinct categories from widgetTemplates
  const allCategories = Array.from(new Set(widgetTemplates.map(w => w.category)));
  console.log('Available categories:', allCategories);
  
  // Initial recommended category based on bucket name
  const getRecommendedCategory = (bucketName: string): string => {
    const lowerBucket = bucketName.toLowerCase();
    if (lowerBucket === 'health' || lowerBucket === 'fitness') return 'health';
    if (lowerBucket === 'work' || lowerBucket === 'school') return 'productivity';
    if (lowerBucket === 'personal' || lowerBucket === 'wellness') return 'wellness';
    if (lowerBucket === 'finance' || lowerBucket === 'money') return 'finance';
    if (lowerBucket === 'social' || lowerBucket === 'family') return 'social';
    return 'health'; // Default
  };
  
  // State for selected category (defaults to recommended based on bucket)
  const [selectedCategory, setSelectedCategory] = useState<string>(getRecommendedCategory(bucket));
  
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
  
  console.log('Selected category:', selectedCategory, 'matches:', filteredWidgets.length);


  return (
    <div className="space-y-6 mt-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search widgets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
      
      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Category:</span>
        <div className="flex flex-wrap gap-1">
          <button
            className={`px-2 py-1 text-xs rounded-full ${selectedCategory === 'all' 
              ? 'bg-indigo-100 text-indigo-700' 
              : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          {allCategories.map(category => (
            <button
              key={category}
              className={`px-2 py-1 text-xs rounded-full ${selectedCategory === category 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>


      {/* Widget Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
        {filteredWidgets.map((widget) => {
          const Icon = widget.icon
          return (
            <Card key={widget.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getColorClass(widget.color)}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{widget.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Target: {widget.defaultTarget} {widget.unit}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => onAdd(widget)}
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
        <div className="text-center py-8 text-gray-500">
          <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No widgets found matching your criteria</p>
        </div>
      )}
    </div>
  )
}
