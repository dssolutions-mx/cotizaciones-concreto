import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { SealClosureSchema } from '@/lib/validations/inventoryClosure';

const SEAL_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];

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

    if (!profile || !SEAL_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Solo PLANT_MANAGER, ADMIN_OPERATIONS o EXECUTIVE pueden sellar un cierre' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = SealClosureSchema.parse(body);

    // Prevent a client from spoofing a different signer identity
    if (input.signed_by !== user.id) {
      return NextResponse.json({ error: 'El firmante debe ser el usuario autenticado' }, { status: 403 });
    }

    const service = new InventoryClosureService(supabase);
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
