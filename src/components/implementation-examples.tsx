/**
 * Implementation Examples for Enhanced Refresh Button
 * 
 * This file contains practical examples of how to implement the enhanced refresh button
 * across different contexts in the LifeboardAI dashboard.
 */

import React from 'react'
import { EnhancedRefreshButton, RefreshButton } from './enhanced-refresh-button'

// Example 1: Global Integrations Page Header
export function IntegrationsHeaderExample() {
  const [loading, setLoading] = React.useState(false)
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null)
  
  const handleGlobalRefresh = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your favorite apps and services to sync data with LifeboardAI
        </p>
      </div>
      
      <RefreshButton.Global
        onRefresh={handleGlobalRefresh}
        isLoading={loading}
        lastRefreshTime={lastRefresh}
        ariaLabel="Refresh all integrations"
        successMessage="All integrations refreshed successfully"
      />
    </div>
  )
}

// Example 2: Individual Integration Card
export function IntegrationCardExample() {
  const [syncing, setSyncing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  
  const handleSyncData = async () => {
    setSyncing(true)
    setError(null)
    
    try {
      // Simulate API call with potential error
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() > 0.7) {
            reject(new Error('Sync failed'))
          } else {
            resolve(undefined)
          }
        }, 1500)
      })
    } catch (err) {
      setError('Failed to sync data. Please try again.')
    } finally {
      setSyncing(false)
    }
  }
  
  return (
    <div className="flex gap-2">
      <RefreshButton.Integration
        onRefresh={handleSyncData}
        isLoading={syncing}
        error={error}
        label="Sync Data"
        successMessage="Data synced successfully"
      />
      
      <button className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md">
        Disconnect
      </button>
    </div>
  )
}

// Example 3: Widget Header with Compact Refresh
export function WidgetHeaderExample() {
  const [refreshing, setRefreshing] = React.useState(false)
  const [progress, setProgress] = React.useState<number | undefined>()
  
  const handleWidgetRefresh = async () => {
    setRefreshing(true)
    setProgress(0)
    
    // Simulate progressive loading
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    setRefreshing(false)
    setProgress(undefined)
  }
  
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#f5ede4] rounded-lg flex items-center justify-center">
          📊
        </div>
        <h3 className="font-medium">Weight Tracking</h3>
      </div>
      
      <RefreshButton.Widget
        onRefresh={handleWidgetRefresh}
        isLoading={refreshing}
        progress={progress}
        ariaLabel="Refresh weight data"
      />
    </div>
  )
}

// Example 4: Dashboard Overview Refresh Card (replacing existing implementation)
export function DashboardRefreshCardExample() {
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [estimatedTime, setEstimatedTime] = React.useState<number | undefined>()
  
  const fetchIntegrationsData = async () => {
    setIsRefreshing(true)
    setEstimatedTime(15) // 15 seconds estimated
    
    // Countdown timer
    const timer = setInterval(() => {
      setEstimatedTime(prev => {
        if (!prev || prev <= 1) {
          clearInterval(timer)
          return undefined
        }
        return prev - 1
      })
    }, 1000)
    
    try {
      // Simulate the actual integration fetch
      await new Promise(resolve => setTimeout(resolve, 3000))
    } finally {
      clearInterval(timer)
      setIsRefreshing(false)
      setEstimatedTime(undefined)
    }
  }
  
  return (
    <div className="w-48 rounded-xl border border-[#dbd6cf] bg-white p-4 shadow-sm relative hover:bg-[#faf8f5] hover:shadow-warm transition-all">
      <EnhancedRefreshButton
        onRefresh={fetchIntegrationsData}
        variant="ghost"
        size="lg"
        compact={false}
        isLoading={isRefreshing}
        estimatedTime={estimatedTime}
        label="Refresh"
        className="w-full h-auto p-0 hover:bg-transparent"
      />
      <p className="mt-2 text-xs text-[#8e99a8]">Sync integrations</p>
    </div>
  )
}

// Example 5: Advanced Widget with Multiple States
export function AdvancedWidgetExample() {
  const [state, setState] = React.useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null)
  
  const handleAdvancedRefresh = async () => {
    setState('loading')
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      setState('success')
      setLastUpdate(new Date())
      
      // Reset to idle after showing success
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 5000)
    }
  }
  
  return (
    <div className="bg-white rounded-lg border border-[#dbd6cf] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Advanced Widget</h3>
        
        <EnhancedRefreshButton
          onRefresh={handleAdvancedRefresh}
          variant="tertiary"
          size="sm"
          isLoading={state === 'loading'}
          error={state === 'error' ? 'Refresh failed' : null}
          successMessage={state === 'success' ? 'Updated successfully' : undefined}
          lastRefreshTime={lastUpdate}
          showLastRefresh
          shortcut="w"
          ariaLabel="Refresh widget data (⌘W)"
        />
      </div>
      
      <div className="text-[#6b7688]">
        Widget content here...
      </div>
    </div>
  )
}

// Example 6: Replacing Taskboard Dashboard Refresh
export function TaskboardRefreshExample() {
  const [refreshing, setRefreshing] = React.useState(false)
  
  const fetchIntegrationsData = async () => {
    setRefreshing(true)
    try {
      // Your existing fetchIntegrationsData logic here
      await new Promise(resolve => setTimeout(resolve, 2000))
    } finally {
      setRefreshing(false)
    }
  }
  
  return (
    <div className="w-48 rounded-xl border border-[#dbd6cf] bg-white p-4 shadow-sm relative transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#bb9e7b]/90 shadow-sm">
          <EnhancedRefreshButton
            onRefresh={fetchIntegrationsData}
            variant="ghost"
            size="sm"
            compact
            isLoading={refreshing}
            className="text-white hover:bg-white/20 border-0"
          />
        </div>
        <span className="text-sm font-medium">Refresh</span>
      </div>
      <p className="text-xs text-[#8e99a8]">Sync integrations</p>
    </div>
  )
}