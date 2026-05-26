import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchLatestVigenteCertUncertaintyByInstrumentIds } from '@/services/emaInstrumentoService'
import type { CompletedVerificacionDetalle, InstrumentoCard, VerificacionTemplateSnapshot } from '@/types/ema'

type AdminClient = SupabaseClient

function mapMaestroRow(
  row: Record<string, unknown>,
  certOv: Map<string, { incertidumbre_expandida: number | null; factor_cobertura: number | null; incertidumbre_unidad: string | null }>,
): InstrumentoCard {
  const ch = (row.conjuntos_herramientas as Record<string, string> | null) ?? {}
  const cid = row.id as string
  const cert = certOv.get(cid)
  return {
    id: cid,
    codigo: row.codigo as string,
    nombre: row.nombre as string,
    tipo: row.tipo as InstrumentoCard['tipo'],
    categoria: (ch.categoria as string) ?? '',
    estado: row.estado as InstrumentoCard['estado'],
    fecha_proximo_evento: row.fecha_proximo_evento as string | null,
    plant_id: row.plant_id as string,
    marca: row.marca as string | null,
    modelo_comercial: row.modelo_comercial as string | null,
    conjunto_id: row.conjunto_id as string,
    conjunto_codigo: (ch.codigo_conjunto as string) ?? '',
    conjunto_nombre: (ch.nombre_conjunto as string) ?? '',
    incertidumbre_expandida:
      (row.incertidumbre_expandida as number | null | undefined) ?? cert?.incertidumbre_expandida ?? null,
    incertidumbre_k: (row.incertidumbre_k as number | null | undefined) ?? cert?.factor_cobertura ?? null,
    incertidumbre_unidad:
      (row.incertidumbre_unidad as string | null | undefined) ?? cert?.incertidumbre_unidad ?? null,
  }
}

async function loadMaestrosForCompletedIds(
  admin: AdminClient,
  completedIds: string[],
): Promise<{
  cardsByCompleted: Map<string, InstrumentoCard[]>
  maestroIdsByCompleted: Map<string, string[]>
}> {
  const cardsByCompleted = new Map<string, InstrumentoCard[]>()
  const maestroIdsByCompleted = new Map<string, string[]>()
  for (const cid of completedIds) {
    cardsByCompleted.set(cid, [])
    maestroIdsByCompleted.set(cid, [])
  }
  if (completedIds.length === 0) {
    return { cardsByCompleted, maestroIdsByCompleted }
  }

  const { data: mlinks } = await admin
    .from('completed_verificacion_maestros')
    .select('completed_id, maestro_id')
    .in('completed_id', completedIds)

  const links = mlinks ?? []
  for (const link of links as { completed_id: string; maestro_id: string }[]) {
    maestroIdsByCompleted.get(link.completed_id)!.push(link.maestro_id)
  }

  const allMaestroIds = [...new Set(links.map((r: { maestro_id: string }) => r.maestro_id))]
  if (allMaestroIds.length === 0) {
    return { cardsByCompleted, maestroIdsByCompleted }
  }

  const { data: mrows } = await admin
    .from('instrumentos')
    .select(`
      id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
      incertidumbre_expandida, incertidumbre_k, incertidumbre_unidad,
      conjuntos_herramientas!inner(
        categoria,
        codigo_conjunto,
        nombre_conjunto
      )
    `)
    .in('id', allMaestroIds)

  const certOv = await fetchLatestVigenteCertUncertaintyByInstrumentIds(allMaestroIds, admin)
  const maestroById = new Map(
    (mrows ?? []).map((row: Record<string, unknown>) => [row.id as string, mapMaestroRow(row, certOv)]),
  )

  for (const link of links as { completed_id: string; maestro_id: string }[]) {
    const card = maestroById.get(link.maestro_id)
    if (card) cardsByCompleted.get(link.completed_id)!.push(card)
  }
  return { cardsByCompleted, maestroIdsByCompleted }
}

function assembleDetalle(
  vRow: Record<string, unknown> & {
    id: string
    template_version_id: string
    instrumento_id: string
    created_by: string | null
  },
  version: { version_number: number | null; snapshot: unknown } | null,
  measurements: unknown[],
  instrumento: unknown,
  created_by_profile: { id: string; full_name: string } | null,
  instrumento_maestro_ids: string[],
  instrumentos_maestro: InstrumentoCard[],
): CompletedVerificacionDetalle {
  return {
    ...(vRow as CompletedVerificacionDetalle),
    instrumento_maestro_ids,
    instrumentos_maestro,
    snapshot: (version?.snapshot ?? null) as VerificacionTemplateSnapshot,
    template_version_number: version?.version_number ?? null,
    measurements: measurements as CompletedVerificacionDetalle['measurements'],
    evidencias: [],
    signatures: [],
    issues: [],
    instrumento: instrumento as CompletedVerificacionDetalle['instrumento'],
    created_by_profile,
  }
}

/** Load one completed verification with snapshot, measurements, and related rows. */
export async function fetchCompletedVerificacionDetalle(
  admin: AdminClient,
  id: string,
): Promise<CompletedVerificacionDetalle | null> {
  const list = await fetchCompletedVerificacionesDetalle(admin, [id])
  return list[0] ?? null
}

/**
 * Load multiple completed verificaciones in request order.
 * Throws if any id is missing.
 */
export async function fetchCompletedVerificacionesDetalle(
  admin: AdminClient,
  ids: string[],
): Promise<CompletedVerificacionDetalle[]> {
  if (ids.length === 0) return []

  const uniqueIds = [...new Set(ids)]
  const { data: verifs, error: vErr } = await admin
    .from('completed_verificaciones')
    .select('*')
    .in('id', uniqueIds)

  if (vErr) throw vErr

  const byId = new Map((verifs ?? []).map((v) => [v.id as string, v as Record<string, unknown>]))
  const missing = uniqueIds.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    throw new Error(`Verificación no encontrada: ${missing[0]}`)
  }

  const versionIds = [...new Set(uniqueIds.map((id) => byId.get(id)!.template_version_id as string))]
  const instrumentoIds = [...new Set(uniqueIds.map((id) => byId.get(id)!.instrumento_id as string))]
  const creatorIds = [
    ...new Set(
      uniqueIds
        .map((id) => byId.get(id)!.created_by as string | null)
        .filter((x): x is string => !!x),
    ),
  ]

  const [
    { data: versions },
    { data: allMeasurements },
    { data: instrumentos },
    { data: profiles },
    { cardsByCompleted: maestrosByCompleted, maestroIdsByCompleted },
  ] = await Promise.all([
      admin
        .from('verificacion_template_versions')
        .select('id, version_number, snapshot, published_at')
        .in('id', versionIds),
      admin
        .from('completed_verificacion_measurements')
        .select('*')
        .in('completed_id', uniqueIds)
        .order('section_repeticion'),
      admin
        .from('instrumentos')
        .select('id, codigo, nombre, tipo, estado, conjunto_id')
        .in('id', instrumentoIds),
      creatorIds.length > 0
        ? admin.from('user_profiles').select('id, full_name').in('id', creatorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      loadMaestrosForCompletedIds(admin, uniqueIds),
    ])

  const versionById = new Map(
    (versions ?? []).map((v) => [
      v.id as string,
      v as { version_number: number | null; snapshot: unknown },
    ]),
  )
  const measurementsByCompleted = new Map<string, unknown[]>()
  for (const id of uniqueIds) measurementsByCompleted.set(id, [])
  for (const m of allMeasurements ?? []) {
    const cid = (m as { completed_id: string }).completed_id
    measurementsByCompleted.get(cid)!.push(m)
  }
  const instrumentoById = new Map((instrumentos ?? []).map((i) => [i.id as string, i]))
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  const assembledById = new Map<string, CompletedVerificacionDetalle>()
  for (const id of uniqueIds) {
    const vRow = byId.get(id)! as Record<string, unknown> & {
      id: string
      template_version_id: string
      instrumento_id: string
      created_by: string | null
    }
    const version = versionById.get(vRow.template_version_id) ?? null
    assembledById.set(
      id,
      assembleDetalle(
        vRow,
        version,
        measurementsByCompleted.get(id) ?? [],
        instrumentoById.get(vRow.instrumento_id) ?? null,
        vRow.created_by ? (profileById.get(vRow.created_by) ?? null) : null,
        maestroIdsByCompleted.get(id) ?? [],
        maestrosByCompleted.get(id) ?? [],
      ),
    )
  }

  return ids.map((id) => assembledById.get(id)!)
}
