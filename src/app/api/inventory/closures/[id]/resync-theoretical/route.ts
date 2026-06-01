import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];

/** Historical + ledger audit can exceed default serverless timeout. */
export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: closureId } = await params;
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

    if (!profile || !CLOSURE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { data: closureRow, error: closureError } = await supabase
      .from('inventory_closures')
      .select('id, plant_id, status')
      .eq('id', closureId)
      .single();

    if (closureError || !closureRow) {
      return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
    }

    if (
      !canAccessAllInventoryPlants(profile.role) &&
      closureRow.plant_id !== profile.plant_id
    ) {
      return NextResponse.json({ error: 'Sin permisos para este cierre' }, { status: 403 });
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Servidor no configurado' }, { status: 500 });
    }

    const admin = createAdminClientForApi();
    const service = new InventoryClosureService(admin);
    const result = await service.resyncTheoreticalAndVariances(closureId);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[POST resync-theoretical]', error);
    const msg = (error as Error).message;
    if (msg.includes('no encontrado')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('sellado') || msg.includes('cancelado')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
