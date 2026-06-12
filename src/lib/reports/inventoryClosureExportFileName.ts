type ClosurePlantRef = { code?: string | null; name?: string | null } | null | undefined

type ClosurePeriodRef = {
  period_start: string
  period_end: string
  plant?: ClosurePlantRef
}

type MaterialLabelRef = {
  material_code?: string | null
  material_name?: string | null
} | null | undefined

/** Display label used across closure Excel sheets: code + name when both exist. */
export function formatClosureMaterialLabel(
  material?: MaterialLabelRef,
  fallbackId?: string,
): string {
  const name = material?.material_name?.trim()
  const code = material?.material_code?.trim()
  if (code && name) return `${code} — ${name}`
  return name || code || fallbackId || '—'
}

/** Safe plant prefix for export filenames (e.g. P005). */
export function inventoryClosurePlantFilePrefix(plant?: ClosurePlantRef): string {
  const code = plant?.code?.trim()
  if (code) return code.replace(/[^\w.-]+/g, '_')
  const name = plant?.name?.trim()
  if (name) return name.split(/\s+/)[0].replace(/[^\w.-]+/g, '_')
  return 'Planta'
}

export function buildInventoryClosureExportFileName(
  closure: ClosurePeriodRef,
  preliminary?: boolean,
): string {
  const kind = preliminary ? 'Preliminar' : 'Cierre'
  const plantPrefix = inventoryClosurePlantFilePrefix(closure.plant)
  return `${plantPrefix}_${kind}_Inventario_${closure.period_start}_${closure.period_end}.xlsx`
}

/** Parse filename from Content-Disposition when the browser download name should match the server. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const utf8 = /filename\*=UTF-8''([^;\n]+)/i.exec(header)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      return utf8[1].trim()
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) return quoted[1]
  const plain = /filename=([^;\n]+)/i.exec(header)
  return plain?.[1]?.trim().replace(/^"|"$/g, '') ?? null
}
