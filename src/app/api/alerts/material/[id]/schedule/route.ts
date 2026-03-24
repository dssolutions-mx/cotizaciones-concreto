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

    if (!profile || !['ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'EXECUTIVE', 'PLANT_MANAGER'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.scheduled_delivery_date) {
      return NextResponse.json({ error: 'scheduled_delivery_date es requerido' }, { status: 400 });
    }

    const service = new MaterialAlertService();
    const alert = await service.scheduleDelivery(id, {
      scheduled_delivery_date: body.scheduled_delivery_date,
    }, user.id);

    return NextResponse.json({ success: true, data: alert });
  } catch (error) {
    console.error('POST /api/alerts/material/[id]/schedule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
