import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface WeightNotification {
  id: string
  type: 'new_weight' | 'goal_reached' | 'milestone' | 'trend_alert'
  title: string
  message: string
  weight?: number
  unit?: string
  timestamp: Date
  read: boolean
}

interface UseWeightNotificationsOptions {
  enableToasts?: boolean
  enableBrowserNotifications?: boolean
  goalWeight?: number
  unit?: 'kg' | 'lbs'
}

export function useWeightNotifications(options: UseWeightNotificationsOptions = {}) {
  const {
    enableToasts = true,
    enableBrowserNotifications = false,
    goalWeight,
    unit = 'lbs'
  } = options

  const [notifications, setNotifications] = useState<WeightNotification[]>([])
  const [hasPermission, setHasPermission] = useState(false)
  const { toast } = useToast()

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications')
      return false
    }

    const permission = await Notification.requestPermission()
    const granted = permission === 'granted'
    setHasPermission(granted)
    return granted
  }, [])

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted')
    }
  }, [])

  // Show notification
  const showNotification = useCallback((notification: Omit<WeightNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: WeightNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    }

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]) // Keep last 10

    // Show toast notification
    if (enableToasts) {
      toast({
        title: notification.title,
        description: notification.message,
      })
    }

    // Show browser notification
    if (enableBrowserNotifications && hasPermission) {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'weight-update',
        requireInteraction: false,
        silent: false
      })
    }

    return newNotification.id
  }, [enableToasts, enableBrowserNotifications, hasPermission, toast])

  // Handle new weight data
  const handleNewWeight = useCallback((currentWeight: number, previousWeight?: number) => {
    // New weight measurement notification
    showNotification({
      type: 'new_weight',
      title: 'New Weight Recorded',
      message: `Your weight has been updated to ${currentWeight} ${unit}`,
      weight: currentWeight,
      unit
    })

    // Check for goal achievement
    if (goalWeight && Math.abs(currentWeight - goalWeight) <= 0.5) {
      showNotification({
        type: 'goal_reached',
        title: '🎉 Goal Achieved!',
        message: `Congratulations! You've reached your goal weight of ${goalWeight} ${unit}`,
        weight: currentWeight,
        unit
      })
    }

    // Check for significant change
    if (previousWeight) {
      const change = currentWeight - previousWeight
      const absChange = Math.abs(change)
      
      if (absChange >= 2) { // 2+ unit change
        const direction = change > 0 ? 'gained' : 'lost'
        showNotification({
          type: 'trend_alert',
          title: 'Significant Weight Change',
          message: `You've ${direction} ${absChange.toFixed(1)} ${unit} since your last measurement`,
          weight: currentWeight,
          unit
        })
      }
    }

    // Check for milestones (every 5 units lost)
    if (previousWeight && currentWeight < previousWeight) {
      const totalLoss = previousWeight - currentWeight
      const milestoneReached = Math.floor(totalLoss / 5) > Math.floor((previousWeight - (previousWeight - 0.1)) / 5)
      
      if (milestoneReached) {
        const milestone = Math.floor(totalLoss / 5) * 5
        showNotification({
          type: 'milestone',
          title: '🏆 Milestone Reached!',
          message: `You've lost ${milestone} ${unit}! Keep up the great work!`,
          weight: currentWeight,
          unit
        })
      }
    }
  }, [goalWeight, unit, showNotification])

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    unreadCount,
    hasPermission,
    requestNotificationPermission,
    showNotification,
    handleNewWeight,
    markAsRead,
    clearAll
  }
}
