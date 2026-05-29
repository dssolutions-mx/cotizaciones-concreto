import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];

export async function GET(
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !CLOSURE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const service = new InventoryClosureService(supabase);
    const materials = await service.getTheoreticalReviewRows(closureId);

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
