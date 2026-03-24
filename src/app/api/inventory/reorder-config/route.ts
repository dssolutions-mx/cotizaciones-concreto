import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MaterialAlertService } from '@/services/materialAlertService';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id') || profile.plant_id;

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id requerido' }, { status: 400 });
    }

    const service = new MaterialAlertService();
    const config = await service.getReorderConfig(plantId);

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('GET /api/inventory/reorder-config error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
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

    if (!profile || !['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado — solo Jefe BU/Ejecutivo puede configurar puntos de reorden' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.plant_id || !body.material_id || body.reorder_point_kg == null) {
      return NextResponse.json({ error: 'plant_id, material_id y reorder_point_kg son requeridos' }, { status: 400 });
    }

    const service = new MaterialAlertService();
    const config = await service.setReorderConfig({
      plant_id: body.plant_id,
      material_id: body.material_id,
      reorder_point_kg: body.reorder_point_kg,
      reorder_qty_kg: body.reorder_qty_kg,
      notes: body.notes,
    }, user.id);

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('PUT /api/inventory/reorder-config error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
