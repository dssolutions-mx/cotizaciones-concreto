import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasInventoryStandardAccess, isGlobalInventoryRole } from '@/lib/auth/inventoryRoles';

const BodySchema = z.object({
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plant_id: z.string().uuid().optional(),
});

/**
 * POST /api/inventory/snapshots/calculate
 * Calls DB function calculate_daily_inventory_snapshot per plant.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const { snapshot_date, plant_id: bodyPlantId } = BodySchema.parse(body);

    let plantIds: string[] = [];
    if (bodyPlantId) {
      if (!isGlobalInventoryRole(profile.role) && profile.plant_id && bodyPlantId !== profile.plant_id) {
        return NextResponse.json({ error: 'Solo puede calcular para su planta' }, { status: 403 });
      }
      plantIds = [bodyPlantId];
    } else if (isGlobalInventoryRole(profile.role)) {
      const { data: plants, error: pErr } = await supabase.from('plants').select('id');
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }
      plantIds = (plants || []).map((p) => p.id);
    } else if (profile.plant_id) {
      plantIds = [profile.plant_id];
    } else {
      return NextResponse.json({ error: 'Sin planta asignada' }, { status: 400 });
    }

    const rpcErrors: string[] = [];
    for (const pid of plantIds) {
      const { error: rpcError } = await supabase.rpc('calculate_daily_inventory_snapshot', {
        p_plant_id: pid,
        p_date: snapshot_date,
      });
      if (rpcError) {
        rpcErrors.push(`${pid}: ${rpcError.message}`);
      }
    }

    return NextResponse.json({
      success: rpcErrors.length === 0,
      snapshot_date,
      plants_processed: plantIds.length,
      errors: rpcErrors.length ? rpcErrors : undefined,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', details: error.flatten() }, { status: 400 });
    }
    console.error('[snapshots/calculate]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
