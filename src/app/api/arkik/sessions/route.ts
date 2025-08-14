import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';

const supabaseAdmin = createAdminClientForApi();

export async function GET(request: NextRequest) {
  try {
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


