import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi } from '@/lib/supabase/api';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { BulkJustificationsSchema } from '@/lib/validations/inventoryClosure';
import {
  assertClosurePlantAccess,
  canAccessInventoryClosure,
} from '@/lib/auth/inventoryClosureRoles';

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
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !canAccessInventoryClosure(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closure } = await (supabase as any)
      .from('inventory_closures')
      .select('status, plant_id')
      .eq('id', closureId)
      .single();

    if (!closure) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });

    try {
      assertClosurePlantAccess(profile, closure.plant_id as string);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    if (['sealed', 'cancelled'].includes(closure.status)) {
      return NextResponse.json({ error: 'Cierre ya sellado o cancelado' }, { status: 409 });
    }

    const body = await request.json();
    const { justifications } = BulkJustificationsSchema.parse(body);

    const service = new InventoryClosureService(createAdminClientForApi());
    await service.saveJustifications(closureId, justifications);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT justifications]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
