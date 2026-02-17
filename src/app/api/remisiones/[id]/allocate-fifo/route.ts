import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fifoPricingService } from '@/services/fifoPricingService';

/**
 * POST /api/remisiones/[id]/allocate-fifo
 * Allocate FIFO consumption for all materials in a remision
 * 
 * This endpoint should be called after remision_materiales are created
 * to allocate consumption to entry layers using FIFO method.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remisionId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Fetch remision with plant info
    const { data: remision, error: remisionError } = await supabase
      .from('remisiones')
      .select('id, plant_id, fecha')
      .eq('id', remisionId)
      .single();

    if (remisionError || !remision) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 });
    }

    // Fetch all remision materials
    const { data: remisionMaterials, error: materialsError } = await supabase
      .from('remision_materiales')
      .select('id, material_id, cantidad_real, materials!inner (id, material_name)')
      .eq('remision_id', remisionId)
      .not('material_id', 'is', null) // Only materials with material_id
      .gt('cantidad_real', 0); // Only positive consumption

    if (materialsError) {
      return NextResponse.json(
        { error: 'Error al obtener materiales de remisión' },
        { status: 500 }
      );
    }

    if (!remisionMaterials || remisionMaterials.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay materiales para asignar',
        allocations: [],
      });
    }

    // Allocate FIFO consumption for each material
    const allocationResults = [];
    const errors = [];

    for (const rm of remisionMaterials) {
      try {
        const materialId = rm.material_id;
        const quantityKg = Number(rm.cantidad_real);

        if (!materialId || quantityKg <= 0) {
          continue;
        }

        const allocationResult = await fifoPricingService.allocateFIFOConsumption(
          {
            remisionId: remision.id,
            remisionMaterialId: rm.id,
            materialId: materialId,
            plantId: remision.plant_id,
            quantityToConsume: quantityKg,
            consumptionDate: remision.fecha,
          },
          user.id
        );

        allocationResults.push({
          remisionMaterialId: rm.id,
          materialId: materialId,
          materialName: rm.materials?.material_name || 'N/A',
          quantityKg: quantityKg,
          totalCost: allocationResult.totalCost,
          allocationsCount: allocationResult.allocations.length,
        });
      } catch (error: any) {
        errors.push({
          remisionMaterialId: rm.id,
          materialId: rm.material_id,
          materialName: rm.materials?.material_name || 'N/A',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      remisionId: remision.id,
      allocationsCreated: allocationResults.length,
      errors: errors.length,
      allocationResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error allocating FIFO consumption:', error);
    return NextResponse.json(
      { error: 'Error al asignar consumo FIFO', details: error.message },
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

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Fetch allocations for this remision
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
      return NextResponse.json(
        { error: 'Error al obtener asignaciones FIFO' },
        { status: 500 }
      );
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
  } catch (error: any) {
    console.error('Error fetching FIFO allocations:', error);
    return NextResponse.json(
      { error: 'Error al obtener asignaciones FIFO' },
      { status: 500 }
    );
  }
}
