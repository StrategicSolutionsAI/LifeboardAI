import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/utils/supabase/server'
import { withErrorHandling, createApiError } from '@/lib/api-error-handler'
import { parseBody } from '@/lib/validations'

const bucketDeleteSchema = z.object({
  bucket: z.string().min(1, 'bucket name required').max(200),
})

async function postHandler(request: Request) {
  const supabase = supabaseServer()
  const authResult = await supabase.auth.getUser()
  const user = authResult?.data?.user

  if (!user) {
    throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')
  }

  const body = await request.json()
  const parsed = parseBody(bucketDeleteSchema, body)
  if (parsed.response) return new NextResponse(parsed.response.body, parsed.response)

  const { bucket } = parsed.data

  // Delete tasks, calendar events, and shopping list items for this bucket
  const [tasksResult, eventsResult, shoppingResult] = await Promise.all([
    supabase
      .from('lifeboard_tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('bucket', bucket),
    supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id)
      .eq('bucket', bucket),
    supabase
      .from('shopping_list_items')
      .delete()
      .eq('user_id', user.id)
      .eq('bucket', bucket),
  ])

  const errors: string[] = []
  if (tasksResult.error) errors.push(`tasks: ${tasksResult.error.message}`)
  if (eventsResult.error) errors.push(`calendar_events: ${eventsResult.error.message}`)
  if (shoppingResult.error) errors.push(`shopping_list_items: ${shoppingResult.error.message}`)

  if (errors.length > 0) {
    throw createApiError(
      `Failed to delete related data: ${errors.join('; ')}`,
      500,
      'CASCADE_DELETE_ERROR'
    )
  }

  return NextResponse.json({ success: true, bucket })
}

export const POST = withErrorHandling(postHandler, 'user/bucket-delete/POST')
