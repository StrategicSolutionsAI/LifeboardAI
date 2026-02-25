"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Scale, RefreshCw, AlertCircle, CheckCircle2, Clock, TrendingUp, TrendingDown, Bell, BellOff } from 'lucide-react'
import { useWithingsWeight } from '@/hooks/use-withings-weight'
import { useWeightNotifications } from '@/hooks/use-weight-notifications'
import { RefinedWidgetBase } from './refined-widget-base'
import { cn } from '@/lib/utils'

interface WithingsWeightWidgetProps {
  className?: string
  showControls?: boolean
  unit?: 'kg' | 'lbs'
  goalWeight?: number
  startingWeight?: number
  onWeightUpdate?: (weight: number) => void
}

export function WithingsWeightWidget({
  className,
  showControls = true,
  unit = 'lbs',
  goalWeight,
  startingWeight,
  onWeightUpdate
}: WithingsWeightWidgetProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [previousWeight, setPreviousWeight] = useState<number | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Notification system
  const notifications = useWeightNotifications({
    enableToasts: notificationsEnabled,
    enableBrowserNotifications: notificationsEnabled,
    goalWeight,
    unit
  })
  
  const {
    notifications: notificationList,
    unreadCount,
    hasPermission,
    requestNotificationPermission,
    handleNewWeight,
    markAsRead,
    clearAll
  } = notifications

  const {
    weightData,
    loading,
    error,
    lastFetchTime,
    isPolling,
    startPolling,
    stopPolling,
    refreshNow,
    isConnected,
    hasData,
    nextFetchIn
  } = useWithingsWeight({
    pollingInterval: 5 * 60 * 1000, // 5 minutes
    autoStart: true,
    onNewData: (data) => {
      // Notify parent component of weight update
      const weight = unit === 'kg' ? data.weightKg : data.weightLbs
      onWeightUpdate?.(weight)
      
      // Store previous weight for trend indication and trigger notifications
      if (weightData) {
        const prevWeight = unit === 'kg' ? weightData.weightKg : weightData.weightLbs
        setPreviousWeight(prevWeight)
        
        // Trigger notifications for new weight
        if (notificationsEnabled) {
          handleNewWeight(weight, prevWeight)
        }
      } else if (notificationsEnabled) {
        // First time weight data
        handleNewWeight(weight)
      }
    }
  })

  // Format next fetch time
  const formatNextFetch = (ms: number | null) => {
    if (!ms) return null
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate weight change and trend
  const currentWeight = weightData ? (unit === 'kg' ? weightData.weightKg : weightData.weightLbs) : null
  const weightChange = currentWeight && previousWeight ? currentWeight - previousWeight : null
  const progressToGoal = currentWeight && goalWeight ? goalWeight - currentWeight : null
  const totalProgress = currentWeight && startingWeight && goalWeight 
    ? ((startingWeight - currentWeight) / (startingWeight - goalWeight)) * 100 
    : null

  const getStatusColor = () => {
    if (error || weightData?.error) return 'text-red-600'
    if (!isConnected) return 'text-yellow-600'
    if (hasData) return 'text-green-600'
    return 'text-[#6b7688]'
  }

  const getStatusIcon = () => {
    if (error || weightData?.error) return AlertCircle
    if (!isConnected) return AlertCircle
    if (hasData) return CheckCircle2
    return Clock
  }

  const StatusIcon = getStatusIcon()

  // Calculate progress towards goal
  const goalProgress = goalWeight && currentWeight && startingWeight 
    ? ((startingWeight - currentWeight) / (startingWeight - goalWeight)) * 100 
    : undefined

  // Determine status badge
  const getStatusBadge = () => {
    if (!hasData) return { text: 'No Data', variant: 'neutral' as const }
    if (!isConnected) return { text: 'Offline', variant: 'warning' as const }
    if (error) return { text: 'Error', variant: 'danger' as const }
    if (goalProgress && goalProgress >= 100) return { text: 'Goal Reached!', variant: 'success' as const }
    if (goalProgress && goalProgress >= 75) return { text: 'Almost There', variant: 'info' as const }
    return undefined
  }

  // Weight change indicator
  const weightChangeDisplay = weightChange ? (
    <div className="flex items-center gap-1 text-xs">
      {weightChange > 0 ? (
        <>
          <TrendingUp className="w-3 h-3 text-red-500" />
          <span className="text-red-500 font-medium">+{Math.abs(weightChange).toFixed(1)} {unit}</span>
        </>
      ) : (
        <>
          <TrendingDown className="w-3 h-3 text-green-500" />
          <span className="text-green-500 font-medium">-{Math.abs(weightChange).toFixed(1)} {unit}</span>
        </>
      )}
    </div>
  ) : null

  return (
    <RefinedWidgetBase
      title="Weight Tracking"
      icon={Scale}
      iconColor="violet"
      primaryValue={hasData && currentWeight ? currentWeight.toString() : "No data"}
      primaryUnit={hasData && currentWeight ? unit : undefined}
      secondaryLabel={goalProgress ? "Progress to Goal" : undefined}
      secondaryValue={goalProgress ? `${Math.round(goalProgress)}%` : undefined}
      progress={goalProgress}
      progressColor={
        goalProgress && goalProgress >= 100 ? 'complete' :
        goalProgress && goalProgress >= 75 ? 'high' :
        goalProgress && goalProgress >= 25 ? 'medium' : 'low'
      }
      statusBadge={getStatusBadge()}
      isLoading={loading}
      className={className}
      size={showControls ? "large" : "normal"}
      variant={showControls ? "detailed" : "minimal"}
    >
      {/* Weight change indicator */}
      {weightChangeDisplay && (
        <div className="flex justify-center">
          {weightChangeDisplay}
        </div>
      )}

      {/* Goal information */}
      {goalWeight && hasData && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[#8e99a8]">Current</span>
            <span className="font-semibold">{currentWeight} {unit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8e99a8]">Goal</span>
            <span className="font-semibold">{goalWeight} {unit}</span>
          </div>
          {progressToGoal && (
            <div className="flex justify-between">
              <span className="text-[#8e99a8]">To Goal</span>
              <span className="font-semibold text-warm-600">{Math.abs(progressToGoal).toFixed(1)} {unit}</span>
            </div>
          )}
        </div>
      )}

      {/* Notification controls */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between p-2 bg-warm-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-warm-600" />
            <span className="text-xs text-warm-800">{unreadCount} new notification{unreadCount !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="text-xs text-warm-600 hover:text-warm-800 font-medium"
          >
            {notificationsEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      )}

      {/* Advanced controls for detailed view */}
      {showControls && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshNow}
              disabled={loading}
              className="flex-1 text-xs relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95 group disabled:opacity-60"
            >
              <RefreshCw className={cn(
                'w-3 h-3 mr-1 transition-transform duration-300',
                loading ? 'animate-spin' : 'group-hover:rotate-180'
              )} />
              <span className="relative z-10 font-medium">
                {loading ? 'Refreshing...' : 'Refresh'}
              </span>
              {!loading && hasData && (
                <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}
              {error && (
                <div className="absolute inset-0 bg-red-500/10" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={isPolling ? stopPolling : startPolling}
              className="text-xs"
            >
              {isPolling ? 'Stop' : 'Start'} Auto-Update
            </Button>
          </div>
          
          {lastFetchTime && (
            <div className="text-xs text-[#8e99a8] text-center">
              Last updated: {lastFetchTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </RefinedWidgetBase>
  )
}
