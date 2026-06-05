import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { InitiateClosureSchema, ListClosuresQuerySchema } from '@/lib/validations/inventoryClosure';
import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles';
import {
  canViewClosureAcrossPlants,
  canViewInventoryClosure,
  canWorkInventoryClosure,
} from '@/lib/auth/inventoryClosureRoles';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !canViewInventoryClosure(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = ListClosuresQuerySchema.parse({
      plant_id: searchParams.get('plant_id') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      period_start: searchParams.get('period_start') ?? undefined,
      period_end: searchParams.get('period_end') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    // Non-global users can only see their own plant
    const plantId =
      canViewClosureAcrossPlants(profile.role) ? query.plant_id : (profile.plant_id ?? undefined);

    const service = new InventoryClosureService(supabase);
    const closures = await service.listClosures({
      plantId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    return NextResponse.json({ success: true, closures });
  } catch (error) {
    console.error('[GET /api/inventory/closures]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !canWorkInventoryClosure(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const input = InitiateClosureSchema.parse(body);

    // Non-global users can only initiate for their own plant
    if (!canAccessAllInventoryPlants(profile.role) && input.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'No puede iniciar un cierre para otra planta' }, { status: 403 });
    }

    const service = new InventoryClosureService(supabase);
    const closure = await service.initiateClosure(user.id, input);

    return NextResponse.json({ success: true, closure }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/inventory/closures]', error);
    if ((error as Error).message?.includes('Ya existe')) {
      return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
