import { format } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { buildInformeSnapshot, type BuildInformeInput } from '@/lib/quality/buildInformeSnapshot';
import {
  buildInformeUncertaintySnapshot,
  requiredMeasurandsForMuestreo,
} from '@/lib/quality/buildInformeUncertaintySnapshot';
import type { InformeFirmaRol, InformeSnapshot, LaboratorioAcreditacionConfig } from '@/types/informe-ensayo';

const QUALITY_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER'];

export async function getLabConfig(plantId?: string | null): Promise<LaboratorioAcreditacionConfig | null> {
  const supabase = await createServiceClient();
  let query = supabase.from('laboratorio_acreditacion_config').select('*');
  if (plantId) {
    const { data: byPlant } = await query.eq('plant_id', plantId).maybeSingle();
    if (byPlant) return byPlant as LaboratorioAcreditacionConfig;
  }
  const { data: global } = await supabase.from('laboratorio_acreditacion_config').is('plant_id', null).maybeSingle();
  return (global as LaboratorioAcreditacionConfig) ?? null;
}

export async function upsertLabConfig(
  payload: Partial<LaboratorioAcreditacionConfig> & { plant_id?: string | null }
): Promise<LaboratorioAcreditacionConfig> {
  const supabase = await createServiceClient();
  const plantId = payload.plant_id ?? null;
  let existingQuery = supabase.from('laboratorio_acreditacion_config').select('id');
  existingQuery = plantId
    ? existingQuery.eq('plant_id', plantId)
    : existingQuery.is('plant_id', null);
  const { data: existing } = await existingQuery.maybeSingle();

  const row = {
    ...payload,
    plant_id: plantId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from('laboratorio_acreditacion_config')
      .update(row)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as LaboratorioAcreditacionConfig;
  }

  const { data, error } = await supabase.from('laboratorio_acreditacion_config').insert(row).select().single();
  if (error) throw error;
  return data as LaboratorioAcreditacionConfig;
}

async function fetchMuestreoListRow(muestreoId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from('muestreos_list_view').select('*').eq('id', muestreoId).single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function fetchMuestrasWithEnsayos(muestreoId: string): Promise<BuildInformeInput['muestras']> {
  const supabase = await createServiceClient();
  const { data: muestras, error } = await supabase
    .from('muestras')
    .select(
      `
      id, tipo_muestra, identificacion, diameter_cm, cube_side_cm, is_edad_garantia,
      ensayos (
        id, fecha_ensayo, carga_kg, resistencia_calculada, resistencia_corregida,
        factor_correccion, porcentaje_cumplimiento,
        temp_laboratorio_c, humedad_relativa_lab, capping_type, capping_norma
      )
    `
    )
    .eq('muestreo_id', muestreoId)
    .order('fecha_programada_ensayo');
  if (error) throw error;
  return (muestras ?? []) as BuildInformeInput['muestras'];
}

async function fetchClientForMuestreo(muestreoListRow: Record<string, unknown>) {
  const clientId = muestreoListRow.client_id as string | undefined;
  if (!clientId) return null;
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('clients')
    .select('business_name, contact_name, address, phone, email')
    .eq('id', clientId)
    .maybeSingle();
  return data;
}

async function fetchEnsayoInstrumentos(muestreoId: string) {
  const supabase = await createServiceClient();
  const { data: muestras } = await supabase.from('muestras').select('id').eq('muestreo_id', muestreoId);
  const muestraIds = (muestras ?? []).map((m) => m.id);
  if (muestraIds.length === 0) return [];

  const { data: ensayos } = await supabase.from('ensayos').select('id').in('muestra_id', muestraIds);
  const ensayoIds = (ensayos ?? []).map((e) => e.id);
  if (ensayoIds.length === 0) return [];

  const { data: links } = await supabase
    .from('ensayo_instrumentos')
    .select(
      `
      fecha_vencimiento_al_momento,
      instrumento:instrumentos(codigo, nombre)
    `
    )
    .in('ensayo_id', ensayoIds);

  const seen = new Set<string>();
  return (links ?? [])
    .filter((l) => {
      const inst = l.instrumento as { codigo?: string; nombre?: string } | null;
      const key = `${inst?.codigo ?? ''}-${inst?.nombre ?? ''}`;
      if (!key.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((l) => {
      const inst = l.instrumento as { codigo?: string; nombre?: string } | null;
      return {
        nombre: inst?.nombre ?? '',
        codigo: inst?.codigo ?? '',
        fecha_vencimiento_al_momento: l.fecha_vencimiento_al_momento as string | null,
      };
    });
}

export async function loadInformeBuildInput(muestreoId: string): Promise<BuildInformeInput> {
  const listRow = await fetchMuestreoListRow(muestreoId);
  const plantId = listRow.plant_id as string | null;
  const [muestras, client, labConfig, ensayoInstrumentos] = await Promise.all([
    fetchMuestrasWithEnsayos(muestreoId),
    fetchClientForMuestreo(listRow),
    getLabConfig(plantId),
    fetchEnsayoInstrumentos(muestreoId),
  ]);

  return {
    muestreoListRow: listRow,
    client,
    muestras,
    ensayoInstrumentos,
    labConfig,
  };
}

export async function previewInformeSnapshot(muestreoId: string): Promise<InformeSnapshot> {
  const input = await loadInformeBuildInput(muestreoId);
  return buildInformeSnapshot(input);
}

function nextInformeNumero(): string {
  const yy = format(new Date(), 'yy');
  return `DCIR${yy}-PENDING`;
}

export async function allocateInformeNumero(): Promise<string> {
  const supabase = await createServiceClient();
  const yy = format(new Date(), 'yy');
  const { count } = await supabase
    .from('informes_ensayo')
    .select('id', { count: 'exact', head: true })
    .like('numero', `DCIR${yy}-%`)
    .neq('numero', `DCIR${yy}-PENDING`);
  const seq = (count ?? 0) + 1;
  return `DCIR${yy}-${String(seq).padStart(2, '0')}`;
}

export async function getInformeByMuestreo(muestreoId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('informes_ensayo')
    .select('*, informe_ensayo_firmas(*)')
    .eq('muestreo_id', muestreoId)
    .in('estado', ['borrador', 'emitido'])
    .order('created_at', { ascending: false })
    .maybeSingle();
  return data;
}

export async function listInformes(params: { plantId?: string; limit?: number }) {
  const supabase = await createServiceClient();
  let query = supabase
    .from('informes_ensayo')
    .select('id, numero, estado, issued_at, muestreo_id, muestreos(fecha_muestreo, numero_muestreo, plant_id)')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  const { data, error } = await query;
  if (error) throw error;

  if (params.plantId) {
    return (data ?? []).filter((row) => {
      const m = row.muestreos as { plant_id?: string } | null;
      return m?.plant_id === params.plantId;
    });
  }
  return data ?? [];
}

export type EmitFirmaInput = {
  rol: InformeFirmaRol;
  signer_name: string;
  signer_user_id?: string;
  cedula_profesional?: string;
};

export async function emitInforme(params: {
  muestreoId: string;
  issuedBy: string;
  opinionTecnica?: string;
  firmas: EmitFirmaInput[];
  replacesInformeId?: string;
}): Promise<{ informe: { id: string; numero: string; snapshot_json: InformeSnapshot } }> {
  const supabase = await createServiceClient();
  const input = await loadInformeBuildInput(params.muestreoId);
  const listRow = input.muestreoListRow;

  const asOfDate =
    input.muestras
      .flatMap((m) => m.ensayos ?? [])
      .map((e) => e.fecha_ensayo)
      .sort()
      .pop() ?? format(new Date(), 'yyyy-MM-dd');

  const required = requiredMeasurandsForMuestreo({
    revenimiento_sitio: listRow.revenimiento_sitio as number | null,
    temperatura_concreto: listRow.temperatura_concreto as number | null,
    contenido_aire: listRow.contenido_aire as number | null,
    masa_unitaria: listRow.masa_unitaria as number | null,
    specimenTypes: input.muestras.map((m) => m.tipo_muestra),
  });

  const { missing } = await buildInformeUncertaintySnapshot(required, asOfDate);
  if (missing.length > 0) {
    throw new Error(`Incertidumbre no publicada para: ${missing.map((m) => m.codigo).join(', ')}`);
  }

  if (!input.labConfig?.acreditacion_ema_numero) {
    throw new Error('Configure la acreditación EMA del laboratorio antes de emitir.');
  }

  const numero = await allocateInformeNumero();
  const issuedAt = new Date().toISOString();
  const muestreadoPor = (listRow.muestreado_por as string) ?? 'LABORATORIO';

  let replacesNumero: string | null = null;
  if (params.replacesInformeId) {
    const { data: prev } = await supabase
      .from('informes_ensayo')
      .select('numero')
      .eq('id', params.replacesInformeId)
      .single();
    replacesNumero = prev?.numero ?? null;
    await supabase
      .from('informes_ensayo')
      .update({ estado: 'anulado', updated_at: new Date().toISOString() })
      .eq('id', params.replacesInformeId);
  }

  const snapshot = await buildInformeSnapshot({
    ...input,
    numero,
    issuedAt,
    replacesNumero,
    opinionTecnica: params.opinionTecnica,
    asOfDate,
    firmas: params.firmas.map((f) => ({
      rol: f.rol,
      nombre: f.signer_name,
      cedula: f.cedula_profesional ?? null,
      signed_at: issuedAt,
    })),
  });

  const { data: informe, error } = await supabase
    .from('informes_ensayo')
    .insert({
      muestreo_id: params.muestreoId,
      numero,
      issued_at: issuedAt,
      issued_by: params.issuedBy,
      replaces_informe_id: params.replacesInformeId ?? null,
      estado: 'emitido',
      muestreado_por_cliente: muestreadoPor === 'CLIENTE',
      regla_decision: input.labConfig?.regla_decision_default,
      opinion_tecnica: params.opinionTecnica ?? null,
      snapshot_json: snapshot,
    })
    .select()
    .single();

  if (error) throw error;

  if (params.firmas.length > 0) {
    await supabase.from('informe_ensayo_firmas').insert(
      params.firmas.map((f) => ({
        informe_id: informe.id,
        rol: f.rol,
        signer_name: f.signer_name,
        signer_user_id: f.signer_user_id ?? null,
        cedula_profesional: f.cedula_profesional ?? null,
        signed_at: issuedAt,
      }))
    );
  }

  return { informe: { id: informe.id, numero, snapshot_json: snapshot } };
}

export async function createInformeDraft(muestreoId: string, userId: string) {
  const supabase = await createServiceClient();
  const existing = await getInformeByMuestreo(muestreoId);
  if (existing) return existing;

  const snapshot = await previewInformeSnapshot(muestreoId);
  const numero = nextInformeNumero();

  const { data, error } = await supabase
    .from('informes_ensayo')
    .insert({
      muestreo_id: muestreoId,
      numero,
      issued_by: userId,
      estado: 'borrador',
      snapshot_json: snapshot,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function assertQualityRole(role: string | undefined) {
  if (!role || !QUALITY_ROLES.includes(role)) {
    throw new Error('No autorizado');
  }
}
