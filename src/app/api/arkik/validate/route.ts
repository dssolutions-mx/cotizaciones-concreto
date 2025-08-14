import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';

const supabaseAdmin = createAdminClientForApi();

export async function POST(request: NextRequest) {
  try {
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    const body = await request.json();
    const { sessionId, summary } = body as { sessionId: string; summary: any };
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    const { error } = await supabaseAdmin
      .from('arkik_import_sessions')
      .update({ status: 'validating', error_summary: summary })
      .eq('id', sessionId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


