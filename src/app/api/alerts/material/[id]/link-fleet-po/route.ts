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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const poId = body.po_id as string | undefined;
    if (!poId || typeof poId !== 'string') {
      return NextResponse.json({ error: 'po_id es requerido' }, { status: 400 });
    }

    const service = new MaterialAlertService();
    const alert = await service.linkFleetPO(id, poId, user.id);

    return NextResponse.json({ success: true, data: alert });
  } catch (error) {
    console.error('POST /api/alerts/material/[id]/link-fleet-po error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
