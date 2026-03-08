import { NextResponse } from 'next/server'

export type { RepeatRule } from '@/types/tasks'
import type { RepeatRule } from '@/types/tasks'

export const TODOIST_TASKS_ENDPOINT = 'https://api.todoist.com/api/v1/tasks'

export const normalizeRepeatRule = (value?: string | null): RepeatRule | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  const base = normalized.replace(/\s+starting\s+.+$/, '')
  switch (normalized) {
    case 'none':
      return undefined
    case 'every day':
    case 'daily':
      return 'daily'
    case 'every week':
    case 'weekly':
      return 'weekly'
    case 'every weekday':
    case 'weekdays':
    case 'every workday':
      return 'weekdays'
    case 'every month':
    case 'monthly':
      return 'monthly'
  }
  switch (base) {
    case 'every day':
    case 'daily':
      return 'daily'
    case 'every week':
    case 'weekly':
      return 'weekly'
    case 'every weekday':
    case 'weekdays':
    case 'every workday':
      return 'weekdays'
    case 'every month':
    case 'monthly':
      return 'monthly'
    default:
      return undefined
  }
}

export const buildDueString = (rule: RepeatRule, startDate?: string | null) => {
  const base = (() => {
    switch (rule) {
      case 'daily':
        return 'every day'
      case 'weekly':
        return 'every week'
      case 'weekdays':
        return 'every weekday'
      case 'monthly':
        return 'every month'
      default:
        return ''
    }
  })()
  if (!base) return undefined
  if (startDate) return `${base} starting ${startDate}`
  return base
}

/**
 * Fetches the Todoist access token for a user.
 * Returns `{ token }` on success, or `{ response }` with an error NextResponse to return early.
 */
export async function getTodoistToken(
  supabase: any,
  userId: string
): Promise<{ token: string } | { response: NextResponse }> {
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'todoist')
    .maybeSingle()

  if (error) {
    console.error('Supabase error fetching todoist integration', error)
    return { response: NextResponse.json({ error: 'Database error' }, { status: 500 }) }
  }

  if (!integration?.access_token) {
    return { response: NextResponse.json({ error: 'Todoist not connected' }, { status: 400 }) }
  }

  return { token: integration.access_token }
}
