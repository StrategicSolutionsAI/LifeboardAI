'use client'

import { useState, useEffect } from 'react'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'

interface IntegrationStatus {
  connected: boolean
  lastUpdated?: string
  integrationId?: string
  message?: string
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

  const fetchIntegrationStatuses = async () => {
    setLoading(true)
    const statuses: Record<string, IntegrationStatus> = {}
    
    for (const integration of integrations) {
      try {
        const response = await fetch(`/api/integrations/status?provider=${integration.id}`)
        const data = await response.json()
        statuses[integration.id] = data
      } catch (error) {
        console.error(`Error fetching ${integration.id} status:`, error)
        statuses[integration.id] = { connected: false, message: 'Error fetching status' }
      }
    }
    
    setIntegrationStatuses(statuses)
    setLoading(false)
  }

  const handleConnect = async (integration: Integration) => {
    if (integration.authUrl) {
      // Redirect to OAuth flow
      window.location.href = integration.authUrl
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    console.log('🔴 Disconnect button clicked for:', integrationId)
    setRefreshing(integrationId)
    try {
      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: integrationId })
      })
      
      if (response.ok) {
        // Update the status locally instead of refetching all statuses
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: { connected: false, message: 'Disconnected successfully' }
        }))
      } else {
        // If disconnect failed, show error message
        const errorData = await response.json()
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: { 
            ...prev[integrationId], 
            message: errorData.error || 'Failed to disconnect' 
          }
        }))
      }
    } catch (error) {
      console.error('Error disconnecting integration:', error)
      // Update status to show error
      setIntegrationStatuses(prev => ({
        ...prev,
        [integrationId]: { 
          ...prev[integrationId], 
          message: 'Error disconnecting integration' 
        }
      }))
    } finally {
      setRefreshing(null)
    }
  }

  const handleRefresh = async (integrationId: string) => {
    console.log('🔄 Refresh button clicked for:', integrationId)
    setRefreshing(integrationId)
    
    try {
      let dataFetched = false
      let dataResult = null
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      
      // Fetch today's data based on integration type
      switch (integrationId) {
        case 'todoist':
          console.log('📝 Fetching today\'s Todoist tasks...')
          try {
            const tasksResponse = await fetch(`/api/integrations/todoist/tasks?date=${dateStr}`)
            if (tasksResponse.ok) {
              dataResult = await tasksResponse.json()
              console.log('📝 Todoist tasks fetched:', dataResult?.tasks?.length || 0, 'tasks')
              dataFetched = true
            }
          } catch (error) {
            console.error('Failed to fetch Todoist tasks:', error)
          }
          break
          
        case 'withings':
          console.log('⚖️ Fetching latest Withings weight data...')
          try {
            const metricsResponse = await fetch('/api/integrations/withings/metrics')
            if (metricsResponse.ok) {
              dataResult = await metricsResponse.json()
              console.log('⚖️ Withings data fetched:', dataResult?.weight ? `${dataResult.weight} kg` : 'No recent data')
              dataFetched = true
            }
          } catch (error) {
            console.error('Failed to fetch Withings data:', error)
          }
          break
          
        case 'fitbit':
          console.log('⏱️ Fetching today\'s Fitbit data...')
          try {
            const metricsResponse = await fetch(`/api/integrations/fitbit/metrics?date=${dateStr}`)
            if (metricsResponse.ok) {
              dataResult = await metricsResponse.json()
              console.log('⏱️ Fitbit data fetched:', {
                steps: dataResult?.steps || 0,
                calories: dataResult?.calories || 0,
                distance: dataResult?.distance || 0
              })
              dataFetched = true
            }
          } catch (error) {
            console.error('Failed to fetch Fitbit data:', error)
          }
          break
          
        case 'google-fit':
          console.log('🏃 Fetching today\'s Google Fit data...')
          try {
            const metricsResponse = await fetch(`/api/integrations/googlefit/metrics?date=${dateStr}`)
            if (metricsResponse.ok) {
              dataResult = await metricsResponse.json()
              console.log('🏃 Google Fit data fetched:', {
                steps: dataResult?.steps || 0
              })
              dataFetched = true
            }
          } catch (error) {
            console.error('Failed to fetch Google Fit data:', error)
          }
          break
          
        case 'google':
          console.log('📅 Fetching today\'s Google Calendar events...')
          try {
            const eventsResponse = await fetch(`/api/integrations/google/calendar/events?date=${dateStr}`)
            if (eventsResponse.ok) {
              dataResult = await eventsResponse.json()
              console.log('📅 Google Calendar events fetched:', dataResult?.events?.length || 0, 'events')
              dataFetched = true
            }
          } catch (error) {
            console.error('Failed to fetch Google Calendar events:', error)
          }
          break
          
        default:
          console.log('ℹ️ No specific data endpoint for:', integrationId)
      }
      
      // Always refresh the integration status to update the "last updated" timestamp
      console.log('📋 Updating integration status for:', integrationId)
      const statusResponse = await fetch(`/api/integrations/status?provider=${integrationId}`)
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        
        // Update the status with success message if data was fetched
        const updatedStatus = {
          ...statusData,
          lastUpdated: new Date().toISOString(),
          message: dataFetched 
            ? `Data refreshed successfully at ${new Date().toLocaleTimeString()}`
            : statusData.message
        }
        
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: updatedStatus
        }))
        
        console.log('✅ Refresh completed for:', integrationId, { dataFetched, hasData: !!dataResult })
      } else {
        throw new Error('Failed to update integration status')
      }
      
    } catch (error) {
      console.error('Error refreshing integration:', error)
      setIntegrationStatuses(prev => ({
        ...prev,
        [integrationId]: { 
          ...prev[integrationId], 
          message: `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }
      }))
    } finally {
      setRefreshing(null)
    }
  }

  useEffect(() => {
    fetchIntegrationStatuses()
  }, [])

  return (
    <SidebarLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Connect your favorite apps and services to LifeboardAI
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => {
            const status = integrationStatuses[integration.id]
            const isLoading = refreshing === integration.id

            return (
              <Card key={integration.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription>{integration.description}</CardDescription>
                      </div>
                    </div>
                    
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : status?.connected ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        Disconnected
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {status?.lastUpdated && (
                      <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(status.lastUpdated).toLocaleDateString()}
                      </p>
                    )}
                    
                    {status?.message && (
                      <p className={`text-sm ${
                        status.connected 
                          ? status.message.includes('successfully') 
                            ? 'text-green-600' 
                            : status.message.includes('failed') || status.message.includes('error')
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                          : 'text-red-600'
                      }`}>
                        {status.message}
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
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
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
                          disabled={isLoading || !integration.authUrl}
                          className="w-full"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Connect {integration.name}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
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
