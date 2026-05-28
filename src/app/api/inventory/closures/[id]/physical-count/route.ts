import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { BulkPhysicalCountSchema } from '@/lib/validations/inventoryClosure';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];

export async function PUT(
  request: NextRequest,
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

    // Verify closure is in a state that accepts physical counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closure } = await (supabase as any)
      .from('inventory_closures')
      .select('status, variance_threshold_pct')
      .eq('id', closureId)
      .single();

    if (!closure) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
    if (['sealed', 'cancelled'].includes(closure.status)) {
      return NextResponse.json({ error: 'Este cierre ya está sellado o cancelado' }, { status: 409 });
    }

    const body = await request.json();
    const { counts } = BulkPhysicalCountSchema.parse(body);

    const service = new InventoryClosureService(supabase);
    const updated = await service.savePhysicalCounts(
      closureId,
      counts,
      Number(closure.variance_threshold_pct),
    );

    return NextResponse.json({ success: true, materials: updated });
  } catch (error) {
    console.error('[PUT physical-count]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
