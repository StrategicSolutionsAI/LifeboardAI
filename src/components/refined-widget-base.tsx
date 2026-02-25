"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

// Design System Constants
export const WIDGET_DESIGN_TOKENS = {
  // Spacing
  spacing: {
    xs: 'p-3',
    sm: 'p-4', 
    md: 'p-5',
    lg: 'p-6'
  },
  
  // Typography Scale
  typography: {
    metric: 'text-3xl font-black leading-none tracking-tight',
    metricLarge: 'text-4xl font-black leading-none tracking-tight',
    unit: 'text-sm font-medium text-[#8e99a8]',
    label: 'text-xs font-semibold uppercase tracking-widest text-[#6b7688]',
    secondary: 'text-sm font-medium text-[#4a5568]',
    description: 'text-xs text-[#8e99a8]'
  },
  
  // Color Palette
  colors: {
    // Primary widget backgrounds
    violet: 'bg-gradient-to-br from-violet-500 to-violet-600',
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600', 
    green: 'bg-gradient-to-br from-green-500 to-green-600',
    orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
    teal: 'bg-gradient-to-br from-teal-500 to-teal-600',
    indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    
    // Status indicators
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-[#bb9e7b]',
    
    // Progress bars
    progressBg: 'bg-[#f5f0eb]',
    progressFill: {
      low: 'bg-red-400',
      medium: 'bg-amber-400', 
      high: 'bg-emerald-500',
      complete: 'bg-[#bb9e7b]',
      over: 'bg-purple-500'
    }
  },
  
  // Interactive States
  interactions: {
    hover: 'hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5',
    active: 'active:scale-[0.98] active:translate-y-0',
    transition: 'transition-all duration-200 ease-out',
    focus: 'focus:ring-2 focus:ring-[rgba(163,133,96,0.15)] focus:ring-offset-2'
  },
  
  // Shadows & Borders
  elevation: {
    card: 'shadow-sm border border-[#dbd6cf]/80',
    elevated: 'shadow-warm border border-[#dbd6cf]/60',
    floating: 'shadow-warm-lg border border-[#dbd6cf]/40'
  }
} as const

interface RefinedWidgetBaseProps {
  // Core props
  title: string
  icon: LucideIcon
  iconColor: keyof typeof WIDGET_DESIGN_TOKENS.colors
  
  // Primary metric
  primaryValue: string | number
  primaryUnit?: string
  
  // Secondary information
  secondaryValue?: string
  secondaryLabel?: string
  
  // Progress/Status
  progress?: number // 0-100
  progressColor?: keyof typeof WIDGET_DESIGN_TOKENS.colors.progressFill
  statusBadge?: {
    text: string
    variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  }
  
  // Interaction
  onClick?: () => void
  isLoading?: boolean
  
  // Customization
  className?: string
  size?: 'compact' | 'normal' | 'large'
  variant?: 'minimal' | 'detailed'
  
  // Additional content
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
    compact: { width: 'w-44', padding: WIDGET_DESIGN_TOKENS.spacing.sm },
    normal: { width: 'w-48', padding: WIDGET_DESIGN_TOKENS.spacing.sm },
    large: { width: 'w-56', padding: WIDGET_DESIGN_TOKENS.spacing.md }
  }
  
  const badgeVariants = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200', 
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-[#f5ede4] text-[#9a7b5a] border-[#dbd6cf]',
    neutral: 'bg-[#f5f0eb] text-[#314158] border-[#dbd6cf]'
  }

  if (isLoading) {
    return (
      <div className={cn(
        sizeConfig[size].width,
        'rounded-xl bg-white',
        WIDGET_DESIGN_TOKENS.elevation.card,
        sizeConfig[size].padding,
        'animate-pulse',
        className
      )}>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            'w-9 h-9 rounded-lg',
            WIDGET_DESIGN_TOKENS.colors[iconColor],
            'opacity-50'
          )} />
          <div className="h-4 bg-[#ebe5de] rounded flex-1" />
        </div>
        <div className="space-y-3">
          <div className="h-8 bg-[#ebe5de] rounded w-3/4" />
          {progress !== undefined && (
            <div className="h-2 bg-[#f5f0eb] rounded w-full" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        sizeConfig[size].width,
        'rounded-xl bg-white cursor-pointer group',
        WIDGET_DESIGN_TOKENS.elevation.card,
        WIDGET_DESIGN_TOKENS.interactions.transition,
        onClick && WIDGET_DESIGN_TOKENS.interactions.hover,
        onClick && WIDGET_DESIGN_TOKENS.interactions.focus,
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
        'bg-gradient-to-br from-[#fdf8f6]/50 to-[#faf8f5]/50'
      )} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shadow-sm',
              'transition-transform duration-200',
              isHovered && 'scale-105',
              WIDGET_DESIGN_TOKENS.colors[iconColor]
            )}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <span className={cn(
              WIDGET_DESIGN_TOKENS.typography.label,
              'transition-colors duration-200',
              isHovered && 'text-[#4a5568]'
            )}>
              {title}
            </span>
          </div>
          
          {statusBadge && (
            <span className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
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
            size === 'large' ? WIDGET_DESIGN_TOKENS.typography.metricLarge : WIDGET_DESIGN_TOKENS.typography.metric,
            'text-[#314158] transition-all duration-200',
            isHovered && 'text-[#314158]'
          )}>
            {primaryValue}
          </span>
          {primaryUnit && (
            <span className={cn(
              WIDGET_DESIGN_TOKENS.typography.unit,
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
              <span className="text-[#8e99a8]">{secondaryLabel}</span>
            )}
            {secondaryValue && (
              <span className="font-medium text-[#4a5568]">{secondaryValue}</span>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="space-y-1">
            <div className={cn(
              'w-full rounded-full h-2',
              WIDGET_DESIGN_TOKENS.colors.progressBg,
              'overflow-hidden'
            )}>
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-out',
                  WIDGET_DESIGN_TOKENS.colors.progressFill[progressColor],
                  'transform origin-left',
                  isHovered && 'scale-y-110'
                )}
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
            {variant === 'detailed' && (
              <div className="flex justify-between text-xs text-[#8e99a8]">
                <span>{Math.round(progress)}%</span>
                <span>Goal</span>
              </div>
            )}
          </div>
        )}

        {/* Additional Content */}
        {children && (
          <div className="mt-3 pt-3 border-t border-[#dbd6cf]">
            {children}
          </div>
        )}
      </div>

      {/* Interactive feedback */}
      {onClick && (
        <div className={cn(
          'absolute inset-0 opacity-0 group-active:opacity-10 transition-opacity duration-75',
          'bg-[#314158] pointer-events-none'
        )} />
      )}
    </div>
  )
}