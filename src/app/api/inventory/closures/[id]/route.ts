import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi } from '@/lib/supabase/api';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles';
import {
  assertClosurePlantAccessForView,
  canDeleteInventoryClosure,
  canViewInventoryClosure,
} from '@/lib/auth/inventoryClosureRoles';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const service = new InventoryClosureService(supabase);
    const detail = await service.getClosureDetail(id);

    // RLS covers plant scoping, but double-check for non-global roles
    try {
      assertClosurePlantAccessForView(profile, detail.plant_id);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }

    return NextResponse.json({ success: true, closure: detail });
  } catch (error) {
    console.error('[GET /api/inventory/closures/[id]]', error);
    const msg = (error as Error).message;
    return NextResponse.json({ error: msg }, { status: msg.includes('no encontrado') ? 404 : 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: closureId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !canDeleteInventoryClosure(profile.role)) {
      return NextResponse.json(
        { error: 'Solo EXECUTIVE puede eliminar un cierre de inventario' },
        { status: 403 },
      );
    }

    const admin = createAdminClientForApi();
    const { data: closureRow } = await admin
      .from('inventory_closures')
      .select('plant_id')
      .eq('id', closureId)
      .single();

    if (!closureRow) {
      return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
    }

    if (
      !canAccessAllInventoryPlants(profile.role) &&
      closureRow.plant_id !== profile.plant_id
    ) {
      return NextResponse.json({ error: 'Sin permisos para este cierre' }, { status: 403 });
    }

    const service = new InventoryClosureService(admin);
    await service.deleteClosure(closureId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/inventory/closures/[id]]', error);
    const msg = (error as Error).message;
    return NextResponse.json({ error: msg }, { status: msg.includes('no encontrado') ? 404 : 500 });
  }
}
