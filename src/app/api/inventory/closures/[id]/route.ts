import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];

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

    if (!profile || !CLOSURE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const service = new InventoryClosureService(supabase);
    const detail = await service.getClosureDetail(id);

    // RLS covers plant scoping, but double-check for non-global roles
    if (
      !canAccessAllInventoryPlants(profile.role) &&
      detail.plant_id !== profile.plant_id
    ) {
      return NextResponse.json({ error: 'Sin permisos para este cierre' }, { status: 403 });
    }

    return NextResponse.json({ success: true, closure: detail });
  } catch (error) {
    console.error('[GET /api/inventory/closures/[id]]', error);
    const msg = (error as Error).message;
    return NextResponse.json({ error: msg }, { status: msg.includes('no encontrado') ? 404 : 500 });
  }
}
