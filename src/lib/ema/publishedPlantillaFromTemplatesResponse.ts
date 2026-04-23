/** First published plantilla with an active version (same rules as /verificar). */
export type PublishedPlantillaSummary = {
  id: string
  codigo: string
  nombre: string
  active_version_id: string | null
  active_version_number: number | null
}

export function publishedPlantillaSummaryFromTemplatesPayload(
  j: { data?: unknown } | null | undefined,
): PublishedPlantillaSummary | null {
  if (!j) return null
  const raw = j.data
  const list: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : []
  const publicadas = (list as Record<string, unknown>[]).filter(
    (t) => t.estado === 'publicado' && typeof t.active_version_id === 'string' && t.active_version_id,
  )
  if (publicadas.length === 0) return null
  const t = publicadas[0] as {
    id: string
    codigo: string
    nombre: string
    active_version_id: string
    active_version?: { version_number?: number }
  }
  return {
    id: t.id,
    codigo: t.codigo,
    nombre: t.nombre,
    active_version_id: t.active_version_id,
    active_version_number: t.active_version?.version_number ?? null,
  }
}
