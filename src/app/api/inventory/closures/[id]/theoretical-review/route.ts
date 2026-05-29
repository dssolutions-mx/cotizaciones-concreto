import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];

/** Historical + ledger audit can exceed default serverless timeout on cold start. */
export const maxDuration = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: closureId } = await params;
    const persistSnapshot =
      request.nextUrl.searchParams.get('refresh') === '1' ||
      request.nextUrl.searchParams.get('persist') === '1';

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

    if (!canAccessAllInventoryPlants(profile.role)) {
      const { data: closureRow } = await supabase
        .from('inventory_closures')
        .select('plant_id')
        .eq('id', closureId)
        .single();
      if (!closureRow) {
        return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
      }
      if (closureRow.plant_id !== profile.plant_id) {
        return NextResponse.json({ error: 'Sin permisos para este cierre' }, { status: 403 });
      }
    }

    const service = new InventoryClosureService(supabase);
    const materials = await service.getTheoreticalReviewRows(closureId, { persistSnapshot });

    return NextResponse.json({
      success: true,
      materials,
      adjustments_from_ledger_audit: materials.some((m) => m.adjustments_from_ledger_audit),
    });
  } catch (error) {
    console.error('[GET theoretical-review]', error);
    const msg = (error as Error).message;
    if (msg.includes('no encontrado')) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
