import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { handleError } from '@/utils/errorHandler';
import type {
  CreateLaboratorioLoteInput,
  LaboratorioLote,
  LaboratorioLoteStatus,
  LaboratorioLoteWithRelations,
  RecipeSnapshot,
  UpdateLaboratorioLoteInput,
} from '@/types/laboratorioLote';

/**
 * Lab tables: run `supabase gen types` after login (see docs/quality/experimentos-smoke.md).
 * Migrations: 20260527120000_laboratorio_experimentos.sql, 20260527140000_laboratorio_lotes_outcome_notes.sql
 */
async function db(): Promise<SupabaseClient<any>> {
  return (await createServerSupabaseClient()) as SupabaseClient<any>;
}

export type RecipeMaterialLine = {
  material_id: string;
  material_type: string;
  quantity: number;
  unit: string;
  material_name?: string;
  category?: string;
};

export async function getCurrentRecipeVersionId(recipeId: string): Promise<string | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('recipe_versions')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('is_current', true)
    .maybeSingle();
  if (error) {
    console.warn('getCurrentRecipeVersionId:', error);
    return null;
  }
  return data?.id ?? null;
}

export async function getRecipeMaterialLines(recipeId: string): Promise<RecipeMaterialLine[]> {
  const versionId = await getCurrentRecipeVersionId(recipeId);
  if (!versionId) return [];

  const supabase = await db();
  const { data, error } = await supabase
    .from('material_quantities')
    .select(
      `
      material_id,
      material_type,
      quantity,
      unit,
      materials!inner(material_name, category)
    `
    )
    .eq('recipe_version_id', versionId);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const mat = row.materials as { material_name?: string; category?: string } | null;
    return {
      material_id: row.material_id as string,
      material_type: row.material_type as string,
      quantity: Number(row.quantity),
      unit: row.unit as string,
      material_name: mat?.material_name,
      category: mat?.category,
    };
  });
}

export async function buildRecipeSnapshot(recipeId: string): Promise<{
  snapshot: RecipeSnapshot;
  recipe_version_id: string | null;
  master_recipe_id: string | null;
}> {
  const supabase = await db();
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('recipe_code, strength_fc, age_days, age_hours, slump, master_recipe_id')
    .eq('id', recipeId)
    .single();

  if (recipeError) throw recipeError;

  const versionId = await getCurrentRecipeVersionId(recipeId);
  const lines = await getRecipeMaterialLines(recipeId);

  const snapshot: RecipeSnapshot = {
    recipe_code: recipe.recipe_code,
    strength_fc: recipe.strength_fc,
    age_days: recipe.age_days,
    age_hours: recipe.age_hours,
    slump: recipe.slump,
    materials: lines.map((l) => ({
      material_id: l.material_id,
      material_type: l.material_type,
      quantity: l.quantity,
      unit: l.unit,
    })),
  };

  return {
    snapshot,
    recipe_version_id: versionId,
    master_recipe_id: recipe.master_recipe_id,
  };
}

export function prefillMaterialsFromLines(
  lines: RecipeMaterialLine[],
  volumenM3: number
): CreateLaboratorioLoteInput['materials'] {
  return lines.map((l) => ({
    material_id: l.material_id,
    material_type: l.material_type,
    cantidad_teorica: l.quantity,
    cantidad_real: volumenM3 > 0 ? l.quantity * volumenM3 : 0,
    unit: l.unit,
  }));
}

export async function generateLoteNumber(plantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const supabase = await db();
  const { data: plant } = await supabase.from('plants').select('code').eq('id', plantId).single();
  const plantCode = plant?.code ?? 'PLT';

  const { data: rows } = await supabase
    .from('laboratorio_lotes')
    .select('lote_number')
    .eq('plant_id', plantId)
    .like('lote_number', `LAB-${plantCode}-${year}-%`);

  let maxSeq = 0;
  const prefix = `LAB-${plantCode}-${year}-`;
  for (const row of rows ?? []) {
    const suffix = row.lote_number.replace(prefix, '');
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export async function createLaboratorioLote(
  input: CreateLaboratorioLoteInput
): Promise<LaboratorioLote> {
  try {
    const loteNumber = await generateLoteNumber(input.plant_id);

    let recipe_version_id: string | null = null;
    let master_recipe_id: string | null = null;
    let recipe_snapshot: RecipeSnapshot | null = null;

    if (input.recipe_id) {
      const built = await buildRecipeSnapshot(input.recipe_id);
      recipe_version_id = built.recipe_version_id;
      master_recipe_id = built.master_recipe_id;
      recipe_snapshot = built.snapshot;
    }

    const supabase = await db();
    const { data: lote, error: loteError } = await supabase
      .from('laboratorio_lotes')
      .insert({
        plant_id: input.plant_id,
        lote_number: loteNumber,
        study_name: input.study_name,
        protocol_type: input.protocol_type,
        hypothesis_notes: input.hypothesis_notes ?? null,
        study_description: input.study_description ?? null,
        notes: input.notes ?? null,
        fecha: input.fecha,
        hora_elaboracion: input.hora_elaboracion,
        volumen_m3: input.volumen_m3,
        recipe_id: input.recipe_id ?? null,
        recipe_version_id,
        master_recipe_id,
        recipe_snapshot,
        concrete_specs: input.concrete_specs ?? null,
        designacion_ehe: input.designacion_ehe ?? null,
        status: 'borrador',
        created_by: input.created_by ?? null,
      })
      .select()
      .single();

    if (loteError) throw loteError;

    if (input.materials.length > 0) {
      const materialRows = input.materials.map((m) => ({
        laboratorio_lote_id: lote.id,
        material_id: m.material_id,
        material_type: m.material_type,
        cantidad_teorica: m.cantidad_teorica ?? null,
        cantidad_real: m.cantidad_real ?? null,
        unit: m.unit ?? null,
      }));

      const { error: matError } = await supabase.from('laboratorio_lote_materiales').insert(materialRows);
      if (matError) throw matError;
    }

    return lote as LaboratorioLote;
  } catch (error) {
    handleError(error, 'createLaboratorioLote');
    throw error;
  }
}

export async function listLaboratorioLotes(params: {
  plant_id: string;
  status?: LaboratorioLoteStatus;
  protocol_type?: string;
  recipe_id?: string;
  master_recipe_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: LaboratorioLoteWithRelations[]; count: number }> {
  const supabase = await db();
  let query = supabase
    .from('laboratorio_lotes')
    .select(
      `
      *,
      recipe:recipe_id(id, recipe_code, strength_fc),
      plant:plant_id(id, code, name),
      muestreos:muestreos(
        id,
        muestras(
          id,
          is_edad_garantia,
          ensayos(resistencia_calculada, porcentaje_cumplimiento)
        )
      )
    `,
      { count: 'exact' }
    )
    .eq('plant_id', params.plant_id)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.protocol_type) query = query.eq('protocol_type', params.protocol_type);
  if (params.recipe_id) query = query.eq('recipe_id', params.recipe_id);
  if (params.master_recipe_id) query = query.eq('master_recipe_id', params.master_recipe_id);
  if (params.fecha_desde) query = query.gte('fecha', params.fecha_desde);
  if (params.fecha_hasta) query = query.lte('fecha', params.fecha_hasta);

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []) as LaboratorioLoteWithRelations[], count: count ?? 0 };
}

export async function getLaboratorioLoteById(id: string): Promise<LaboratorioLoteWithRelations | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('laboratorio_lotes')
    .select(
      `
      *,
      recipe:recipe_id(id, recipe_code, strength_fc, age_days, age_hours, slump),
      plant:plant_id(id, code, name),
      materials:laboratorio_lote_materiales(*),
      muestreos:muestreos(
        id,
        fecha_muestreo,
        sampling_type,
        numero_muestreo,
        muestras(
          id,
          tipo_muestra,
          estado,
          identificacion,
          fecha_programada_ensayo,
          ensayos(id, resistencia_calculada, porcentaje_cumplimiento, fecha_ensayo)
        )
      )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as LaboratorioLoteWithRelations | null;
}

export async function updateLaboratorioLoteBorrador(
  id: string,
  input: UpdateLaboratorioLoteInput
): Promise<LaboratorioLote> {
  const supabase = await db();
  const existing = await getLaboratorioLoteById(id);
  if (!existing) throw new Error('Lote no encontrado');
  if (existing.status !== 'borrador') {
    throw new Error('Solo se puede editar un lote en estado borrador');
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.study_name !== undefined) payload.study_name = input.study_name;
  if (input.protocol_type !== undefined) payload.protocol_type = input.protocol_type;
  if (input.hypothesis_notes !== undefined) payload.hypothesis_notes = input.hypothesis_notes;
  if (input.study_description !== undefined) payload.study_description = input.study_description;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.fecha !== undefined) payload.fecha = input.fecha;
  if (input.hora_elaboracion !== undefined) payload.hora_elaboracion = input.hora_elaboracion;
  if (input.volumen_m3 !== undefined) payload.volumen_m3 = input.volumen_m3;
  if (input.concrete_specs !== undefined) payload.concrete_specs = input.concrete_specs;
  if (input.designacion_ehe !== undefined) payload.designacion_ehe = input.designacion_ehe;

  if (input.recipe_id !== undefined && input.recipe_id !== existing.recipe_id) {
    payload.recipe_id = input.recipe_id;
    if (input.recipe_id) {
      const built = await buildRecipeSnapshot(input.recipe_id);
      payload.recipe_version_id = built.recipe_version_id;
      payload.master_recipe_id = built.master_recipe_id;
      payload.recipe_snapshot = built.snapshot;
    } else {
      payload.recipe_version_id = null;
      payload.master_recipe_id = null;
      payload.recipe_snapshot = null;
    }
  }

  const { data: lote, error: loteError } = await supabase
    .from('laboratorio_lotes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (loteError) throw loteError;

  if (input.materials) {
    const { error: delError } = await supabase
      .from('laboratorio_lote_materiales')
      .delete()
      .eq('laboratorio_lote_id', id);
    if (delError) throw delError;

    if (input.materials.length > 0) {
      const rows = input.materials.map((m) => ({
        laboratorio_lote_id: id,
        material_id: m.material_id,
        material_type: m.material_type,
        cantidad_teorica: m.cantidad_teorica ?? null,
        cantidad_real: m.cantidad_real ?? null,
        unit: m.unit ?? null,
      }));
      const { error: insError } = await supabase.from('laboratorio_lote_materiales').insert(rows);
      if (insError) throw insError;
    }
  }

  return lote as LaboratorioLote;
}

export async function updateLaboratorioLoteStatus(
  id: string,
  status: LaboratorioLoteStatus,
  extra?: { notes?: string; outcome_notes?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra?.notes !== undefined) payload.notes = extra.notes;
  if (extra?.outcome_notes !== undefined) payload.outcome_notes = extra.outcome_notes;

  const supabase = await db();
  const { error } = await supabase.from('laboratorio_lotes').update(payload).eq('id', id);
  if (error) throw error;
}

export async function markLoteMuestreado(laboratorioLoteId: string): Promise<void> {
  await updateLaboratorioLoteStatus(laboratorioLoteId, 'muestreado');
}

export { concreteSpecsFromRecipe, computeMixKpis } from '@/lib/quality/laboratorioLoteUtils';
