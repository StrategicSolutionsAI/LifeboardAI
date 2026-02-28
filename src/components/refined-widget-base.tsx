"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { text, elevation, interactive, badge, progress as progressStyles, iconBox, surface } from '@/lib/styles'

// Widget icon color variants
const WIDGET_ICON_COLORS = {
  violet: 'bg-gradient-to-br from-violet-500 to-violet-600',
  blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
  green: 'bg-gradient-to-br from-green-500 to-green-600',
  orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
  teal: 'bg-gradient-to-br from-teal-500 to-teal-600',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-theme-secondary',
} as const

interface RefinedWidgetBaseProps {
  title: string
  icon: LucideIcon
  iconColor: keyof typeof WIDGET_ICON_COLORS

  primaryValue: string | number
  primaryUnit?: string

  secondaryValue?: string
  secondaryLabel?: string

  progress?: number
  progressColor?: keyof typeof progressStyles.fill
  statusBadge?: {
    text: string
    variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  }

  onClick?: () => void
  isLoading?: boolean

  className?: string
  size?: 'compact' | 'normal' | 'large'
  variant?: 'minimal' | 'detailed'

  children?: React.ReactNode
}

export function RefinedWidgetBase({
  title,
  icon: Icon,
  iconColor,
  primaryValue,
  primaryUnit,
  secondaryValue,
  secondaryLabel,
  progress,
  progressColor = 'medium',
  statusBadge,
  onClick,
  isLoading = false,
  className,
  size = 'normal',
  variant = 'minimal',
  children
}: RefinedWidgetBaseProps) {
  const [isHovered, setIsHovered] = useState(false)

  const sizeConfig = {
    compact: { width: 'w-44', padding: 'p-4' },
    normal: { width: 'w-48', padding: 'p-4' },
    large: { width: 'w-56', padding: 'p-5' }
  }

  const badgeVariants = {
    success: badge.success,
    warning: badge.warning,
    danger: badge.danger,
    info: 'bg-theme-surface-selected text-theme-primary-600 border-theme-neutral-300',
    neutral: 'bg-theme-progress-track text-theme-text-primary border-theme-neutral-300'
  }

  if (isLoading) {
    return (
      <div className={cn(
        sizeConfig[size].width,
        'rounded-xl bg-theme-surface-raised',
        elevation.sm,
        sizeConfig[size].padding,
        'animate-pulse',
        className
      )}>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            iconBox.md,
            WIDGET_ICON_COLORS[iconColor],
            'opacity-50'
          )} />
          <div className={cn("h-4 rounded flex-1", surface.skeleton)} />
        </div>
        <div className="space-y-3">
          <div className={cn("h-8 rounded w-3/4", surface.skeleton)} />
          {progress !== undefined && (
            <div className={cn("h-2 rounded w-full", surface.progressTrack)} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        sizeConfig[size].width,
        'rounded-xl bg-theme-surface-raised cursor-pointer group',
        elevation.sm,
        interactive.transition,
        onClick && interactive.widgetHover,
        onClick && interactive.focus,
        sizeConfig[size].padding,
        'relative overflow-hidden',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      {/* Subtle hover glow effect */}
      <div className={cn(
        'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
        'bg-gradient-to-br from-theme-primary-50/50 to-theme-surface-alt/50'
      )} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              iconBox.md,
              'shadow-sm transition-transform duration-200',
              isHovered && 'scale-105',
              WIDGET_ICON_COLORS[iconColor]
            )}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <span className={cn(
              text.label,
              'transition-colors duration-200',
              isHovered && 'text-theme-text-body'
            )}>
              {title}
            </span>
          </div>

          {statusBadge && (
            <span className={cn(
              badge.pill,
              'transition-all duration-200',
              badgeVariants[statusBadge.variant],
              isHovered && 'scale-105'
            )}>
              {statusBadge.text}
            </span>
          )}
        </div>

        {/* Primary Metric */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className={cn(
            size === 'large' ? text.metricLg : text.metric,
            'transition-all duration-200'
          )}>
            {primaryValue}
          </span>
          {primaryUnit && (
            <span className={cn(
              text.unit,
              'transition-colors duration-200'
            )}>
              {primaryUnit}
            </span>
          )}
        </div>

        {/* Secondary Information */}
        {(secondaryValue || secondaryLabel) && (
          <div className="flex items-center justify-between text-xs mb-3">
            {secondaryLabel && (
              <span className={text.tertiary}>{secondaryLabel}</span>
            )}
            {secondaryValue && (
              <span className={cn("font-medium", text.body)}>{secondaryValue}</span>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="space-y-1">
            <div className={progressStyles.track}>
              <div
                className={cn(
                  progressStyles.fill[progressColor],
                  'transform origin-left',
                  isHovered && 'scale-y-110'
                )}
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
            {variant === 'detailed' && (
              <div className={cn("flex justify-between text-xs", text.tertiary)}>
                <span>{Math.round(progress)}%</span>
                <span>Goal</span>
              </div>
            )}
          </div>
        )}

        {/* Additional Content */}
        {children && (
          <div className="mt-3 pt-3 border-t border-theme-neutral-300">
            {children}
          </div>
        )}
      </div>

      {/* Interactive feedback */}
      {onClick && (
        <div className={cn(
          'absolute inset-0 opacity-0 group-active:opacity-10 transition-opacity duration-75',
          'bg-theme-text-primary pointer-events-none'
        )} />
      )}
    </div>
  )
}
