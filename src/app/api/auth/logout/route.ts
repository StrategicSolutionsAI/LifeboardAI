import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { widgetsByBucket, progressByWidget } = await request.json();
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      console.log('API: Saving widgets for user:', user.id);
      const { error: saveError } = await supabase
        .from('user_preferences')
        .update({ widgets_by_bucket: widgetsByBucket, progress_by_widget: progressByWidget, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (saveError) {
        console.error('API: Error saving widgets:', saveError);
        return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
      }

      console.log('API: Widgets saved successfully. Signing out.');
      await supabase.auth.signOut();
    }

    return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  } catch (error) {
    console.error('API: An unexpected error occurred during logout:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
