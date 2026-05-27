import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getStudyInformeDetalle } from '@/services/emaUncertaintyService';
import { UncertaintyInformeError } from '@/types/ema-uncertainty';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const data = await getStudyInformeDetalle(id);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof UncertaintyInformeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/ema/uncertainty/studies/[id]/informe]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
