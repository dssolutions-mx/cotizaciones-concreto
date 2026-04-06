import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';

/**
 * POST /api/remisiones/[id]/confirm
 * Confirm a remision and trigger FIFO allocation (gap C1).
 * Call this when a remision is finalized and remision_materiales are populated.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remisionId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'DOSIFICADOR', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para confirmar remisiones' }, { status: 403 });
    }

    // Guard: block confirmation for zero-material remisiones that haven't been linked yet
    const { data: remision } = await supabase
      .from('remisiones')
      .select('cross_plant_billing_remision_id')
      .eq('id', remisionId)
      .single();

    if (remision) {
      const { count } = await supabase
        .from('remision_materiales')
        .select('id', { count: 'exact', head: true })
        .eq('remision_id', remisionId);

      if ((count ?? 0) === 0 && !remision.cross_plant_billing_remision_id) {
        return NextResponse.json(
          {
            error: 'Remisión sin materiales registrados. Si el concreto fue producido en otra planta, espere a que esa planta procese su archivo Arkik para establecer el vínculo.',
            code: 'NO_MATERIALS_NO_CROSS_PLANT_LINK',
          },
          { status: 422 }
        );
      }
    }

    const result = await autoAllocateRemisionFIFO(remisionId, user.id);

    return NextResponse.json({
      success: result.success,
      remisionId,
      allocationsCreated: result.allocationsCreated,
      errors: result.errors.length > 0 ? result.errors : undefined,
      skipped: result.skipped.length > 0 ? result.skipped : undefined,
      allocationResults: result.allocationResults,
    });
  } catch (error: any) {
    console.error('Error confirming remision:', error);
    return NextResponse.json(
      { error: 'Error al confirmar remisión', details: error?.message },
      { status: 500 }
    );
  }
}
