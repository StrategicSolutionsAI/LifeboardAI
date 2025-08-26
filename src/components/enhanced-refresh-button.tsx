"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Loader2 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RefreshButtonProps {
  /** The function to call when refresh is triggered */
  onRefresh: () => Promise<void> | void
  
  /** Button variant for different contexts */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost'
  
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  
  /** Loading state controlled externally */
  isLoading?: boolean
  
  /** Last refresh timestamp */
  lastRefreshTime?: Date | null
  
  /** Show progress for determinate operations */
  progress?: number
  
  /** Estimated time remaining in seconds */
  estimatedTime?: number
  
  /** Error state */
  error?: string | null
  
  /** Success message */
  successMessage?: string
  
  /** Custom refresh label */
  label?: string
  
  /** Show timestamp of last refresh */
  showLastRefresh?: boolean
  
  /** Compact mode for tight spaces */
  compact?: boolean
  
  /** Disable the button */
  disabled?: boolean
  
  /** Additional CSS classes */
  className?: string
  
  /** Accessibility label */
  ariaLabel?: string
  
  /** Keyboard shortcut */
  shortcut?: string
}

export function EnhancedRefreshButton({
  onRefresh,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  lastRefreshTime,
  progress,
  estimatedTime,
  error,
  successMessage,
  label,
  showLastRefresh = false,
  compact = false,
  disabled = false,
  className,
  ariaLabel,
  shortcut
}: RefreshButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)

  // Handle the loading state (external or internal)
  const loading = isLoading || internalLoading

  // Format relative time
  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  // Handle refresh click
  const handleRefresh = async () => {
    if (loading || disabled) return
    
    try {
      setInternalLoading(true)
      setShowError(false)
      setShowSuccess(false)
      
      await onRefresh()
      
      // Show success state briefly
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
      
    } catch (err) {
      setShowError(true)
      setTimeout(() => setShowError(false), 4000)
    } finally {
      setInternalLoading(false)
    }
  }

  // Keyboard shortcut handler
  useEffect(() => {
    if (!shortcut) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === shortcut.toLowerCase()) {
        e.preventDefault()
        handleRefresh()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcut, handleRefresh])

  // Get button variant classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-theme-primary hover:bg-theme-primary-dark text-white shadow-sm hover:shadow-md'
      case 'secondary':
        return 'border border-theme-gray-300 bg-white hover:bg-theme-gray-50 text-theme-gray-700'
      case 'tertiary':
        return 'text-theme-primary hover:text-theme-primary-dark hover:bg-theme-primary/5'
      case 'ghost':
        return 'text-theme-gray-500 hover:text-theme-gray-700 hover:bg-theme-gray-100'
      default:
        return 'border border-theme-gray-300 bg-white hover:bg-theme-gray-50 text-theme-gray-700'
    }
  }

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return compact ? 'h-8 w-8' : 'h-8 px-3 text-sm'
      case 'lg':
        return compact ? 'h-12 w-12' : 'h-12 px-6 text-lg'
      default:
        return compact ? 'h-10 w-10' : 'h-10 px-4'
    }
  }

  // Get icon size
  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4'
      case 'lg': return 'w-6 h-6'
      default: return 'w-5 h-5'
    }
  }

  // Determine which icon to show
  const getIcon = () => {
    if (showSuccess) return CheckCircle2
    if (showError || error) return AlertCircle
    if (loading) return Loader2
    return RefreshCw
  }

  const Icon = getIcon()
  const buttonLabel = label || 'Refresh'
  const fullAriaLabel = ariaLabel || `${buttonLabel}${shortcut ? ` (⌘${shortcut})` : ''}`

  return (
    <div className={cn('relative', className)}>
      <Button
        onClick={handleRefresh}
        disabled={disabled || loading}
        aria-label={fullAriaLabel}
        className={cn(
          // Base styles
          'relative overflow-hidden transition-all duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          
          // Variant and size classes
          getVariantClasses(),
          getSizeClasses(),
          
          // Interactive effects
          'hover:scale-[1.02] active:scale-[0.98]',
          'hover:shadow-lg hover:-translate-y-0.5',
          
          // State-specific styles
          {
            'animate-pulse': loading && !progress,
            'border-green-300 bg-green-50 text-green-700': showSuccess,
            'border-red-300 bg-red-50 text-red-700': showError || error,
          }
        )}
      >
        {/* Progress bar overlay */}
        {progress !== undefined && (
          <div 
            className="absolute inset-0 bg-theme-primary/10 transition-all duration-300"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        )}
        
        {/* Button content */}
        <div className="relative flex items-center justify-center gap-2">
          <Icon 
            className={cn(
              getIconSize(),
              'transition-transform duration-200',
              {
                'animate-spin': loading,
                'text-green-600': showSuccess,
                'text-red-600': showError || error,
                'hover:rotate-45': !loading && !showSuccess && !showError
              }
            )}
          />
          
          {!compact && (
            <span className="font-medium">
              {loading ? 'Refreshing...' : buttonLabel}
            </span>
          )}
          
          {estimatedTime && loading && (
            <Badge variant="secondary" className="text-xs">
              {estimatedTime}s
            </Badge>
          )}
        </div>
        
        {/* Hover effect overlay */}
        <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      </Button>
      
      {/* Last refresh time */}
      {showLastRefresh && lastRefreshTime && !compact && (
        <div className="absolute -bottom-6 left-0 text-xs text-theme-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Last updated {getRelativeTime(lastRefreshTime)}</span>
        </div>
      )}
      
      {/* Error tooltip */}
      {error && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-red-900 text-white text-sm rounded-md shadow-lg z-10 whitespace-nowrap">
          {error}
        </div>
      )}
      
      {/* Success message */}
      {successMessage && showSuccess && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-green-900 text-white text-sm rounded-md shadow-lg z-10 whitespace-nowrap">
          {successMessage}
        </div>
      )}
    </div>
  )
}

// Preset configurations for common use cases
export const RefreshButton = {
  // Global dashboard refresh
  Global: (props: RefreshButtonProps) => (
    <EnhancedRefreshButton
      variant="primary"
      size="lg"
      label="Refresh All"
      showLastRefresh
      shortcut="r"
      {...props}
    />
  ),
  
  // Integration section refresh
  Integration: (props: RefreshButtonProps & { variant?: 'secondary'; size?: 'md' }) => (
    <EnhancedRefreshButton
      variant="secondary"
      size="md"
      label="Sync Data"
      {...props}
    />
  ),
  
  // Widget-level refresh
  Widget: (props: RefreshButtonProps & { variant?: 'ghost'; size?: 'sm' }) => (
    <EnhancedRefreshButton
      variant="ghost"
      size="sm"
      compact
      {...props}
    />
  ),
  
  // Minimal refresh for tight spaces
  Minimal: (props: RefreshButtonProps & { variant?: 'ghost'; size?: 'sm' }) => (
    <EnhancedRefreshButton
      variant="ghost"
      size="sm"
      compact
      {...props}
    />
  )
}