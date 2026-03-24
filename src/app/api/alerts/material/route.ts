import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MaterialAlertService } from '@/services/materialAlertService';
import { AlertStatus } from '@/types/alerts';
import { z } from 'zod';

const ManualRequestBodySchema = z.object({
  plant_id: z.string().uuid(),
  material_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  estimated_need_kg: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
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

    const allowed = ['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para solicitar material' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = ManualRequestBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { plant_id, material_id, notes, estimated_need_kg } = parsed.data;

    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS' && plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'No puede crear solicitudes para otra planta' }, { status: 403 });
    }

    const service = new MaterialAlertService();
    const alert = await service.createManualRequestAlert(
      { plant_id, material_id, notes, estimated_need_kg },
      user.id
    );

    return NextResponse.json({ success: true, data: alert }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = message.includes('Ya existe') ? 409 : 500;
    console.error('POST /api/alerts/material error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

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
    const statusParam = searchParams.get('status');
    const activeOnly = searchParams.get('active') === 'true';

    const service = new MaterialAlertService();

    if (activeOnly && plantId) {
      const alerts = await service.getActiveAlerts(plantId);
      return NextResponse.json({ success: true, data: alerts });
    }

    const statusFilter = statusParam
      ? statusParam.split(',') as AlertStatus[]
      : undefined;

    const alerts = await service.getAlerts({
      plant_id: plantId || undefined,
      status: statusFilter,
      material_id: searchParams.get('material_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
    });

    return NextResponse.json({ success: true, data: alerts });
  } catch (error) {
    console.error('GET /api/alerts/material error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
