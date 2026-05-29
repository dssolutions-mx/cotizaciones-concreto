import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi } from '@/lib/supabase/api';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { SealClosureSchema } from '@/lib/validations/inventoryClosure';
import {
  assertClosurePlantAccess,
  canSealInventoryClosure,
} from '@/lib/auth/inventoryClosureRoles';

export const maxDuration = 120;

export async function POST(
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

    if (!profile || !canSealInventoryClosure(profile.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para sellar este cierre' },
        { status: 403 },
      );
    }

    const { data: closureRow } = await supabase
      .from('inventory_closures')
      .select('plant_id')
      .eq('id', closureId)
      .single();

    if (!closureRow) {
      return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
    }

    try {
      assertClosurePlantAccess(profile, closureRow.plant_id);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }

    const body = await request.json();
    const input = SealClosureSchema.parse(body);

    if (input.signed_by !== user.id) {
      return NextResponse.json({ error: 'El firmante debe ser el usuario autenticado' }, { status: 403 });
    }

    const admin = createAdminClientForApi();
    const service = new InventoryClosureService(admin);
    const sealed = await service.sealClosure(closureId, user.id, input);

    return NextResponse.json({ success: true, closure: sealed });
  } catch (error) {
    console.error('[POST seal]', error);
    const msg = (error as Error).message;
    if (msg.includes('Faltan justificaciones')) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    if (msg.includes('no encontrado')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
