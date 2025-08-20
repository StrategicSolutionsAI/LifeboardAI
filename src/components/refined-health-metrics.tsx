"use client"

import { Droplets, Target, Activity, Flame } from 'lucide-react'
import { RefinedWidgetBase } from './refined-widget-base'

interface HealthMetric {
  id: string
  title: string
  icon: typeof Droplets
  iconColor: 'blue' | 'green' | 'orange' | 'teal' | 'violet' | 'indigo'
  value: number
  unit: string
  goal: number
  goalUnit?: string
}

interface RefinedHealthMetricsProps {
  className?: string
  onMetricClick?: (metricId: string) => void
  compact?: boolean
}

export function RefinedHealthMetrics({ 
  className, 
  onMetricClick, 
  compact = false 
}: RefinedHealthMetricsProps) {
  
  const healthMetrics: HealthMetric[] = [
    {
      id: 'water',
      title: 'Water Intake',
      icon: Droplets,
      iconColor: 'blue',
      value: 6,
      unit: 'glasses',
      goal: 8,
      goalUnit: 'glasses'
    },
    {
      id: 'steps',
      title: 'Daily Steps',
      icon: Target,
      iconColor: 'green',
      value: 8420,
      unit: 'steps',
      goal: 10000,
      goalUnit: 'steps'
    },
    {
      id: 'exercise',
      title: 'Exercise',
      icon: Activity,
      iconColor: 'orange',
      value: 25,
      unit: 'min',
      goal: 30,
      goalUnit: 'min'
    },
    {
      id: 'calories',
      title: 'Calories Burned',
      icon: Flame,
      iconColor: 'teal',
      value: 320,
      unit: 'cal',
      goal: 400,
      goalUnit: 'cal'
    }
  ]

  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4'} ${className}`}>
      {healthMetrics.map((metric) => {
        const progress = (metric.value / metric.goal) * 100
        
        const getProgressColor = () => {
          if (progress >= 100) return 'complete'
          if (progress >= 75) return 'high'
          if (progress >= 50) return 'medium'
          return 'low'
        }

        const getStatusBadge = () => {
          if (progress >= 100) return { text: 'Complete', variant: 'success' as const }
          if (progress >= 75) return { text: 'Almost', variant: 'info' as const }
          if (progress < 25) return { text: 'Low', variant: 'warning' as const }
          return undefined
        }

        return (
          <RefinedWidgetBase
            key={metric.id}
            title={metric.title}
            icon={metric.icon}
            iconColor={metric.iconColor}
            primaryValue={metric.value.toLocaleString()}
            primaryUnit={metric.unit}
            secondaryLabel="Goal"
            secondaryValue={`${metric.goal.toLocaleString()} ${metric.goalUnit}`}
            progress={progress}
            progressColor={getProgressColor()}
            statusBadge={getStatusBadge()}
            onClick={() => onMetricClick?.(metric.id)}
            size={compact ? "compact" : "normal"}
            variant="minimal"
          />
        )
      })}
    </div>
  )
}