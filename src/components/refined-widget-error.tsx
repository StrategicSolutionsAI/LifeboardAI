"use client"

import React from 'react'
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { RefinedWidgetBase } from './refined-widget-base'
import { Button } from '@/components/ui/button'

interface WidgetErrorState {
  type: 'network' | 'api' | 'auth' | 'data' | 'unknown'
  title: string
  message: string
  isRetryable: boolean
  icon?: React.ComponentType<{ className?: string }>
}

interface RefinedWidgetErrorProps {
  error: WidgetErrorState
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

const errorConfigs: Record<string, Partial<WidgetErrorState>> = {
  network: {
    title: 'Connection Error',
    message: 'Unable to connect to server',
    icon: WifiOff,
    isRetryable: true
  },
  api: {
    title: 'Service Error', 
    message: 'Server temporarily unavailable',
    icon: AlertTriangle,
    isRetryable: true
  },
  auth: {
    title: 'Authentication Required',
    message: 'Please reconnect your account',
    icon: AlertTriangle,
    isRetryable: false
  },
  data: {
    title: 'Data Error',
    message: 'Invalid or corrupted data received',
    icon: AlertTriangle,
    isRetryable: true
  },
  unknown: {
    title: 'Unknown Error',
    message: 'Something unexpected happened',
    icon: AlertTriangle,
    isRetryable: true
  }
}

export function RefinedWidgetError({ 
  error, 
  onRetry, 
  onDismiss, 
  className 
}: RefinedWidgetErrorProps) {
  const config = { ...errorConfigs[error.type], ...error }
  const ErrorIcon = config.icon || AlertTriangle

  return (
    <RefinedWidgetBase
      title="Error"
      icon={ErrorIcon}
      iconColor="orange"
      primaryValue="—"
      statusBadge={{ text: 'Error', variant: 'danger' }}
      className={className}
      variant="minimal"
    >
      <div className="text-center space-y-3">
        <div>
          <div className="text-sm font-medium text-gray-900 mb-1">
            {config.title}
          </div>
          <div className="text-xs text-gray-600">
            {config.message}
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          {config.isRetryable && onRetry && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              className="text-xs relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95 group"
            >
              <RefreshCw className="w-3 h-3 mr-1 transition-transform duration-300 group-hover:rotate-180" />
              Retry
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </Button>
          )}
          
          {onDismiss && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDismiss}
              className="text-xs"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </RefinedWidgetBase>
  )
}

// Loading skeleton component
export function RefinedWidgetSkeleton({ 
  className,
  title = "Loading...",
  iconColor = "violet" as const
}: { 
  className?: string
  title?: string
  iconColor?: 'violet' | 'blue' | 'green' | 'orange' | 'teal' | 'indigo'
}) {
  return (
    <RefinedWidgetBase
      title={title}
      icon={RefreshCw}
      iconColor={iconColor}
      primaryValue="—"
      isLoading={true}
      className={className}
      variant="minimal"
    />
  )
}

// Empty state component
export function RefinedWidgetEmpty({ 
  title,
  icon,
  iconColor = "violet" as const,
  message = "No data available",
  actionLabel,
  onAction,
  className
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor?: 'violet' | 'blue' | 'green' | 'orange' | 'teal' | 'indigo'
  message?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <RefinedWidgetBase
      title={title}
      icon={icon}
      iconColor={iconColor}
      primaryValue="—"
      statusBadge={{ text: 'Empty', variant: 'neutral' }}
      className={className}
      variant="minimal"
    >
      <div className="text-center space-y-3">
        <div className="text-xs text-gray-500">
          {message}
        </div>
        
        {actionLabel && onAction && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAction}
            className="text-xs"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </RefinedWidgetBase>
  )
}