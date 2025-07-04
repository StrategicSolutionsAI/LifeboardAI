"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { getUserPreferencesClient, saveUserPreferences } from "@/lib/user-preferences";
import { format, addDays, isSameDay } from 'date-fns';
import {
  type LucideIcon,
  Plus,
  Search,
  MessageSquare,
  LogOut,
  X,
  Droplets,
  Flame,
  Target,
  Settings,
  Scale,
  Bell,
  Heart,
  Moon,
  Activity,
  Coffee,
  Brain,
  Calendar,
  CheckSquare,
  Clock,
  Users,
  Pill,
  Apple,
  Utensils,
  TreePine,
  Dumbbell,
  Home,
  DollarSign,
  Briefcase,
  Zap,
  Book,
  Gamepad2,
  Music,
  Palette,
  Camera,
  Plane,
  ShoppingBag,
  Wrench,
  FileText,
  BarChart,
  TrendingUp,
  Award,
  Gift,
  Sparkles,
  Smile,
  Notebook,
  Wind,
  Move,
  Quote,
  Smartphone,
  Gauge,
  CalendarClock,
  ClipboardList,
  Wallet,
  ImageIcon,
  HeartPulse,
  Car,
  Cake,
  PartyPopper,
  ShieldOff,
  Timer,
  PiggyBank,
  Flag,
  HomeIcon,
  Hammer,
  Brush,
  CalendarDays,
  RotateCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  LayoutDashboard,
  Settings as SettingsIcon,
  User,
  ListChecks,
} from "lucide-react";
import { WidgetLibrary } from "./widget-library";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import WidgetEditorSheet from "@/components/widget-editor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import TrendsPanel from "./trends-panel";

// Icon mapping for serialization
const iconMap: Record<string, LucideIcon> = {
  Droplets,
  Flame,
  Target,
  Scale,
  Heart,
  Moon,
  Activity,
  Coffee,
  Brain,
  Calendar,
  CheckSquare,
  Clock,
  Users,
  Pill,
  Apple,
  Utensils,
  TreePine,
  Dumbbell,
  Home,
  DollarSign,
  Briefcase,
  Zap,
  Book,
  Gamepad2,
  Music,
  Palette,
  Camera,
  Plane,
  ShoppingBag,
  Wrench,
  FileText,
  BarChart,
  TrendingUp,
  Award,
  Gift,
  Sparkles,
  water: Droplets,
  calories: Flame,
  steps: Target,
  weight: Scale,
  heartrate: Heart,
  sleep: Moon,
  exercise: Activity,
  caffeine: Coffee,
  chores: CheckSquare,
  mood: Smile,
  journal: Notebook,
  meditation: Brain,
  gratitude: Sparkles,
  breathwork: Wind,
  stretch: Move,
  affirmations: Quote,
  screen_time: Smartphone,
  stress: Gauge,
  self_care: CheckSquare,
  doctor_appt: CalendarClock,
  medication: Pill,
  quit_habit: ShieldOff,
  symptom_log: ClipboardList,
  medical_bills: DollarSign,
  home_projects: Hammer,
  maintenance: Wrench,
  cleaning: Brush,
  family_members: Users,
  family_calendar: CalendarDays,
  family_chores: ClipboardList,
  meal_plan: Utensils,
  family_budget: Wallet,
  photo_carousel: ImageIcon,
  emergency_info: HeartPulse,
  carpool: Car,
  birthdays: Cake,
  social_events: PartyPopper,
  holidays: Gift,
  work_projects: Briefcase,
  work_deadlines: CalendarClock,
  pomodoro: Timer,
  finance_budget: Wallet,
  savings_tracker: PiggyBank,
  net_worth: TrendingUp,
  properties: HomeIcon,
  financial_goals: Flag,
};

// Helper to get icon component from string name
const getIconComponent = (name: string): LucideIcon | null => {
  return iconMap[name] || null
}

// Default colors for widget templates
const templateColors: Record<string, string> = {
  water: "blue",
  calories: "orange",
  steps: "green",
  weight: "purple",
  heartrate: "red",
  sleep: "indigo",
  exercise: "teal",
  caffeine: "amber",
  chores: "amber",
};

const getTemplateColor = (id: string): string | null => {
  return templateColors[id] || null;
};

// Color to Tailwind background class map (500 tone)
const BG_COLOR_CLASSES: Record<string,string> = {
  gray: "bg-gray-500", 
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500", 
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
};

// Create debounce function
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let debounceTimer: NodeJS.Timeout;
  return function(...args: any[]) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func(...args), delay);
  };
};

// Helper to format date consistently
const dateStr = (d: Date) => {
  return format(d, 'yyyy-MM-dd');
};

// Global date strings
const todayStrGlobal = dateStr(new Date());
const yesterdayStrGlobal = dateStr(new Date(Date.now() - 86400000));

const SUGGESTED_BUCKETS = [
  "Health",
  "Wellness",
  "Medical",
  "Household",
  "Family",
  "Social",
  "Work",
  "Finance",
  "Education",
  "Hobbies",
  "Travel",
  "Meals",
];

export default function TaskBoardDashboard() {
  // Rest of the function content remains the same until the return statement
  
  // This is a placeholder for your existing component logic
  // Copy your existing state and functions here

  return (
    <div className="h-screen bg-[#F6F6FC] flex flex-col relative">
      {/* Header - Fixed at the top */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-6 z-50 shadow-sm">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-xl font-semibold">Lifeboard</h1>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Search className="h-5 w-5 text-gray-500" />
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-500" />
            </button>
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-full overflow-hidden relative">
        {/* Sidebar - Fixed position */}
        <div className="fixed left-0 top-16 bottom-0 w-20 bg-white border-r border-gray-100 flex-shrink-0 flex flex-col items-center py-4 justify-between z-50 shadow-sm">
          <div className="flex flex-col items-center gap-6">
            {/* Add your existing sidebar icons here */}
          </div>
          
          {/* Bottom section with settings */}
          <div className="mb-6">
            <Link 
              href="/dashboard/settings" 
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
              title="Settings"
            >
              <Settings className="h-6 w-6" />
            </Link>
          </div>
        </div>

        {/* Main content area - Scrollable */}
        <div className="flex-1 ml-20 overflow-y-auto bg-[#F6F6FC] p-6 h-full">
          <div className="flex gap-6">
            {/* Left column - widgets */}
            <div className="flex-1">
              {/* Top section with welcome and date */}
              <div className="flex items-center justify-between mb-4">
                {/* Content here */}
              </div>

              {/* Buckets and widgets */}
              <div>
                {/* Bucket tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200">
                  {/* Bucket tabs content */}
                </div>

                {/* Widgets grid */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {/* Widget grid content */}
                </div>
              </div>
            </div>

            {/* Right sidebar with weather, calendar, tasks */}
            <aside className="w-80 shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Weather widget */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  {/* Weather content */}
                </div>

                {/* Calendar */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  {/* Calendar content */}
                </div>

                {/* Task management section */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  {/* Task view selector */}
                  <div className="flex items-center gap-1 mb-4">
                    {/* Task view selector content */}
                  </div>

                  {/* To-do lists with drag & drop */}
                  <div className="mt-6 flex-1 overflow-hidden flex flex-col">
                    <DragDropContext onDragEnd={handleDragEnd}>
                      {/* Daily tasks (shown in Today and Master List views) */}
                      {(taskView === 'Today' || taskView === 'Master List') && (
                        <Droppable droppableId="dailyTasks">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col mb-4">
                              {/* Daily tasks content */}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}

                      {/* Master tasks (shown in Master List view) */}
                      {taskView === 'Master List' && (
                        <Droppable droppableId="openTasks">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col mt-4">
                              {/* Master tasks content */}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}
                    </DragDropContext>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {/* Bucket management sheet */}
      <Sheet open={isBucketSheetOpen} onOpenChange={setIsBucketSheetOpen}>
        <SheetContent side="right">
          {/* Sheet content */}
        </SheetContent>
      </Sheet>

      {/* Widget library sheet */}
      <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
        <SheetContent side="right" className="w-[800px] overflow-y-auto">
          {/* Widget library content */}
        </SheetContent>
      </Sheet>
    </div>
  );
}
