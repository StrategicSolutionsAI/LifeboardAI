"use client"

import { useState, useEffect, useCallback } from 'react'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw, AlertCircle, Clock, Upload, Trash2 } from 'lucide-react'
import { invalidateIntegrationCaches, invalidateTaskCaches } from '@/hooks/use-data-cache'
import SectionLoadTimer from '@/components/section-load-timer'
import { CalendarFileUpload, type UploadResult } from '@/components/calendar-file-upload'

interface IntegrationStatus { connected: boolean; lastUpdated?: string; integrationId?: string; message?: string; error?: string }
interface Integration { id: string; name: string; description: string; icon: string; status?: IntegrationStatus; authUrl?: string }

interface CalendarImport {
  id: string;
  name: string;
  file_name?: string | null;
  event_count?: number | null;
  created_at?: string;
  updated_at?: string;
}

const integrations: Integration[] = [
  { id: 'todoist', name: 'Todoist', description: 'Sync your tasks and projects from Todoist', icon: '📝', authUrl: '/api/integrations/todoist/auth' },
  { id: 'google', name: 'Google Calendar', description: 'View and manage your Google Calendar events', icon: '📅', authUrl: '/api/auth/google?redirectUrl=/integrations' },
  { id: 'google-fit', name: 'Google Fit', description: 'Connect to track your fitness activities and health metrics', icon: '🏃', authUrl: '/api/auth/googlefit?redirectUrl=/integrations' },
  { id: 'fitbit', name: 'Fitbit', description: 'Track your fitness data and health metrics', icon: '⌚', authUrl: '/api/auth/fitbit?redirectUrl=/integrations' },
  { id: 'withings', name: 'Withings Smart Scale', description: 'Monitor your health data and body metrics', icon: '⚖️', authUrl: '/api/auth/withings?redirectUrl=/integrations' },
  { id: 'slack', name: 'Slack', description: 'Get notifications and manage tasks from Slack (Coming Soon)', icon: '💬' },
]

export default function IntegrationsPageClient() {
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [calendarImports, setCalendarImports] = useState<CalendarImport[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null)
  const [showCalendarUpload, setShowCalendarUpload] = useState(false)
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null)

  const fetchIntegrationStatuses = useCallback(async (invalidateCache = false) => {
    setLoading(true)
    setGlobalError(null)
    const statuses: Record<string, IntegrationStatus> = {}
    if (invalidateCache) invalidateIntegrationCaches()
    try {
      const promises = integrations.map(async (integration) => {
        try {
          const response = await fetch(`/api/integrations/status?provider=${integration.id}`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          statuses[integration.id] = data
        } catch (error) {
          statuses[integration.id] = { connected: false, error: `Unable to check status` }
        }
      })
      await Promise.all(promises)
      setIntegrationStatuses(statuses)
    } catch (error) {
      setGlobalError('Unable to load integration statuses. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCalendarImports = useCallback(async () => {
    setCalendarLoading(true)
    setCalendarError(null)
    try {
      const response = await fetch('/api/calendar/imports', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setCalendarImports(Array.isArray(data?.imports) ? data.imports : [])
    } catch (error) {
      console.error('Failed to load calendar imports', error)
      setCalendarError('Unable to load uploaded calendars. Please try again.')
    } finally {
      setCalendarLoading(false)
    }
  }, [])

  const handleDeleteImport = useCallback(async (importId: string) => {
    if (!importId) return
    const confirmed = window.confirm('Delete this uploaded calendar? All imported events and linked tasks will be removed.')
    if (!confirmed) return

    setDeletingImportId(importId)
    setCalendarMessage(null)
    setCalendarError(null)

    try {
      const response = await fetch('/api/calendar/imports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      invalidateTaskCaches()
      invalidateIntegrationCaches('calendar')
      setCalendarMessage('Calendar deleted successfully.')
      await fetchCalendarImports()
    } catch (error) {
      console.error('Failed to delete calendar import', error)
      setCalendarError('Failed to delete uploaded calendar. Please try again.')
    } finally {
      setDeletingImportId(null)
    }
  }, [fetchCalendarImports])

  const handleUploadComplete = useCallback((result: UploadResult) => {
    if (result.success) {
      setCalendarMessage(result.message || 'Calendar uploaded successfully.')
      setCalendarError(null)
      fetchCalendarImports()
      setShowCalendarUpload(false)
    } else {
      setCalendarError(result.message || 'Failed to upload calendar.')
    }
  }, [fetchCalendarImports])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'r' && !loading) {
        event.preventDefault()
        fetchIntegrationStatuses(true)
      }
    }
    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [loading, fetchIntegrationStatuses])

  const handleConnect = async (integration: Integration) => {
    if (integration.authUrl) window.location.href = integration.authUrl
  }

  const handleDisconnect = async (integrationId: string) => {
    setRefreshing(integrationId)
    setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], message: undefined, error: undefined } }))
    try {
      const response = await fetch('/api/integrations/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: integrationId }) })
      if (response.ok) {
        setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { connected: false, message: 'Successfully disconnected', lastUpdated: new Date().toISOString() } }))
        setTimeout(() => { setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], message: undefined } })) }, 3000)
      } else {
        const errorData = await response.json()
        setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], error: errorData.error || 'Failed to disconnect. Please try again.' } }))
      }
    } catch (error) {
      setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], error: 'Network error. Please check your connection.' } }))
    } finally { setRefreshing(null) }
  }

  const fetchIntegrationData = async (integrationId: string) => {
    const today = new Date().toISOString().split('T')[0]
    let endpoint = ''
    let params = ''
    switch (integrationId) {
      case 'todoist': endpoint = '/api/integrations/todoist/tasks'; params = `?date=${today}`; break
      case 'withings': endpoint = '/api/integrations/withings/metrics'; break
      case 'fitbit': endpoint = '/api/integrations/fitbit/metrics'; params = `?date=${today}`; break
      case 'google-fit': endpoint = '/api/integrations/googlefit/metrics'; params = `?date=${today}`; break
      case 'google': endpoint = '/api/integrations/google/calendar/events'; params = `?date=${today}`; break
      default: return null
    }
    try { const response = await fetch(`${endpoint}${params}`); if (response.ok) return await response.json(); throw new Error(`HTTP ${response.status}`) } catch { return null }
  }

  const handleRefresh = async (integrationId: string) => {
    setRefreshing(integrationId)
    setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], message: undefined, error: undefined } }))
    try {
      const dataResult = await fetchIntegrationData(integrationId)
      const dataFetched = dataResult !== null
      if (dataFetched) invalidateIntegrationCaches(integrationId)
      const statusResponse = await fetch(`/api/integrations/status?provider=${integrationId}`)
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...statusData, lastUpdated: new Date().toISOString(), message: dataFetched ? 'Successfully refreshed' : 'Status updated' } }))
        setTimeout(() => { setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], message: undefined } })) }, 3000)
      } else { throw new Error('Failed to update status') }
    } catch (error) {
      setIntegrationStatuses(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], error: 'Failed to refresh. Please try again.' } }))
    } finally { setRefreshing(null) }
  }

  useEffect(() => {
    fetchIntegrationStatuses()
    fetchCalendarImports()
  }, [fetchIntegrationStatuses, fetchCalendarImports])

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString); const now = new Date(); const diffMs = now.getTime() - date.getTime(); const diffMins = Math.floor(diffMs / 60000); const diffHours = Math.floor(diffMs / 3600000); const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now'; if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`; if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`; if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`; return date.toLocaleDateString()
  }

  const getMessageStyle = (message: string, connected: boolean) => {
    if (!message) return ''; const lower = message.toLowerCase(); if (lower.includes('success') || lower.includes('refreshed')) return 'text-green-600 font-medium'; if (lower.includes('fail') || lower.includes('error')) return 'text-red-600 font-medium'; if (lower.includes('disconnect')) return 'text-amber-600'; return 'text-muted-foreground'
  }

  if (loading) {
    return (
      <SidebarLayout>
        <SectionLoadTimer name="/integrations" />
        <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Integrations</h1>
            <p className="text-muted-foreground">Connect your favorite apps and services to LifeboardAI</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Card key={i}><CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-gray-200 rounded animate-pulse" /><div><div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" /><div className="h-4 w-48 bg-gray-200 rounded animate-pulse" /></div></div><div className="w-20 h-6 bg-gray-200 rounded animate-pulse" /></div></CardHeader><CardContent><div className="h-10 w-full bg-gray-200 rounded animate-pulse" /></CardContent></Card>
            ))}
          </div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <SectionLoadTimer name="/integrations" />
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Integrations</h1>
            <Button variant="outline" size="sm" onClick={() => fetchIntegrationStatuses(true)} disabled={loading} className="w-full sm:w-auto relative overflow-hidden transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 group focus:ring-2 focus:ring-primary/50 focus:ring-offset-2" aria-label={loading ? 'Refreshing all integrations...' : 'Refresh all integrations'} title={loading ? 'Currently refreshing all integrations' : 'Refresh data from all connected integrations (⌘R)'}>
              <RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-300 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} aria-hidden="true" />
              <span className="relative z-10">{loading ? 'Refreshing...' : 'Refresh All'}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </Button>
          </div>
          <p className="text-muted-foreground">Connect your favorite apps and services to sync data with LifeboardAI</p>
        </div>

        {globalError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600" /><span className="text-red-800 font-medium">Error</span></div>
            <p className="text-red-700 mt-1">{globalError}</p>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Uploaded Calendars</CardTitle>
              <CardDescription className="mt-1">Import ICS files and manage manual calendars alongside your integrations.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalendarUpload(prev => !prev)}
              className="w-full sm:w-auto"
            >
              {showCalendarUpload ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Close uploader
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload calendar
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {calendarMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {calendarMessage}
              </div>
            )}
            {calendarError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {calendarError}
              </div>
            )}
            {calendarLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading uploaded calendars...
              </div>
            ) : calendarImports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No calendars uploaded yet. Upload an .ics file to populate the calendar without connecting an integration.
              </p>
            ) : (
              <div className="space-y-3">
                {calendarImports.map((calendar) => {
                  const timestamp = calendar.updated_at || calendar.created_at;
                  const eventCount = typeof calendar.event_count === 'number' ? calendar.event_count : 0;
                  return (
                    <div
                      key={calendar.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{calendar.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {eventCount} event{eventCount === 1 ? '' : 's'}
                          {timestamp ? ` • Updated ${formatRelativeTime(timestamp)}` : ''}
                          {calendar.file_name ? ` • ${calendar.file_name}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteImport(calendar.id)}
                        disabled={deletingImportId === calendar.id}
                        className="w-full sm:w-auto"
                      >
                        {deletingImportId === calendar.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {showCalendarUpload && (
          <div className="mb-6">
            <CalendarFileUpload
              onUploadComplete={handleUploadComplete}
              onClose={() => setShowCalendarUpload(false)}
            />
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {integrations.map((integration) => {
            const status = integrationStatuses[integration.id]
            const isLoading = refreshing === integration.id
            const isComingSoon = !integration.authUrl
            return (
              <Card key={integration.id} className={`relative transition-all ${isComingSoon ? 'opacity-60' : ''} ${isLoading ? 'scale-[0.99]' : ''}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-1">{integration.icon}</span>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">{integration.name}{isComingSoon && (<Badge variant="secondary" className="text-xs">Coming Soon</Badge>)}</CardTitle>
                        <CardDescription className="mt-1">{integration.description}</CardDescription>
                      </div>
                    </div>
                    {!isComingSoon && (
                      <div className="ml-2">
                        {isLoading ? (<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />) : status?.connected ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                {!isComingSoon && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {status?.connected && status?.lastUpdated && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-3 w-3" /><span>Last synced {formatRelativeTime(status.lastUpdated)}</span></div>
                      )}
                      {status?.message && (<p className={`text-sm ${getMessageStyle(status.message, status.connected)}`}>{status.message}</p>)}
                      {status?.error && (<p className="text-sm text-red-600 font-medium">{status.error}</p>)}
                      <div className="flex gap-2">
                        {status?.connected ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleRefresh(integration.id)} disabled={isLoading} className="flex-1 relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-60 disabled:cursor-not-allowed">
                              <RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-300 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                              <span className="relative z-10 text-xs font-medium">{isLoading ? 'Syncing...' : 'Sync Data'}</span>
                              {status?.message?.toLowerCase().includes('success') && (<div className="absolute inset-0 bg-green-500/10 animate-pulse" />)}
                              {status?.error && (<div className="absolute inset-0 bg-red-500/10" />)}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDisconnect(integration.id)} disabled={isLoading}>Disconnect</Button>
                          </>
                        ) : (
                          <Button onClick={() => handleConnect(integration)} disabled={isLoading} className="w-full"><ExternalLink className="h-4 w-4 mr-2" />Connect {integration.name}</Button>
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
          <p className="text-sm text-blue-800">If you're having trouble connecting an integration, try refreshing the page or disconnecting and reconnecting the service. Make sure you have the necessary permissions enabled in your connected apps.</p>
        </div>
      </div>
    </SidebarLayout>
  )
}
