import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MaterialAlertService } from '@/services/materialAlertService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS', 'CREDIT_VALIDATOR'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado — solo dosificador puede confirmar alertas' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.physical_count_kg && body.physical_count_kg !== 0) {
      return NextResponse.json({ error: 'physical_count_kg es requerido' }, { status: 400 });
    }

    const service = new MaterialAlertService();
    const alert = await service.confirmAlert(id, {
      physical_count_kg: body.physical_count_kg,
      discrepancy_notes: body.discrepancy_notes,
    }, user.id);

    return NextResponse.json({ success: true, data: alert });
  } catch (error) {
    console.error('POST /api/alerts/material/[id]/confirm error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
