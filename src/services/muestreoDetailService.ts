import { calcularRendimientoVolumetrico } from '@/lib/qualityMetricsUtils';
import { evaluateInformeChecklist, requiredUFromMuestreoRow } from '@/lib/quality/informeChecklist';
import { createServiceClient } from '@/lib/supabase/server';
import { listMedicionesCampoGrouped } from '@/services/muestreoFieldMeasurementService';
import { getInformeByMuestreo, getLabConfig } from '@/services/informeEnsayoService';
import { listPublishedU } from '@/services/emaUncertaintyService';
import type { MuestreoInstrumentoRow } from '@/components/quality/muestreos/detail/MuestreoEquipmentCard';
import type { ProductionRemision } from '@/components/quality/muestreos/detail/CrossPlantProductionCard';
import type { InformeChecklistItem, InformeSnapshot, LaboratorioAcreditacionConfig } from '@/types/informe-ensayo';
import type { MuestreoMedicionCampoGrouped } from '@/types/muestreoFieldMeasurement';
import type { MuestreoWithRelations } from '@/types/quality';
import type { UncertaintyPublished } from '@/types/ema-uncertainty';

export type MuestreoOrderTotals = {
  totalOrderVolume: number;
  totalOrderSamplings: number;
  totalRemisiones: number;
};

export type MuestreoRendimientoVolumetrico = {
  value: number | null;
  sumaMateriales: number;
  volumenFabricado: number;
  masaUnitaria: number;
};

export type MuestreoInformeBundle = {
  informeRecord: {
    id: string;
    numero: string;
    estado: string;
    issued_at?: string;
    snapshot_json?: InformeSnapshot;
  } | null;
  snapshot: InformeSnapshot | null;
  labConfig: LaboratorioAcreditacionConfig | null;
  checklist: InformeChecklistItem[];
};

export type MuestreoDetailBundle = {
  muestreo: MuestreoWithRelations;
  emaInstrumentos: MuestreoInstrumentoRow[];
  ensayoHasEquipment: boolean;
  productionRemision: ProductionRemision | null;
  orderTotals: MuestreoOrderTotals | null;
  rendimientoVolumetrico: MuestreoRendimientoVolumetrico | null;
  medicionesCampoGrouped: MuestreoMedicionCampoGrouped[];
  publishedUncertainty: UncertaintyPublished[];
  informe: MuestreoInformeBundle;
};

export const MUESTREO_CORE_SELECT = `
  *,
  remision:remision_id (
    *,
    recipe:recipes(*)
  ),
  laboratorio_lote:laboratorio_lote_id (
    id,
    lote_number,
    study_name,
    protocol_type,
    hypothesis_notes,
    volumen_m3,
    designacion_ehe,
    recipe_snapshot,
    concrete_specs
  ),
  muestras(
    *,
    ensayos(*),
    molde_instrumento:instrumentos!muestras_molde_instrumento_id_fkey(id, codigo, nombre)
  )
`;

export async function fetchMuestreoCore(muestreoId: string): Promise<MuestreoWithRelations> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('muestreos')
    .select(MUESTREO_CORE_SELECT)
    .eq('id', muestreoId)
    .single();

  if (error || !data) {
    throw new Error('Muestreo not found');
  }

  const remision = data.remision as { order_id?: string; order?: unknown } | null;
  if (remision?.order_id) {
    const { data: orderData } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        construction_site,
        delivery_date,
        delivery_time,
        elemento,
        clients(id, business_name)
      `
      )
      .eq('id', remision.order_id)
      .single();

    if (orderData) {
      (data.remision as { order?: unknown }).order = orderData;
    }
  }

  return data as MuestreoWithRelations;
}

async function fetchEmaInstrumentos(muestreoId: string): Promise<MuestreoInstrumentoRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('muestreo_instrumentos')
    .select(
      `
      *,
      instrumento:instrumentos(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial,
        conjuntos_herramientas(categoria)
      )
    `
    )
    .eq('muestreo_id', muestreoId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    instrumento: {
      ...row.instrumento,
      categoria: (row.instrumento as { conjuntos_herramientas?: { categoria?: string } | null })
        ?.conjuntos_herramientas?.categoria ?? '',
    },
  })) as MuestreoInstrumentoRow[];
}

async function fetchEnsayoHasEquipment(muestreo: MuestreoWithRelations): Promise<boolean> {
  const garantiaEnsayoIds = (muestreo.muestras ?? [])
    .filter((m) => m.is_edad_garantia)
    .flatMap((m) => (m.ensayos ?? []).map((e) => e.id))
    .filter(Boolean);

  if (garantiaEnsayoIds.length === 0) return false;

  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('ensayo_instrumentos')
    .select('id', { count: 'exact', head: true })
    .in('ensayo_id', garantiaEnsayoIds);

  if (error) throw error;
  return (count ?? 0) > 0;
}

async function fetchProductionRemision(
  crossPlantRemisionId: string | null | undefined
): Promise<ProductionRemision | null> {
  if (!crossPlantRemisionId) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('remisiones')
    .select(
      `
      id,
      remision_number,
      fecha,
      hora_carga,
      conductor,
      unidad,
      volumen_fabricado,
      plant_id,
      plant:plants!plant_id(id, code, name),
      recipe:recipes(recipe_code, strength_fc, slump, age_days, age_hours, tma)
    `
    )
    .eq('id', crossPlantRemisionId)
    .maybeSingle();

  return (data as ProductionRemision | null) ?? null;
}

async function fetchOrderTotals(orderId: string | undefined): Promise<MuestreoOrderTotals | null> {
  if (!orderId) return null;

  const supabase = createServiceClient();
  const { data: remisionesData, error: remisionesError } = await supabase
    .from('remisiones')
    .select('volumen_fabricado, id')
    .eq('order_id', orderId);

  if (remisionesError) throw remisionesError;
  if (!remisionesData?.length) {
    return { totalOrderVolume: 0, totalOrderSamplings: 0, totalRemisiones: 0 };
  }

  const totalVolume =
    remisionesData.reduce((sum, rem) => sum + (rem.volumen_fabricado || 0), 0) || 0;

  const { data: muestreosData, error: muestreosError } = await supabase
    .from('muestreos')
    .select('id')
    .in(
      'remision_id',
      remisionesData.map((r) => r.id)
    );

  if (muestreosError) throw muestreosError;

  return {
    totalOrderVolume: totalVolume,
    totalOrderSamplings: muestreosData?.length ?? 0,
    totalRemisiones: remisionesData.length,
  };
}

async function fetchRendimientoVolumetrico(
  muestreo: MuestreoWithRelations
): Promise<MuestreoRendimientoVolumetrico | null> {
  const remisionId = muestreo.remision?.id;
  const masaUnitaria = muestreo.masa_unitaria;
  if (!remisionId || !masaUnitaria) return null;

  const supabase = createServiceClient();
  const { data: materialesData, error } = await supabase
    .from('remision_materiales')
    .select('cantidad_real')
    .eq('remision_id', remisionId);

  if (error || !materialesData) return null;

  const sumaMateriales = materialesData.reduce((sum, material) => sum + (material.cantidad_real || 0), 0);
  const volumenFabricado = muestreo.remision?.volumen_fabricado || 0;
  const value = calcularRendimientoVolumetrico(volumenFabricado, sumaMateriales, masaUnitaria);

  return { value, sumaMateriales, volumenFabricado, masaUnitaria };
}

function buildInformeChecklist(
  muestreo: MuestreoWithRelations,
  labConfig: LaboratorioAcreditacionConfig | null,
  ensayoHasEquipment: boolean,
  publishedUncertainty: UncertaintyPublished[]
): InformeChecklistItem[] {
  const required = requiredUFromMuestreoRow({
    revenimiento_sitio: muestreo.revenimiento_sitio,
    temperatura_concreto: muestreo.temperatura_concreto,
    contenido_aire: muestreo.contenido_aire,
    masa_unitaria: muestreo.masa_unitaria,
    muestras_json: muestreo.muestras?.map((m) => ({ tipo_muestra: m.tipo_muestra })),
    declarar_incertidumbre_campo: muestreo.declarar_incertidumbre_campo,
  });

  const publishedCodes = new Set(
    publishedUncertainty.map((r) => r.measurand?.codigo).filter(Boolean) as string[]
  );
  const uncertaintyMissing = required.filter((r) => !publishedCodes.has(r.codigo)).map((r) => r.codigo);

  const isLabExperiment =
    muestreo.sampling_type === 'LAB_EXPERIMENT' || !!muestreo.laboratorio_lote_id;

  return evaluateInformeChecklist({
    isLabExperiment,
    muestreo: {
      id: muestreo.id,
      fecha_recepcion_lab: muestreo.fecha_recepcion_lab,
      muestreado_por: muestreo.muestreado_por,
      laboratorio_lote_id: muestreo.laboratorio_lote_id,
      muestras: muestreo.muestras,
    },
    order_elemento:
      (muestreo.remision as { order?: { elemento?: string } } | undefined)?.order?.elemento ?? null,
    labConfig,
    ensayoHasEquipment,
    uncertaintyMissing,
  });
}

export async function loadMuestreoDetailBundle(muestreoId: string): Promise<MuestreoDetailBundle> {
  const muestreo = await fetchMuestreoCore(muestreoId);

  const crossPlantRemisionId = (
    muestreo.remision as { cross_plant_billing_remision_id?: string | null } | undefined
  )?.cross_plant_billing_remision_id;
  const orderId =
    (muestreo.remision as { order?: { id?: string }; order_id?: string } | undefined)?.order?.id ??
    (muestreo.remision as { order_id?: string } | undefined)?.order_id;

  const [
    emaInstrumentos,
    ensayoHasEquipment,
    productionRemision,
    orderTotals,
    rendimientoVolumetrico,
    medicionesCampoGrouped,
    publishedUncertainty,
    informeRecord,
    labConfig,
  ] = await Promise.all([
    fetchEmaInstrumentos(muestreoId),
    fetchEnsayoHasEquipment(muestreo),
    fetchProductionRemision(crossPlantRemisionId),
    fetchOrderTotals(orderId),
    fetchRendimientoVolumetrico(muestreo),
    listMedicionesCampoGrouped(muestreoId),
    muestreo.declarar_incertidumbre_campo ? listPublishedU() : Promise.resolve([]),
    getInformeByMuestreo(muestreoId),
    getLabConfig(muestreo.plant_id ?? null),
  ]);

  const snapshot: InformeSnapshot | null =
    informeRecord?.estado === 'emitido' && informeRecord.snapshot_json
      ? (informeRecord.snapshot_json as InformeSnapshot)
      : null;

  const checklist = buildInformeChecklist(
    muestreo,
    labConfig,
    ensayoHasEquipment,
    publishedUncertainty
  );

  return {
    muestreo,
    emaInstrumentos,
    ensayoHasEquipment,
    productionRemision,
    orderTotals,
    rendimientoVolumetrico,
    medicionesCampoGrouped,
    publishedUncertainty,
    informe: {
      informeRecord: informeRecord
        ? {
            id: informeRecord.id,
            numero: informeRecord.numero,
            estado: informeRecord.estado,
            issued_at: informeRecord.issued_at ?? undefined,
            snapshot_json: informeRecord.snapshot_json as InformeSnapshot | undefined,
          }
        : null,
      snapshot,
      labConfig,
      checklist,
    },
  };
}
