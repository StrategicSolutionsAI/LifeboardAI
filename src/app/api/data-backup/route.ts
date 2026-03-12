import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'

const EXPORT_TABLES = [
  'lifeboard_tasks',
  'task_occurrence_exceptions',
  'user_preferences',
  'calendar_events',
  'shopping_list_items',
  'weight_measurements',
  'cycle_tracking',
  'widget_progress_history',
  'nutrition_goals',
  'nutrition_meals',
  'nutrition_favorites',
] as const

/**
 * GET /api/data-backup — export all user data as JSON
 */
export const GET = withAuth(async (_req, { supabase, user }) => {
  const backup: Record<string, any[]> = {}

  for (const table of EXPORT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      console.error(`Failed to export ${table}`, error)
      // Continue with other tables — partial export is better than none
      backup[table] = []
    } else {
      backup[table] = data ?? []
    }
  }

  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    tables: backup,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="lifeboard-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}, 'GET /api/data-backup')

/**
 * POST /api/data-backup — import user data from a previously exported JSON file.
 * Uses upsert (on conflict by id) so it merges with existing data.
 */
export const POST = withAuth(async (req, { supabase, user }) => {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body?.tables || typeof body.tables !== 'object') {
    return NextResponse.json(
      { error: 'Invalid backup format — missing "tables" object' },
      { status: 400 }
    )
  }

  if (body.version !== 1) {
    return NextResponse.json(
      { error: `Unsupported backup version: ${body.version}` },
      { status: 400 }
    )
  }

  const results: Record<string, { imported: number; errors: number }> = {}

  for (const table of EXPORT_TABLES) {
    const rows = body.tables[table]
    if (!Array.isArray(rows) || rows.length === 0) {
      results[table] = { imported: 0, errors: 0 }
      continue
    }

    // Stamp every row with the current user's ID (prevent cross-user imports)
    const stamped = rows.map((row: any) => ({
      ...row,
      user_id: user.id,
    }))

    // Upsert in batches of 500
    let imported = 0
    let errors = 0
    for (let i = 0; i < stamped.length; i += 500) {
      const batch = stamped.slice(i, i + 500)
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })

      if (error) {
        console.error(`Failed to import batch for ${table}`, error)
        errors += batch.length
      } else {
        imported += batch.length
      }
    }

    results[table] = { imported, errors }
  }

  return NextResponse.json({ success: true, results })
}, 'POST /api/data-backup')
