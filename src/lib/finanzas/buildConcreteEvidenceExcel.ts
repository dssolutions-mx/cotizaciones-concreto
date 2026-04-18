import { format } from 'date-fns'

/** One order row — same shape as API / UI (evidence_files expanded). */
export type ConcreteEvidenceOrderExportRow = {
  order_id: string
  order_number: string
  delivery_date: string
  client_name: string | null
  construction_site: string | null
  plant_code: string | null
  plant_name: string | null
  concrete_remisiones_count: number
  remision_numbers: string[]
  concrete_volume_sum: number | null
  has_evidence: boolean
  evidence_count: number
  evidence_files: Array<{
    id: string
    created_at: string
    updated_at: string
    original_name: string
    uploaded_by_name: string | null
    file_path: string
    mime_type: string | null
  }>
  evidence_last_at: string | null
  evidence_last_uploader_name: string | null
}

export type ConcreteEvidenceExportMeta = {
  generatedAtIso: string
  dateFrom: string
  dateTo: string
  plantLabel: string
  clientLabel: string
  evidenceStatusLabel: string
  searchText: string
  totalMatchingFilters: number
  rowsInFile: number
  cappedAtMax: boolean
  apiReportedTruncated: boolean
}

/** Postgres `DATE`: keep calendar yyyy-MM-dd (avoid parsing as UTC Date). */
function ymd(d: string | null | undefined): string {
  if (!d) return ''
  return d.slice(0, 10)
}

function lastUploadFormatted(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm')
  } catch {
    return iso
  }
}

function evidenceEstadoLabel(r: ConcreteEvidenceOrderExportRow): string {
  if (r.concrete_remisiones_count <= 0) return 'Sin remisiones de concreto'
  if (!r.has_evidence) return 'Con remisiones — falta evidencia'
  return 'Con remisiones — con evidencia'
}

function plantDisplay(r: ConcreteEvidenceOrderExportRow): string {
  const c = (r.plant_code || '').trim()
  const n = (r.plant_name || '').trim()
  if (c && n) return `${c} — ${n}`
  return c || n || ''
}

function setColWidths(ws: import('xlsx').WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }))
}

function applyAutofilter(ws: import('xlsx').WorkSheet) {
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] }
}

/**
 * Workbook for audit: Resumen (context), Pedidos (one row per order), Remisiones (one row per remisión),
 * Archivos_evidencia (one row per file).
 */
export async function buildConcreteEvidenceExcelArrayBuffer(
  rows: ConcreteEvidenceOrderExportRow[],
  meta: ConcreteEvidenceExportMeta
): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')

  const notas: string[] = []
  if (meta.cappedAtMax) {
    notas.push(`Exportación limitada a ${meta.rowsInFile} pedidos; acote fechas o filtros para obtener el resto.`)
  }
  if (meta.apiReportedTruncated) {
    notas.push('El servidor indicó que el universo de pedidos evaluado puede estar truncado (límite interno).')
  }
  if (meta.searchText.trim()) {
    notas.push(`Tras cargar todos los pedidos del filtro, se aplicó búsqueda: "${meta.searchText.trim()}".`)
  }

  const resumenRows = [
    ['Campo', 'Valor'],
    ['Fecha y hora de exportación', format(new Date(meta.generatedAtIso), 'yyyy-MM-dd HH:mm:ss')],
    ['Entregas desde', meta.dateFrom],
    ['Entregas hasta', meta.dateTo],
    ['Planta', meta.plantLabel],
    ['Cliente', meta.clientLabel],
    ['Filtro estado evidencia', meta.evidenceStatusLabel],
    ['Búsqueda en tabla', meta.searchText.trim() || '(ninguna)'],
    ['Total pedidos (filtros API)', meta.totalMatchingFilters],
    ['Pedidos incluidos en este archivo', meta.rowsInFile],
    ['Notas', notas.join(' ') || '—'],
  ]
  const wsRes = XLSX.utils.aoa_to_sheet(resumenRows)
  setColWidths(wsRes, [28, 72])

  const pedidos = rows.map((r) => ({
    ID_pedido: r.order_id,
    Fecha_entrega: ymd(r.delivery_date),
    Pedido: r.order_number,
    Planta: plantDisplay(r),
    Cliente: r.client_name ?? '',
    Obra: r.construction_site ?? '',
    Remisiones_cantidad: r.concrete_remisiones_count,
    Volumen_m3:
      r.concrete_volume_sum != null && Number.isFinite(r.concrete_volume_sum) ? r.concrete_volume_sum : '',
    Evidencia_archivos: r.evidence_count,
    Estado: evidenceEstadoLabel(r),
    Ultima_carga: lastUploadFormatted(r.evidence_last_at),
    Subidor: r.evidence_last_uploader_name ?? '',
    Remisiones_numeros: (r.remision_numbers || []).join('; '),
  }))
  const wsPed = XLSX.utils.json_to_sheet(pedidos)
  setColWidths(wsPed, [14, 12, 14, 24, 28, 36, 12, 10, 12, 10, 28, 18, 18, 40])
  applyAutofilter(wsPed)

  const remisionesFlat: Record<string, string | number>[] = []
  for (const r of rows) {
    const nums = r.remision_numbers || []
    for (const num of nums) {
      remisionesFlat.push({
        ID_pedido: r.order_id,
        Pedido: r.order_number,
        Fecha_entrega: ymd(r.delivery_date),
        Cliente: r.client_name ?? '',
        Obra: r.construction_site ?? '',
        Planta: plantDisplay(r),
        Numero_remision: num,
      })
    }
  }
  const wsRem = XLSX.utils.json_to_sheet(remisionesFlat)
  setColWidths(wsRem, [14, 14, 12, 28, 36, 24, 14])
  applyAutofilter(wsRem)

  const archivos: Record<string, string>[] = []
  for (const r of rows) {
    for (const f of r.evidence_files || []) {
      archivos.push({
        ID_pedido: r.order_id,
        Pedido: r.order_number,
        Fecha_entrega_pedido: ymd(r.delivery_date),
        ID_archivo: f.id,
        Nombre_archivo: f.original_name,
        Tipo_MIME: f.mime_type ?? '',
        Fecha_carga: lastUploadFormatted(f.updated_at || f.created_at),
        Subidor: f.uploaded_by_name ?? '',
        Ruta_almacenamiento: f.file_path,
      })
    }
  }
  const wsArc = XLSX.utils.json_to_sheet(archivos)
  setColWidths(wsArc, [14, 14, 14, 14, 36, 18, 18, 22, 48])
  applyAutofilter(wsArc)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')
  XLSX.utils.book_append_sheet(wb, wsPed, 'Pedidos')
  XLSX.utils.book_append_sheet(wb, wsRem, 'Remisiones')
  XLSX.utils.book_append_sheet(wb, wsArc, 'Archivos_evidencia')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}
