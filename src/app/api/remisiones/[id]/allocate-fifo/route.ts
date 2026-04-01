import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';

/**
 * POST /api/remisiones/[id]/allocate-fifo
 * Allocate FIFO consumption for all materials in a remision (same as /confirm).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remisionId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
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
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
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
  } catch (error: unknown) {
    console.error('Error allocating FIFO consumption:', error);
    return NextResponse.json(
      { error: 'Error al asignar consumo FIFO' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/remisiones/[id]/allocate-fifo
 * Get existing FIFO allocations for a remision
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remisionId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: allocations, error: allocationsError } = await supabase
      .from('material_consumption_allocations')
      .select(
        `
        id,
        remision_material_id,
        quantity_consumed_kg,
        unit_price,
        total_cost,
        entry:material_entries!entry_id (id, entry_number, entry_date),
        material:materials!material_id (id, material_name)
        `
      )
      .eq('remision_id', remisionId)
      .order('created_at', { ascending: true });

    if (allocationsError) {
      return NextResponse.json({ error: 'Error al obtener asignaciones FIFO' }, { status: 500 });
    }

    const totalCost = (allocations || []).reduce(
      (sum, alloc) => sum + Number(alloc.total_cost || 0),
      0
    );

    return NextResponse.json({
      success: true,
      remisionId,
      totalCost: Number(totalCost.toFixed(2)),
      allocationsCount: allocations?.length || 0,
      allocations: allocations || [],
    });
  } catch (error: unknown) {
    console.error('Error fetching FIFO allocations:', error);
    return NextResponse.json({ error: 'Error al obtener asignaciones FIFO' }, { status: 500 });
  }
}
