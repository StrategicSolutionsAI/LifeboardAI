"use client"

import React, { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetInstance } from '@/types/widgets'
import { todayStrGlobal } from '@/lib/dashboard-utils'

// ── Lazy-loaded widget components ────────────────────────────────────────

const NutritionMealTracker = dynamic(
  () => import('@/features/widgets/components/nutrition-meal-tracker').then(m => m.NutritionMealTracker),
  { loading: () => <Skeleton className="h-32 w-full" /> },
)
const MedicationTrackerWidget = dynamic(
  () => import('@/features/widgets/components/medication-tracker-simple').then(m => m.MedicationTrackerWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> },
)
const ExerciseWidget = dynamic(
  () => import('@/features/widgets/components/exercise-widget-simple').then(m => m.ExerciseWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> },
)
const HomeProjectsWidget = dynamic(
  () => import('@/features/widgets/components/home-projects-widget').then(m => m.HomeProjectsWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> },
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

// ── Types ────────────────────────────────────────────────────────────────

interface ProgressEntry {
  value: number
  date: string
  streak: number
  lastCompleted: string
}

interface WidgetModalsContainerProps {
  /** Which modal is currently open (widget ID), or null */
  openModalId: string | null
  onClose: () => void
  /** The active widget instance (for Category B modals) */
  activeWidget: WidgetInstance | null
  setActiveWidget: React.Dispatch<React.SetStateAction<WidgetInstance | null>>
  /** Callback when a Category B widget's onUpdate fires */
  onWidgetUpdate: (widget: WidgetInstance, updates: Partial<WidgetInstance>) => void
  /** Progress map for computing current progress */
  progressByWidget: Record<string, ProgressEntry>
  /** Callback for incrementing progress */
  onIncrementProgress: (widget: WidgetInstance) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────

function computeProgress(
  widget: WidgetInstance,
  progressByWidget: Record<string, ProgressEntry>,
) {
  const p = progressByWidget[widget.instanceId]
  const today = todayStrGlobal
  if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false }
  return { value: p.value, streak: p.streak, isToday: true }
}

const HOME_PROJECTS_STATIC_WIDGET: WidgetInstance = {
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

// ── Component ────────────────────────────────────────────────────────────

export function WidgetModalsContainer({
  openModalId,
  onClose,
  activeWidget,
  setActiveWidget,
  onWidgetUpdate,
  progressByWidget,
  onIncrementProgress,
}: WidgetModalsContainerProps) {
  const isOpen = (id: string) => openModalId === id

  /** Shared onUpdate handler for Category B modals */
  const makeOnUpdate = useCallback(
    (widget: WidgetInstance) => (updates: Partial<WidgetInstance>) => {
      const merged = { ...widget, ...updates }
      setActiveWidget(merged)
      onWidgetUpdate(widget, updates)
    },
    [setActiveWidget, onWidgetUpdate],
  )

  return (
    <>
      {/* Nutrition */}
      <Sheet
        open={isOpen('nutrition')}
        onOpenChange={(open) => {
          if (!open) {
            onClose()
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('nutritionDataUpdated'))
            }, 100)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Daily Nutrition Tracker</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {isOpen('nutrition') && <NutritionMealTracker />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Medication */}
      <Sheet open={isOpen('medication')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Medication Tracker</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {isOpen('medication') && <MedicationTrackerWidget />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Exercise */}
      <Sheet open={isOpen('exercise')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-warm-950">Exercise Tracker</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {isOpen('exercise') && <ExerciseWidget onClose={onClose} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Home Projects */}
      <Sheet open={isOpen('home_projects')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-warm-950">Home Projects</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {isOpen('home_projects') && (
              <HomeProjectsWidget widget={HOME_PROJECTS_STATIC_WIDGET} onUpdate={() => {}} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Habit Tracker */}
      <Sheet open={isOpen('habit_tracker')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Habit Tracker</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('habit_tracker') && activeWidget && (
              <HabitTrackerWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sleep Tracker */}
      <Sheet open={isOpen('sleep')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Sleep Tracker</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('sleep') && activeWidget && (
              <SleepTrackerWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Meditation */}
      <Sheet open={isOpen('meditation')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Meditation</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('meditation') && activeWidget && (
              <MeditationTimerWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Breathwork */}
      <Sheet open={isOpen('breathwork')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Breathwork</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('breathwork') && activeWidget && (
              <BreathworkWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Water Intake */}
      <Sheet open={isOpen('water')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Water Intake</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('water') && activeWidget && (
              <WaterIntakeWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mood Tracker */}
      <Sheet open={isOpen('mood')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Mood Tracker</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('mood') && activeWidget && (
              <MoodTrackerWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Steps Tracker */}
      <Sheet open={isOpen('steps')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Daily Steps</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('steps') && activeWidget && (
              <StepsTrackerWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Heart Rate */}
      <Sheet open={isOpen('heartrate')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Heart Rate</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('heartrate') && activeWidget && (
              <HeartRateWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Caffeine Tracker */}
      <Sheet open={isOpen('caffeine')} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-theme-text-primary">Caffeine Intake</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {isOpen('caffeine') && activeWidget && (
              <CaffeineTrackerWidget
                widget={activeWidget}
                onUpdate={makeOnUpdate(activeWidget)}
                progress={computeProgress(activeWidget, progressByWidget)}
                onComplete={() => onIncrementProgress(activeWidget)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
