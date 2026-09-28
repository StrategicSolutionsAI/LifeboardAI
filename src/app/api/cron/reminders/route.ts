import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runReminderSweep } from '@/lib/reminders/sweep'
import { pushConfigError } from '@/lib/reminders/web-push'
import { handleApiError } from '@/lib/api-error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Called every 15 minutes by .github/workflows/scheduled-jobs.yml (or any scheduler)
// with `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends the same header.
async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const configError = pushConfigError()
  if (configError) return NextResponse.json({ error: configError }, { status: 503 })

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    return NextResponse.json(await runReminderSweep(admin))
  } catch (error) {
    return handleApiError(error, 'cron/reminders')
  }
}

export const GET = handler
export const POST = handler
