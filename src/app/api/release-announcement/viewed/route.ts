import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  RELEASE_ANNOUNCEMENT_ALLOWED_VERSIONS,
  RELEASE_ANNOUNCEMENT_VERSION,
} from '@/config/releaseAnnouncement';

type ViewedPayload = {
  version?: string;
};

function isValidVersion(version: string): boolean {
  return RELEASE_ANNOUNCEMENT_ALLOWED_VERSIONS.includes(version as any);
}

export async function POST(request: Request) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as ViewedPayload;
    const version = payload.version ?? RELEASE_ANNOUNCEMENT_VERSION;

    if (!isValidVersion(version)) {
      return NextResponse.json({ error: 'Invalid release version' }, { status: 400 });
    }

    const { error } = await supabase.from('release_announcement_views').upsert(
      {
        user_id: user.id,
        release_version: version,
      },
      { onConflict: 'user_id,release_version', ignoreDuplicates: true }
    );

    if (error) {
      return NextResponse.json({ error: 'Failed to mark release as viewed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Error marking release announcement as viewed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
