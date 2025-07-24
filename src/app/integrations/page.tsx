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
    setRefreshing(integrationId)
    try {
      // Refresh the specific integration
      const response = await fetch(`/api/integrations/status?provider=${integrationId}`)
      if (response.ok) {
        const data = await response.json()
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: data
        }))
      } else {
        // Handle refresh error
        setIntegrationStatuses(prev => ({
          ...prev,
          [integrationId]: { 
            ...prev[integrationId], 
            message: 'Failed to refresh status' 
          }
        }))
      }
    } catch (error) {
      console.error('Error refreshing integration:', error)
      setIntegrationStatuses(prev => ({
        ...prev,
        [integrationId]: { 
          ...prev[integrationId], 
          message: 'Error refreshing integration' 
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
                    
                    {status?.message && !status.connected && (
                      <p className="text-sm text-red-600">{status.message}</p>
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
            If you're having trouble connecting an integration, try refreshing the page or 
            disconnecting and reconnecting the service. Make sure you have the necessary 
            permissions enabled in your connected apps.
          </p>
        </div>
      </div>
    </SidebarLayout>
  )
}
