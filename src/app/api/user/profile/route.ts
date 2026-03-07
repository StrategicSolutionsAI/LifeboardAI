import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, withAuthAndBody } from '@/lib/api-utils'

export const GET = withAuth(async (req, { supabase, user }) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, onboarded')
    .eq('id', user.id)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to load profile', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const res = NextResponse.json({ profile: data ?? null })
  res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
  return res
}, 'GET /api/user/profile')

const patchSchema = z.object({
  onboarded: z.boolean().optional(),
  first_name: z.string().max(200).optional(),
})

export const PATCH = withAuthAndBody(patchSchema, async (req, { supabase, user, body }) => {
  const { error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}, 'PATCH /api/user/profile')
