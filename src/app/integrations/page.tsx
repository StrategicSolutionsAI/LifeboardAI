export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import IntegrationsPageClient from './page.client'

export default function IntegrationsPage() {
  return <IntegrationsPageClient />
}

// Client implementation moved to page.client.tsx
/*
import { useState, useEffect, useCallback } from 'react'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// Using available UI components - Alert and Skeleton not available
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Activity
} from 'lucide-react'
import { invalidateIntegrationCaches } from '@/hooks/use-data-cache'
import SectionLoadTimer from '@/components/section-load-timer'

interface IntegrationStatus {
  connected: boolean
  lastUpdated?: string
  integrationId?: string
  message?: string
  error?: string
}

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  status?: IntegrationStatus
  authUrl?: string
}

const integrations: Integration[] = [
  {
    id: 'todoist',
    name: 'Todoist',
    description: 'Sync your tasks and projects from Todoist',
    icon: '📝',
    authUrl: '/api/integrations/todoist/auth'
  },
  {
    id: 'google',
    name: 'Google Calendar',
    description: 'View and manage your Google Calendar events',
    icon: '📅',
    authUrl: '/api/auth/google'
  },
  {
    id: 'google-fit',
    name: 'Google Fit',
    description: 'Connect to track your fitness activities and health metrics',
    icon: '🏃',
    authUrl: '/api/auth/googlefit'
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Track your fitness data and health metrics',
    icon: '⌚',
    authUrl: '/api/auth/fitbit'
  },
  {
    id: 'withings',
    name: 'Withings Smart Scale',
    description: 'Monitor your health data and body metrics',
    icon: '⚖️',
    authUrl: '/api/auth/withings?redirectUrl=/integrations'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications and manage tasks from Slack (Coming Soon)',
    icon: '💬'
    // authUrl: '/api/integrations/slack/auth' // TODO: Implement Slack integration
  }
]

export default function IntegrationsPage() {
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Keyboard shortcut for refresh (⌘R or Ctrl+R)
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'r' && !loading) {
        event.preventDefault()
        fetchIntegrationStatuses(true)
      }
    }

    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [loading])

  const fetchIntegrationStatuses = useCallback(async (invalidateCache = false) => {
    setLoading(true)
    setGlobalError(null)
    const statuses: Record<string, IntegrationStatus> = {}
    
    // If this is a manual refresh, invalidate all integration caches
    if (invalidateCache) {
      invalidateIntegrationCaches()
      console.log('🔄 Manual refresh - invalidated all integration caches')
    }
    
    try {
      const promises = integrations.map(async (integration) => {
        try {
          const response = await fetch(`/api/integrations/status?provider=${integration.id}`)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const data = await response.json()
          statuses[integration.id] = data
        } catch (error) {
          console.error(`Error fetching ${integration.id} status:`, error)
          statuses[integration.id] = { 
            connected: false, 
            error: `Unable to check status` 
          }
        }
      })
      
      await Promise.all(promises)
      setIntegrationStatuses(statuses)
    } catch (error) {
      console.error('Error fetching integration statuses:', error)
      setGlobalError('Unable to load integration statuses. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleConnect = async (integration: Integration) => {
    if (integration.authUrl) {
      // Redirect to OAuth flow
      window.location.href = integration.authUrl
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    setRefreshing(integrationId)
    
    // Clear previous messages
    setIntegrationStatuses(prev => ({
      ...prev,
      [integrationId]: { 
        ...prev[integrationId], 
        message: undefined,
        error: undefined
      }
    }))
    
    try {
      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: integrationId })
      })
      
      if (response.ok) {
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: { 
            connected: false, 
            message: 'Successfully disconnected',
            lastUpdated: new Date().toISOString()
          }
        }))
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setIntegrationStatuses(prev => ({
            ...prev,
            [integrationId]: { 
              ...prev[integrationId], 
              message: undefined 
            }
          }))
        }, 3000)
      } else {
        const errorData = await response.json()
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: { 
            ...prev[integrationId], 
            error: errorData.error || 'Failed to disconnect. Please try again.' 
          }
        }))
      }
    } catch (error) {
      console.error('Error disconnecting integration:', error)
      setIntegrationStatuses(prev => ({
        ...prev,
        [integrationId]: { 
          ...prev[integrationId], 
          error: 'Network error. Please check your connection.' 
        }
      }))
    } finally {
      setRefreshing(null)
    }
  }

  const fetchIntegrationData = async (integrationId: string) => {
    const today = new Date().toISOString().split('T')[0]
    let endpoint = ''
    let params = ''
    
    switch (integrationId) {
      case 'todoist':
        endpoint = '/api/integrations/todoist/tasks'
        params = `?date=${today}`
        break
      case 'withings':
        endpoint = '/api/integrations/withings/metrics'
        break
      case 'fitbit':
        endpoint = '/api/integrations/fitbit/metrics'
        params = `?date=${today}`
        break
      case 'google-fit':
        endpoint = '/api/integrations/googlefit/metrics'
        params = `?date=${today}`
        break
      case 'google':
        endpoint = '/api/integrations/google/calendar/events'
        params = `?date=${today}`
        break
      default:
        return null
    }
    
    try {
      const response = await fetch(`${endpoint}${params}`)
      if (response.ok) {
        return await response.json()
      }
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error(`Failed to fetch ${integrationId} data:`, error)
      return null
    }
  }

  const handleRefresh = async (integrationId: string) => {
    setRefreshing(integrationId)
    
    // Clear previous messages
    setIntegrationStatuses(prev => ({
      ...prev,
      [integrationId]: { 
        ...prev[integrationId], 
        message: undefined,
        error: undefined
      }
    }))
    
    try {
      // Fetch the actual data
      const dataResult = await fetchIntegrationData(integrationId)
      const dataFetched = dataResult !== null
      
      // Log results for debugging
      if (dataFetched) {
        const icon = integrations.find(i => i.id === integrationId)?.icon || '📊'
        console.log(`${icon} Data fetched for ${integrationId}:`, dataResult)
        
        // Invalidate cache for this integration so dashboard shows fresh data
        invalidateIntegrationCaches(integrationId)
        console.log(`🔄 Cache invalidated for ${integrationId} - dashboard will show fresh data`)
      }
      
      // Update integration status
      const statusResponse = await fetch(`/api/integrations/status?provider=${integrationId}`)
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: {
            ...statusData,
            lastUpdated: new Date().toISOString(),
            message: dataFetched 
              ? `Successfully refreshed` 
              : 'Status updated'
          }
        }))
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setIntegrationStatuses(prev => ({
            ...prev,
            [integrationId]: { 
              ...prev[integrationId], 
              message: undefined 
            }
          }))
        }, 3000)
      } else {
        throw new Error('Failed to update status')
      }
      
    } catch (error) {
      console.error('Error refreshing integration:', error)
      setIntegrationStatuses(prev => ({
        ...prev,
        [integrationId]: { 
          ...prev[integrationId], 
          error: 'Failed to refresh. Please try again.' 
        }
      }))
    } finally {
      setRefreshing(null)
    }
  }

  useEffect(() => {
    fetchIntegrationStatuses()
  }, [fetchIntegrationStatuses])

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Helper to get appropriate message style
  const getMessageStyle = (message: string, connected: boolean) => {
    if (!message) return ''
    
    const lowerMessage = message.toLowerCase()
    if (lowerMessage.includes('success') || lowerMessage.includes('refreshed')) {
      return 'text-green-600 font-medium'
    }
    if (lowerMessage.includes('fail') || lowerMessage.includes('error')) {
      return 'text-red-600 font-medium'
    }
    if (lowerMessage.includes('disconnect')) {
      return 'text-amber-600'
    }
    return 'text-muted-foreground'
  }

  if (loading) {
    return (
      <SidebarLayout>
        <SectionLoadTimer name="/integrations" />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Integrations</h1>
            <p className="text-muted-foreground">
              Connect your favorite apps and services to LifeboardAI
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                      <div>
                        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded animate-pulse" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <SectionLoadTimer name="/integrations" />
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Integrations</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchIntegrationStatuses(true)}
              disabled={loading}
              className="relative overflow-hidden transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 group focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
              aria-label={loading ? 'Refreshing all integrations...' : 'Refresh all integrations'}
              title={loading ? 'Currently refreshing all integrations' : 'Refresh data from all connected integrations (⌘R)'}
            >
              <RefreshCw 
                className={`h-4 w-4 mr-2 transition-transform duration-300 ${
                  loading ? 'animate-spin' : 'group-hover:rotate-180'
                }`}
                aria-hidden="true"
              />
              <span className="relative z-10">
                {loading ? 'Refreshing...' : 'Refresh All'}
              </span>
              {/* Screen reader only status */}
              <span className="sr-only">
                {loading ? 'Please wait while we refresh your integrations' : 'Click to refresh all integration data'}
              </span>
              {/* Subtle background animation on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </Button>
          </div>
          <p className="text-muted-foreground">
            Connect your favorite apps and services to sync data with LifeboardAI
          </p>
        </div>

        {globalError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <p className="text-red-700 mt-1">{globalError}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => {
            const status = integrationStatuses[integration.id]
            const isLoading = refreshing === integration.id
            const isComingSoon = !integration.authUrl

            return (
              <Card 
                key={integration.id} 
                className={`relative transition-all ${
                  isComingSoon ? 'opacity-60' : ''
                } ${isLoading ? 'scale-[0.99]' : ''}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-1">{integration.icon}</span>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {integration.name}
                          {isComingSoon && (
                            <Badge variant="secondary" className="text-xs">
                              Coming Soon
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {integration.description}
                        </CardDescription>
                      </div>
                    </div>
                    
                    {!isComingSoon && (
                      <div className="ml-2">
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : status?.connected ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>

                {!isComingSoon && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {status?.connected && status?.lastUpdated && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Last synced {formatRelativeTime(status.lastUpdated)}</span>
                        </div>
                      )}
                      
                      {status?.message && (
                        <p className={`text-sm ${getMessageStyle(status.message, status.connected)}`}>
                          {status.message}
                        </p>
                      )}
                      
                      {status?.error && (
                        <p className="text-sm text-red-600 font-medium">
                          {status.error}
                        </p>
                      )}

                      <div className="flex gap-2">
                        {status?.connected ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRefresh(integration.id)}
                              disabled={isLoading}
                              className="flex-1 relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-300 ${
                                isLoading ? 'animate-spin' : 'group-hover:rotate-180'
                              }`} />
                              <span className="relative z-10 text-xs font-medium">
                                {isLoading ? 'Syncing...' : 'Sync Data'}
                              </span>
                              {/* Success feedback for completed sync */}
                              {status?.message?.toLowerCase().includes('success') && (
                                <div className="absolute inset-0 bg-green-500/10 animate-pulse" />
                              )}
                              {/* Error feedback */}
                              {status?.error && (
                                <div className="absolute inset-0 bg-red-500/10" />
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDisconnect(integration.id)}
                              disabled={isLoading}
                            >
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => handleConnect(integration)}
                            disabled={isLoading}
                            className="w-full"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Connect {integration.name}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-sm text-blue-800">
            If you&apos;re having trouble connecting an integration, try refreshing the page or 
            disconnecting and reconnecting the service. Make sure you have the necessary 
            permissions enabled in your connected apps.
          </p>
        </div>
      </div>
    </SidebarLayout>
  )
}
*/
