import React from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetInstance } from '@/types/widgets'
import type { ProgressEntry } from '@/features/dashboard/types'
import { todayStrGlobal } from '@/lib/dashboard-utils'

// ── Types ────────────────────────────────────────────────────────────────

export interface ModalRenderProps {
  widget: WidgetInstance | null
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
  onClose: () => void
  onRemove?: () => void
}

export interface WidgetModalEntry {
  title: string
  /** Dynamic title based on widget data (overrides `title` when present) */
  getTitle?: (widget: WidgetInstance | null) => string
  /** Render function receives common props, returns the modal content */
  render: (props: ModalRenderProps) => React.ReactNode
  /** Custom side-effect to run when the modal closes */
  onCloseEffect?: () => void
  /** Top margin for the content area (default 'mt-2') */
  contentMargin?: string
  /** Sheet width classes (default 'w-full sm:w-[600px] md:w-[700px]') */
  sheetWidth?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function computeProgress(
  progressEntry: ProgressEntry | undefined,
) {
  const today = todayStrGlobal
  if (!progressEntry || progressEntry.date !== today) return { value: 0, streak: progressEntry?.streak || 0, isToday: false }
  return { value: progressEntry.value, streak: progressEntry.streak, isToday: true }
}

export const HOME_PROJECTS_STATIC_WIDGET: WidgetInstance = {
  id: 'home-projects-modal',
  instanceId: 'home-projects-modal',
  name: 'Home Projects',
  description: 'Track and manage home improvement projects',
  icon: 'Hammer',
  category: 'productivity',
  unit: 'projects',
  defaultTarget: 5,
  color: 'blue',
  target: 0,
  schedule: [true, true, true, true, true, true, true],
  createdAt: new Date().toISOString(),
}

// ── Lazy-loaded widget components ────────────────────────────────────────

const NutritionMealTracker = dynamic(
  () => import('@/features/widgets/components/nutrition-meal-tracker').then(m => m.NutritionMealTracker),
  { loading: () => React.createElement(Skeleton, { className: 'h-32 w-full' }) },
)
const MedicationTrackerWidget = dynamic(
  () => import('@/features/widgets/components/medication-tracker-simple').then(m => m.MedicationTrackerWidget),
  { loading: () => React.createElement(Skeleton, { className: 'h-24 w-full' }) },
)
const ExerciseWidget = dynamic(
  () => import('@/features/widgets/components/exercise-widget-simple').then(m => m.ExerciseWidget),
  { loading: () => React.createElement(Skeleton, { className: 'h-24 w-full' }) },
)
const HomeProjectsWidget = dynamic(
  () => import('@/features/widgets/components/home-projects-widget').then(m => m.HomeProjectsWidget),
  { loading: () => React.createElement(Skeleton, { className: 'h-24 w-full' }) },
)
const HabitTrackerWidget = dynamic(
  () => import('@/features/widgets/components/habit-tracker-widget').then(m => m.HabitTrackerWidget),
  { ssr: false },
)
const SleepTrackerWidget = dynamic(
  () => import('@/features/widgets/components/sleep-tracker-widget').then(m => m.SleepTrackerWidget),
  { ssr: false },
)
const MeditationTimerWidget = dynamic(
  () => import('@/features/widgets/components/meditation-timer-widget').then(m => m.MeditationTimerWidget),
  { ssr: false },
)
const BreathworkWidget = dynamic(
  () => import('@/features/widgets/components/breathwork-widget').then(m => m.BreathworkWidget),
  { ssr: false },
)
const WaterIntakeWidget = dynamic(
  () => import('@/features/widgets/components/water-intake-widget').then(m => m.WaterIntakeWidget),
  { ssr: false },
)
const MoodTrackerWidget = dynamic(
  () => import('@/features/widgets/components/mood-tracker-widget').then(m => m.MoodTrackerWidget),
  { ssr: false },
)
const StepsTrackerWidget = dynamic(
  () => import('@/features/widgets/components/steps-tracker-widget').then(m => m.StepsTrackerWidget),
  { ssr: false },
)
const HeartRateWidget = dynamic(
  () => import('@/features/widgets/components/heart-rate-widget').then(m => m.HeartRateWidget),
  { ssr: false },
)
const CaffeineTrackerWidget = dynamic(
  () => import('@/features/widgets/components/caffeine-tracker-widget').then(m => m.CaffeineTrackerWidget),
  { ssr: false },
)
const CycleTrackingWidget = dynamic(
  () => import('@/features/widgets/components/cycle-tracking-widget').then(m => m.CycleTrackingWidget),
  { ssr: false },
)
const FamilyMembersWidget = dynamic(
  () => import('@/features/widgets/components/family-members-widget').then(m => m.FamilyMembersWidget),
  { ssr: false },
)
const BudgetWidgetModal = dynamic(
  () => import('@/features/widgets/components/budget-widget-modal').then(m => m.BudgetWidgetModal),
  { ssr: false },
)

// ── Stateful render helper ───────────────────────────────────────────────

/** Standard render for stateful widgets that receive widget+onUpdate+progress+onComplete */
function statefulRender(
  Component: React.ComponentType<any>, // any: widget prop types vary across components
) {
  const renderer = (props: ModalRenderProps) =>
    props.widget
      ? React.createElement(Component, {
          widget: props.widget,
          onUpdate: props.onUpdate,
          progress: props.progress,
          onComplete: props.onComplete,
          onRemove: props.onRemove,
        })
      : null
  renderer.displayName = `StatefulRender(${Component.displayName || Component.name || 'Widget'})`
  return renderer
}

// ── Registry ─────────────────────────────────────────────────────────────

export const WIDGET_MODAL_REGISTRY: Record<string, WidgetModalEntry> = {
  nutrition: {
    title: 'Daily Nutrition Tracker',
    contentMargin: 'mt-6',
    onCloseEffect: () => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('nutritionDataUpdated'))
      }, 100)
    },
    render: () => React.createElement(NutritionMealTracker),
  },
  medication: {
    title: 'Medication Tracker',
    contentMargin: 'mt-6',
    render: () => React.createElement(MedicationTrackerWidget),
  },
  exercise: {
    title: 'Exercise Tracker',
    contentMargin: 'mt-6',
    render: (props) => React.createElement(ExerciseWidget, { onClose: props.onClose }),
  },
  home_projects: {
    title: 'Home Projects',
    contentMargin: 'mt-6',
    render: () =>
      React.createElement(HomeProjectsWidget, {
        widget: HOME_PROJECTS_STATIC_WIDGET,
        onUpdate: () => {},
      }),
  },
  habit_tracker: {
    title: 'Habit Tracker',
    getTitle: (w) => w?.habitTrackerData?.habitName || 'Habit Tracker',
    sheetWidth: 'w-full sm:w-[480px]',
    render: statefulRender(HabitTrackerWidget),
  },
  sleep: {
    title: 'Sleep Tracker',
    render: statefulRender(SleepTrackerWidget),
  },
  meditation: {
    title: 'Meditation',
    render: statefulRender(MeditationTimerWidget),
  },
  breathwork: {
    title: 'Breathwork',
    render: statefulRender(BreathworkWidget),
  },
  water: {
    title: 'Water Intake',
    render: statefulRender(WaterIntakeWidget),
  },
  mood: {
    title: 'Mood Tracker',
    render: statefulRender(MoodTrackerWidget),
  },
  steps: {
    title: 'Daily Steps',
    render: statefulRender(StepsTrackerWidget),
  },
  heartrate: {
    title: 'Heart Rate',
    render: statefulRender(HeartRateWidget),
  },
  caffeine: {
    title: 'Caffeine Intake',
    render: statefulRender(CaffeineTrackerWidget),
  },
  cycle_tracking: {
    title: 'Cycle Tracker',
    render: statefulRender(CycleTrackingWidget),
  },
  family_members: {
    title: 'Family Members',
    render: (props) =>
      props.widget
        ? React.createElement(FamilyMembersWidget, {
            widget: props.widget,
            onUpdate: props.onUpdate,
          })
        : null,
  },
  finance_budget: {
    title: 'Budget Planner',
    contentMargin: 'mt-6',
    render: (props) =>
      props.widget
        ? React.createElement(BudgetWidgetModal, {
            widget: props.widget,
            onUpdate: props.onUpdate,
          })
        : null,
  },
}
