import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** GET /api/ema/templates/count — total number of verification templates (for code auto-generation) */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { count } = await supabase
      .from('verificacion_templates')
      .select('id', { count: 'exact', head: true });

    return NextResponse.json({ count: count ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
