import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { RELEASE_ANNOUNCEMENT_VERSION } from '@/config/releaseAnnouncement';

export async function GET() {
  try {
    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('release_announcement_views')
      .select('id')
      .eq('user_id', user.id)
      .eq('release_version', RELEASE_ANNOUNCEMENT_VERSION)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch release status' }, { status: 500 });
    }

    return NextResponse.json({ pending: !data }, { status: 200 });
  } catch (error) {
    console.error('Error in release announcement status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
