import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClientForApi();

/**
 * GET /api/remisiones/[id]/cross-plant-materials
 *
 * Returns the `remision_materiales` for a remision's cross-plant production counterpart.
 * Used when Plant A's billing remision (#X) has zero materials but is linked to Plant B's
 * production record (#Y) via `cross_plant_billing_remision_id`.
 *
 * Uses service role to bypass RLS for cross-plant reads.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remisionId } = await params;

    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    // Fetch the billing remision to get the cross-plant link
    const { data: remision, error: remisionError } = await supabaseAdmin
      .from('remisiones')
      .select('id, remision_number, cross_plant_billing_remision_id, plant_id')
      .eq('id', remisionId)
      .maybeSingle();

    if (remisionError) {
      return NextResponse.json({ error: remisionError.message }, { status: 500 });
    }

    if (!remision) {
      return NextResponse.json({ error: 'Remision not found' }, { status: 404 });
    }

    if (!remision.cross_plant_billing_remision_id) {
      return NextResponse.json({ materials: [], isCrossPlant: false });
    }

    // Fetch Plant B's production remision details for the banner and summary
    const { data: productionRemision } = await supabaseAdmin
      .from('remisiones')
      .select(`
        remision_number,
        plant_id,
        hora_carga,
        volumen_fabricado,
        plant:plants!plant_id(name),
        recipe:recipes(recipe_code, strength_fc, slump, age_days, age_hours)
      `)
      .eq('id', remision.cross_plant_billing_remision_id)
      .maybeSingle();

    // Fetch materials from Plant B's production record
    const { data: materials, error: materialsError } = await supabaseAdmin
      .from('remision_materiales')
      .select(`
        id,
        material_type,
        material_id,
        cantidad_real,
        cantidad_teorica,
        ajuste,
        materials:material_id(id, material_name, material_code)
      `)
      .eq('remision_id', remision.cross_plant_billing_remision_id);

    if (materialsError) {
      return NextResponse.json({ error: materialsError.message }, { status: 500 });
    }

    const prodRecipe = (productionRemision as any)?.recipe;
    return NextResponse.json({
      materials: materials || [],
      isCrossPlant: true,
      productionRemisionNumber: productionRemision?.remision_number ?? null,
      productionPlantName: (productionRemision?.plant as any)?.name ?? null,
      productionHoraCarga: (productionRemision as any)?.hora_carga ?? null,
      productionVolumen: (productionRemision as any)?.volumen_fabricado ?? null,
      productionRecipe: prodRecipe
        ? {
            recipe_code: prodRecipe.recipe_code ?? null,
            strength_fc: prodRecipe.strength_fc ?? null,
            slump: prodRecipe.slump ?? null,
            age_days: prodRecipe.age_days ?? null,
            age_hours: prodRecipe.age_hours ?? null,
          }
        : null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
