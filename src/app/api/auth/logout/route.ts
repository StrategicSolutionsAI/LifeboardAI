import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    console.log('API: Signing out user...');
    
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('API: Error signing out:', error);
      return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
    }

    console.log('API: User signed out successfully');
    return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
    
  } catch (error) {
    console.error('API: An unexpected error occurred during logout:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
