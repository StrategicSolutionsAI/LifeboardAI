"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Scale, RefreshCw, AlertCircle, CheckCircle2, Clock, TrendingUp, TrendingDown, Bell, BellOff } from 'lucide-react'
import { useWithingsWeight } from '@/hooks/use-withings-weight'
import { useWeightNotifications } from '@/hooks/use-weight-notifications'
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
    return 'text-gray-600'
  }

  const getStatusIcon = () => {
    if (error || weightData?.error) return AlertCircle
    if (!isConnected) return AlertCircle
    if (hasData) return CheckCircle2
    return Clock
  }

  const StatusIcon = getStatusIcon()

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            WEIGHT
          </CardTitle>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="relative">
                <Bell className="w-4 h-4 text-blue-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">{unreadCount}</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className="p-1 hover:bg-gray-100 rounded"
              title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsEnabled ? (
                <Bell className="w-4 h-4 text-blue-600" />
              ) : (
                <BellOff className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <StatusIcon className={cn('w-4 h-4', getStatusColor())} />
            {isPolling && (
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Main Weight Display */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              {hasData && currentWeight ? (
                <>
                  <span className="text-2xl font-bold text-gray-900">
                    {currentWeight}
                  </span>
                  <span className="text-sm text-gray-500">{unit}</span>
                  {weightChange && (
                    <div className="flex items-center gap-1">
                      {weightChange > 0 ? (
                        <TrendingUp className="w-3 h-3 text-red-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-green-500" />
                      )}
                      <span className={cn(
                        'text-xs font-medium',
                        weightChange > 0 ? 'text-red-500' : 'text-green-500'
                      )}>
                        {weightChange > 0 ? '+' : ''}{Math.abs(weightChange).toFixed(1)}
                      </span>
                    </div>
                  )}
                </>
              ) : loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div>
                  <span className="text-sm text-gray-500">{unit}</span>
                </div>
              ) : (
                <span className="text-lg text-gray-400">No data</span>
              )}
            </div>

            {showControls && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs"
              >
                {showDetails ? 'Hide' : 'Details'}
              </Button>
            )}
          </div>

          {/* Progress to Goal */}
          {goalWeight && currentWeight && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progress to Goal</span>
                <span>{Math.abs(progressToGoal || 0).toFixed(1)} {unit} {progressToGoal && progressToGoal > 0 ? 'to go' : 'past goal'}</span>
              </div>
              {totalProgress !== null && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all duration-500',
                      totalProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${Math.min(Math.max(totalProgress, 0), 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {(error || weightData?.error) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-800">
                  {weightData?.error || error?.message || 'Failed to load weight data'}
                </span>
              </div>
            </div>
          )}

          {/* Details Panel */}
          {showDetails && (
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Status</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Polling</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant={isPolling ? 'default' : 'secondary'} className="text-xs">
                      {isPolling ? 'Active' : 'Stopped'}
                    </Badge>
                  </div>
                </div>
              </div>

              {lastFetchTime && (
                <div className="text-xs text-gray-500">
                  Last updated: {lastFetchTime.toLocaleTimeString()}
                </div>
              )}

              {nextFetchIn && (
                <div className="text-xs text-gray-500">
                  Next update in: {formatNextFetch(nextFetchIn)}
                </div>
              )}

              {showControls && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshNow}
                    disabled={loading}
                    className="text-xs"
                  >
                    <RefreshCw className={cn('w-3 h-3 mr-1', loading && 'animate-spin')} />
                    Refresh
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
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* Loading Overlay */}
      {loading && !hasData && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading weight data...
          </div>
        </div>
      )}
    </Card>
  )
}
