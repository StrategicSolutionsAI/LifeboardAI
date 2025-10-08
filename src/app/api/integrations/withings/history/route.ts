import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MeasurementRow {
  id: string
  user_id: string
  weight_kg: number
  weight_lbs: number
  measured_at: string
  source?: string | null
  created_at?: string | null
}

export async function GET(request: NextRequest) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get('days') || '30')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  try {
    // Get weight measurements from the last N days
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: measurements, error } = await supabase
      .from('weight_measurements')
      .select('*')
      .eq('user_id', user.id)
      .gte('measured_at', startDate.toISOString())
      .order('measured_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching weight history:', error)
      
      // If the table doesn't exist, return empty data instead of error
      if (error.message?.includes('relation "weight_measurements" does not exist')) {
        return NextResponse.json({
          measurements: [],
          stats: {
            count: 0,
            latest: null,
            earliest: null,
            min: null,
            max: null,
            average: null,
            change: null
          },
          period: {
            days,
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString()
          }
        })
      }
      
      return NextResponse.json({ error: 'Failed to fetch weight history' }, { status: 500 })
    }

    const rows: MeasurementRow[] = (measurements || []) as unknown as MeasurementRow[]

    // Format the data for the frontend
    const formattedData = rows.map((measurement) => ({
      id: measurement.id,
      weightKg: measurement.weight_kg,
      weightLbs: measurement.weight_lbs,
      measuredAt: measurement.measured_at,
      source: measurement.source ?? null,
      createdAt: measurement.created_at ?? null,
    }))

    // Calculate some basic stats
    const weights = rows.map((m) => m.weight_kg)
    const stats = {
      count: rows.length,
      latest: weights[0] || null,
      earliest: weights[weights.length - 1] || null,
      min: weights.length > 0 ? Math.min(...weights) : null,
      max: weights.length > 0 ? Math.max(...weights) : null,
      average: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
      change: weights.length > 1 ? weights[0] - weights[weights.length - 1] : null,
    }

    return NextResponse.json({
      measurements: formattedData,
      stats,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in weight history endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
