import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listMeasurands } from '@/services/emaUncertaintyService';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const measurands = await listMeasurands();
    return NextResponse.json(measurands);
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/measurands]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
