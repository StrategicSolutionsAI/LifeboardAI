import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { handleApiError } from '@/lib/api-error-handler'

export async function POST() {
  try {
    const supabase = supabaseServer()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('API: Error signing out:', error)
      return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Logout successful' }, { status: 200 })
  } catch (error) {
    return handleApiError(error, 'POST /api/auth/logout')
  }
}
