import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
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
} from "lucide-react";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import { widgetTemplates } from "@/components/widget-library";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfileNameRow = {
  first_name?: string | null;
};

export interface WidgetLogEntry {
  id: string;
  widgetInstanceId: string;
  widgetName: string;
  message: string;
  details?: string;
  occurredAt: string;
  kind: "progress" | "integration" | "entry" | "task" | "system";
}

export interface DestructiveConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

export interface UndoState {
  id: number;
  message: string;
  onUndo: () => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const iconMap: Record<string, LucideIcon> = {
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
  nutrition: Utensils,
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

export const LOG_KIND_DOT_CLASS: Record<WidgetLogEntry["kind"], string> = {
  progress: "bg-[#4AADE0]",
  integration: "bg-[#48B882]",
  entry: "bg-[#8B7FD4]",
  task: "bg-[#C4A44E]",
  system: "bg-[#b8b0a8]",
};

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

export const extractFirstWord = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [first] = trimmed.split(/\s+/);
  return first || null;
};

export const deriveGreetingName = (profile: ProfileNameRow | null, supabaseUser: User | null): string => {
  if (!supabaseUser) {
    return "there";
  }

  const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    profile?.first_name,
    metadata.preferred_name,
    metadata.first_name,
    metadata.given_name,
    metadata.nickname,
    metadata.name,
    metadata.full_name,
    metadata.user_name,
    metadata.username,
  ];

  for (const candidate of candidates) {
    const extracted = extractFirstWord(candidate);
    if (extracted) {
      return extracted;
    }
  }

  if (typeof supabaseUser.email === "string" && supabaseUser.email.includes("@")) {
    const [localPart] = supabaseUser.email.split("@");
    if (localPart) {
      return localPart;
    }
  }

  return "there";
};

export const getIconComponent = (name: string): LucideIcon | null => {
  return iconMap[name] || null;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getWidgetColorStyles = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return {
    solid: hex,
    text: hex,
    tint: `rgba(${r}, ${g}, ${b}, 0.08)`,
    iconTint: `rgba(${r}, ${g}, ${b}, 0.15)`,
  };
};

export const dateStr = (d: Date) => d.toISOString().slice(0, 10);
export const todayStrGlobal = dateStr(new Date());
export const yesterdayStrGlobal = dateStr(new Date(Date.now() - 86400000));

export function withRetry<T>(loader: () => Promise<T>, retries = 2, delayMs = 1500) {
  return async () => {
    let lastErr: unknown;
    for (let i = 0; i <= retries; i++) {
      try { return await loader(); } catch (e) { lastErr = e; }
      await new Promise(r => setTimeout(r, delayMs));
    }
    throw lastErr;
  };
}

export const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  let lastArgs: any[] | null = null;
  const debounced = (...args: any[]) => {
    lastArgs = args;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      lastArgs = null;
      func.apply(null, args);
    }, delay);
  };
  debounced.flush = () => {
    if (lastArgs !== null) {
      clearTimeout(timeoutId);
      const args = lastArgs;
      lastArgs = null;
      func.apply(null, args);
    }
  };
  return debounced;
};

// ---------------------------------------------------------------------------
// Widget migration
// ---------------------------------------------------------------------------

export function migrateWidgetsToTemplates(widgetsByBucket: Record<string, WidgetInstance[]>): Record<string, WidgetInstance[]> {
  const migratedWidgets = { ...widgetsByBucket };
  let hasChanges = false;

  const templateMap = new Map<string, WidgetTemplate>();
  widgetTemplates.forEach(template => {
    templateMap.set(template.id, template);
  });

  Object.keys(migratedWidgets).forEach(bucketName => {
    const widgets = migratedWidgets[bucketName];

    widgets.forEach((widget, index) => {
      const template = templateMap.get(widget.id);
      if (template) {
        const needsNameUpdate = widget.name !== template.name;
        const needsIconUpdate = widget.icon !== template.icon;

        if (needsNameUpdate || needsIconUpdate) {
          migratedWidgets[bucketName][index] = {
            ...widget,
            name: template.name,
            icon: template.icon,
          };
          hasChanges = true;
        }
      }
    });
  });

  return migratedWidgets;
}
