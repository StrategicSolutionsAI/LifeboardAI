"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WithingsWeightWidget } from './withings-weight-widget'
import { useGlobalCache } from '@/hooks/use-data-cache'
import { TrendingUp, TrendingDown, Target, Calendar, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeightMeasurement {
  id: string
  weightKg: number
  weightLbs: number
  measuredAt: string
  source: string
  createdAt: string
}

interface WeightStats {
  count: number
  latest: number | null
  earliest: number | null
  min: number | null
  max: number | null
  average: number | null
  change: number | null
}

interface WeightHistoryData {
  measurements: WeightMeasurement[]
  stats: WeightStats
  period: {
    days: number
    startDate: string
    endDate: string
  }
}

interface WeightTrackingDashboardProps {
  className?: string
  unit?: 'kg' | 'lbs'
  goalWeight?: number
  startingWeight?: number
}

export function WeightTrackingDashboard({
  className,
  unit = 'lbs',
  goalWeight = 145,
  startingWeight = 155
}: WeightTrackingDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)

  // Fetch weight history
  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory
  } = useGlobalCache<WeightHistoryData>(
    `weight-history-${selectedPeriod}`,
    async () => {
      const response = await fetch(`/api/integrations/withings/history?days=${selectedPeriod}&limit=100`)
      if (!response.ok) {
        throw new Error('Failed to fetch weight history')
      }
      return response.json()
    },
    { ttl: 5 * 60 * 1000 } // 5 minutes cache
  )

  // Calculate progress metrics
  const progressToGoal = currentWeight && goalWeight ? goalWeight - currentWeight : null
  const totalProgress = currentWeight && startingWeight && goalWeight 
    ? ((startingWeight - currentWeight) / (startingWeight - goalWeight)) * 100 
    : null
  const weightChange = historyData?.stats.change || null

  // Format weight for display
  const formatWeight = (weight: number | null) => {
    if (!weight) return '--'
    return unit === 'kg' ? `${weight.toFixed(1)} kg` : `${(weight * 2.20462).toFixed(1)} lbs`
  }

  // Get trend indicator
  const getTrendIndicator = (change: number | null) => {
    if (!change) return null
    if (change > 0) return { icon: TrendingUp, color: 'text-red-500', text: 'increasing' }
    if (change < 0) return { icon: TrendingDown, color: 'text-green-500', text: 'decreasing' }
    return null
  }

  const trend = getTrendIndicator(weightChange)

  // Period options
  const periodOptions = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 365, label: '1 year' }
  ]

  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Weight Widget */}
      <WithingsWeightWidget
        className="w-full"
        showControls={true}
        unit={unit}
        goalWeight={goalWeight}
        startingWeight={startingWeight}
        onWeightUpdate={(weight) => {
          setCurrentWeight(weight)
          // Refresh history when new weight is recorded
          refetchHistory()
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current Weight */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Current Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatWeight(currentWeight || historyData?.stats.latest || null)}
            </div>
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <trend.icon className={cn('w-3 h-3', trend.color)} />
                <span className={cn('text-xs', trend.color)}>
                  {trend.text}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Target className="w-4 h-4" />
              Goal Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {totalProgress !== null ? `${Math.round(totalProgress)}%` : '--'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {progressToGoal !== null 
                ? `${Math.abs(progressToGoal).toFixed(1)} ${unit} ${progressToGoal > 0 ? 'to go' : 'past goal'}`
                : 'No goal set'
              }
            </div>
          </CardContent>
        </Card>

        {/* Total Change */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {weightChange !== null 
                ? `${weightChange > 0 ? '+' : ''}${formatWeight(Math.abs(weightChange))}`
                : '--'
              }
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Last {selectedPeriod} days
            </div>
          </CardContent>
        </Card>

        {/* Measurements Count */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Measurements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {historyData?.stats.count || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Last {selectedPeriod} days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Weight History</CardTitle>
            <div className="flex gap-2">
              {periodOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedPeriod === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-gray-500">Loading weight history...</div>
            </div>
          ) : historyError ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-red-500">Failed to load weight history</div>
            </div>
          ) : !historyData?.measurements.length ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-gray-500">No weight measurements found</div>
            </div>
          ) : (
            <div className="h-64 relative">
              {/* Simple chart placeholder - in a real app, you'd use a charting library */}
              <div className="absolute inset-0 flex items-end justify-between px-4 pb-4">
                {historyData.measurements.slice(0, 10).reverse().map((measurement, index) => {
                  const weight = unit === 'kg' ? measurement.weightKg : measurement.weightLbs
                  const height = historyData.stats.min && historyData.stats.max
                    ? ((weight - historyData.stats.min) / (historyData.stats.max - historyData.stats.min)) * 200 + 20
                    : 100
                  
                  return (
                    <div key={measurement.id} className="flex flex-col items-center">
                      <div
                        className="w-8 bg-blue-500 rounded-t"
                        style={{ height: `${height}px` }}
                        title={`${formatWeight(weight)} on ${new Date(measurement.measuredAt).toLocaleDateString()}`}
                      />
                      <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left">
                        {new Date(measurement.measuredAt).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Goal line */}
              {goalWeight && historyData.stats.min && historyData.stats.max && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-green-500"
                  style={{
                    bottom: `${((goalWeight - historyData.stats.min) / (historyData.stats.max - historyData.stats.min)) * 200 + 20 + 16}px`
                  }}
                >
                  <span className="absolute right-2 -top-3 text-xs text-green-600 bg-white px-1">
                    Goal: {formatWeight(goalWeight)}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Measurements */}
      {historyData?.measurements && historyData.measurements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Measurements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historyData?.measurements?.slice(0, 5).map((measurement) => (
                <div key={measurement.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium">
                      {formatWeight(unit === 'kg' ? measurement.weightKg : measurement.weightLbs)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(measurement.measuredAt).toLocaleDateString()} at {new Date(measurement.measuredAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {measurement.source}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
