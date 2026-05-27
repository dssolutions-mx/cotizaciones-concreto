import { createServiceClient } from '@/lib/supabase/server';
import {
  computeScalarPatchFromMediciones,
  groupMedicionesByMeasurand,
  MEASURAND_META,
  normalizeMedicionInputs,
} from '@/lib/quality/muestreoFieldMeasurements';
import type {
  MuestreoMedicionCampo,
  MuestreoMedicionCampoGrouped,
  MuestreoMedicionCampoInput,
} from '@/types/muestreoFieldMeasurement';

export async function listMedicionesCampo(muestreoId: string): Promise<MuestreoMedicionCampo[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('muestreo_mediciones_campo')
    .select('*')
    .eq('muestreo_id', muestreoId)
    .order('measurand_codigo')
    .order('secuencia');

  if (error) throw error;
  return (data ?? []) as MuestreoMedicionCampo[];
}

export async function listMedicionesCampoGrouped(
  muestreoId: string
): Promise<MuestreoMedicionCampoGrouped[]> {
  const rows = await listMedicionesCampo(muestreoId);
  const grouped = groupMedicionesByMeasurand(rows);
  const patch = computeScalarPatchFromMediciones(rows);

  return Array.from(grouped.entries()).map(([codigo, list]) => {
    const meta = MEASURAND_META[codigo];
    return {
      measurand_codigo: codigo,
      label: meta.label,
      unidad: meta.unidad,
      promedio: patch[meta.muestreoColumn] ?? null,
      rows: list,
    };
  });
}

export async function replaceMedicionesCampo(
  muestreoId: string,
  inputs: MuestreoMedicionCampoInput[],
  createdBy?: string | null
): Promise<{ mediciones: MuestreoMedicionCampo[]; scalars: Record<string, number | null> }> {
  const supabase = await createServiceClient();
  const normalized = normalizeMedicionInputs(inputs);

  const { error: delError } = await supabase
    .from('muestreo_mediciones_campo')
    .delete()
    .eq('muestreo_id', muestreoId);

  if (delError) throw delError;

  let inserted: MuestreoMedicionCampo[] = [];
  if (normalized.length > 0) {
    const toInsert = normalized.map((r) => ({
      muestreo_id: muestreoId,
      measurand_codigo: r.measurand_codigo,
      secuencia: r.secuencia,
      motivo: r.motivo ?? null,
      valor: r.valor,
      unidad: r.unidad ?? MEASURAND_META[r.measurand_codigo].unidad,
      notas: r.notas ?? null,
      created_by: createdBy ?? null,
    }));

    const { data, error: insError } = await supabase
      .from('muestreo_mediciones_campo')
      .insert(toInsert)
      .select('*');

    if (insError) throw insError;
    inserted = (data ?? []) as MuestreoMedicionCampo[];
  }

  const patch = computeScalarPatchFromMediciones(normalized);
  const { error: updError } = await supabase
    .from('muestreos')
    .update({
      revenimiento_sitio: patch.revenimiento_sitio,
      temperatura_concreto: patch.temperatura_concreto,
      masa_unitaria: patch.masa_unitaria,
      contenido_aire: patch.contenido_aire,
      temperatura_ambiente: patch.temperatura_ambiente,
      updated_at: new Date().toISOString(),
    })
    .eq('id', muestreoId);

  if (updError) throw updError;

  return {
    mediciones: inserted,
    scalars: {
      revenimiento_sitio: patch.revenimiento_sitio ?? null,
      temperatura_concreto: patch.temperatura_concreto ?? null,
      masa_unitaria: patch.masa_unitaria ?? null,
      contenido_aire: patch.contenido_aire ?? null,
      temperatura_ambiente: patch.temperatura_ambiente ?? null,
    },
  };
}
