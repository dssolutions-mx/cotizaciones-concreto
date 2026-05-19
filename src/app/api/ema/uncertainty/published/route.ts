import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listPublishedU } from '@/services/emaUncertaintyService';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const published = await listPublishedU();
    return NextResponse.json({ data: published });
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/published]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
