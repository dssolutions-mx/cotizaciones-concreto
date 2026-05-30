import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi } from '@/lib/supabase/api';
import { canDeleteInventoryClosure } from '@/lib/auth/inventoryClosureRoles';
import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles';
import { deleteMaterialAdjustment } from '@/lib/inventory/deleteMaterialAdjustment';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: adjustmentId } = await params;
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
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !canDeleteInventoryClosure(profile.role)) {
      return NextResponse.json(
        { error: 'Solo EXECUTIVE puede eliminar ajustes de inventario' },
        { status: 403 },
      );
    }

    const admin = createAdminClientForApi();
    const { data: adj } = await admin
      .from('material_adjustments')
      .select('id, plant_id')
      .eq('id', adjustmentId)
      .single();

    if (!adj) {
      return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });
    }

    if (
      !canAccessAllInventoryPlants(profile.role) &&
      adj.plant_id !== profile.plant_id
    ) {
      return NextResponse.json({ error: 'Sin permisos para este ajuste' }, { status: 403 });
    }

    const result = await deleteMaterialAdjustment(admin, adjustmentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/inventory/adjustments/[id]]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}
