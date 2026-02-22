import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClientForApi();
const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    const body = await request.json();
    const { sessionId, actions } = body as { sessionId: string; actions: any[] };
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    // Placeholder endpoint for future batch operations (e.g. commit grouped orders)
    // For now, just mark processed if requested
    const { error } = await supabaseAdmin
      .from('arkik_import_sessions')
      .update({ status: 'processing' })
      .eq('id', sessionId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


