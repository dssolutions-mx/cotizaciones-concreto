import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';

const SEAL_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];

export async function POST(
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

    if (!profile || !SEAL_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Solo PLANT_MANAGER, ADMIN_OPERATIONS o EXECUTIVE pueden cancelar un cierre' },
        { status: 403 },
      );
    }

    const service = new InventoryClosureService(supabase);
    await service.cancelClosure(closureId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST cancel]', error);
    const msg = (error as Error).message;
    if (msg.includes('sellado')) return NextResponse.json({ error: msg }, { status: 409 });
    if (msg.includes('no encontrado')) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
