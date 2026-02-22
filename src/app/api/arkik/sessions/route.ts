import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClientForApi();
const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    if (!sessionId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('arkik_import_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


