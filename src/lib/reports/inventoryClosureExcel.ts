import ExcelJS from 'exceljs'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { DC_DOCUMENT_THEME as C } from './branding'
import type { InventoryClosureDetail } from '@/types/inventoryClosure'

function argb(hex: string, alpha = 'FF') {
  return alpha + hex.replace('#', '')
}

function fmtDate(d: string) {
  try { return format(parseISO(d), "d 'de' MMMM yyyy", { locale: es }) } catch { return d }
}

function navyFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } }
}
function altFill(alt: boolean): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: alt ? argb(C.surfaceSubtle) : argb(C.white) } }
}
function greenFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.green) } }
}

function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: navyFill(),
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: { bottom: { style: 'medium', color: { argb: argb(C.green) } } },
  }
}

function dataStyle(alt: boolean): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, name: 'Calibri', color: { argb: argb(C.textSecondary) } },
    fill: altFill(alt),
    alignment: { vertical: 'middle' },
    border: { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } },
  }
}

function totalStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, name: 'Calibri', color: { argb: argb(C.white) } },
    fill: navyFill(),
    alignment: { vertical: 'middle', horizontal: 'right' },
    border: { top: { style: 'medium', color: { argb: argb(C.green) } } },
  }
}

function titleRow(ws: ExcelJS.Worksheet, text: string, cols: number, row: number) {
  ws.getRow(row).height = 22
  const cell = ws.getCell(row, 1)
  cell.value = text
  cell.style = {
    font: { bold: true, size: 14, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: navyFill(),
    alignment: { vertical: 'middle', horizontal: 'left' },
  }
  ws.mergeCells(row, 1, row, cols)
}

function metaRow(ws: ExcelJS.Worksheet, label: string, value: string | number, rowIdx: number, cols: number) {
  ws.getRow(rowIdx).height = 14
  const lCell = ws.getCell(rowIdx, 1)
  lCell.value = label
  lCell.style = {
    font: { italic: true, size: 9, color: { argb: argb(C.textMuted) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle' },
  }
  const vCell = ws.getCell(rowIdx, 2)
  vCell.value = value
  vCell.style = {
    font: { bold: true, size: 9, name: 'Calibri', color: { argb: argb(C.textPrimary) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle' },
  }
  ws.mergeCells(rowIdx, 2, rowIdx, cols)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 1: Resumen
// ─────────────────────────────────────────────────────────────────────────────
async function buildResumenSheet(
  wb: ExcelJS.Workbook,
  detail: InventoryClosureDetail,
  signatureBuffer?: Buffer,
  signatureExtension?: string,
) {
  const ws = wb.addWorksheet('Resumen')
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.columns = [
    { width: 28 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
  ]

  titleRow(ws, 'Cierre de Inventario — Resumen Ejecutivo', 5, 1)

  let r = 2
  metaRow(ws, 'Planta', detail.plant?.name ?? '—', r++, 5)
  metaRow(ws, 'Período', `${fmtDate(detail.period_start)} — ${fmtDate(detail.period_end)}`, r++, 5)
  if (detail.parent_closure_id) {
    metaRow(ws, 'Tipo', `Enmienda del cierre ${detail.parent_closure_id}`, r++, 5)
  }
  metaRow(ws, 'Sellado por', detail.signed_by_user
    ? `${detail.signed_by_user.first_name} ${detail.signed_by_user.last_name}`
    : '—', r++, 5)
  metaRow(ws, 'Fecha sellado', detail.signed_at ? fmtDate(detail.signed_at) : 'Pendiente', r++, 5)
  metaRow(ws, 'Umbral de varianza', `${detail.variance_threshold_pct}%`, r++, 5)

  // Embed signature image if available
  if (signatureBuffer && signatureExtension) {
    try {
      const imgId = wb.addImage({ buffer: signatureBuffer, extension: signatureExtension as 'jpeg' | 'png' | 'gif' })
      ws.addImage(imgId, {
        tl: { col: 2, row: r },
        ext: { width: 200, height: 80 },
        editAs: 'oneCell',
      })
      ws.getRow(r).height = 65
      ws.getRow(r).getCell(1).value = 'Firma'
      ws.getRow(r).getCell(1).style = {
        font: { italic: true, size: 9, color: { argb: argb(C.textMuted) }, name: 'Calibri' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
        alignment: { vertical: 'middle' },
      }
      r++
    } catch {
      // Signature embed failed — skip gracefully, don't break export
    }
  }

  r++ // blank

  // KPI summary headers
  const kpiHeaders = ['Entradas (kg)', 'Consumo (kg)', 'Ajustes neto (kg)', 'Desperdicio (kg)', 'Varianza total (kg)']
  const kpiRow = ws.getRow(r++)
  kpiRow.height = 16
  kpiHeaders.forEach((h, i) => {
    const cell = kpiRow.getCell(i + 1)
    cell.value = h
    cell.style = headerStyle()
  })

  const totalEntries = detail.materials.reduce((s, m) => s + (m.period_entries_kg ?? 0), 0)
  const totalConsumption = detail.materials.reduce((s, m) => s + (m.period_consumption_kg ?? 0), 0)
  const totalAdjustments = detail.materials.reduce((s, m) => s + (m.period_adjustments_kg ?? 0), 0)
  const totalWaste = detail.materials.reduce((s, m) => s + (m.period_waste_kg ?? 0), 0)
  const totalVariance = detail.materials.reduce((s, m) => s + (m.variance_kg ?? 0), 0)

  const kpiValues = [totalEntries, totalConsumption, totalAdjustments, totalWaste, totalVariance]
  const kpiValRow = ws.getRow(r++)
  kpiValRow.height = 18
  kpiValues.forEach((v, i) => {
    const cell = kpiValRow.getCell(i + 1)
    cell.value = Number(v.toFixed(4))
    cell.numFmt = '#,##0.00'
    cell.style = {
      font: { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.navy) } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
      alignment: { vertical: 'middle', horizontal: 'right' },
      border: { bottom: { style: 'medium', color: { argb: argb(C.green) } } },
    }
  })

  r++
  // Materials with variance flag
  if (detail.materials.some((m) => m.requires_justification)) {
    const flagRow = ws.getRow(r++)
    flagRow.getCell(1).value = '⚠ Materiales con varianza significativa:'
    flagRow.getCell(1).style = {
      font: { bold: true, size: 9, color: { argb: argb(C.textPrimary) }, name: 'Calibri' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } },
    }
    ws.mergeCells(r - 1, 1, r - 1, 5)

    for (const m of detail.materials.filter((m) => m.requires_justification)) {
      const mRow = ws.getRow(r++)
      mRow.getCell(1).value = `  · ${m.material?.material_name ?? m.material_id}`
      mRow.getCell(2).value = m.variance_pct != null ? `${m.variance_pct.toFixed(2)}%` : '—'
      mRow.getCell(3).value = m.justification_text ?? '(sin justificación)'
      ws.mergeCells(r - 1, 3, r - 1, 5)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 2: Conciliación (the core sheet)
// ─────────────────────────────────────────────────────────────────────────────
function buildConciliacionSheet(wb: ExcelJS.Workbook, detail: InventoryClosureDetail) {
  const ws = wb.addWorksheet('Conciliación')
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const cols = [
    { header: 'Material', key: 'material', width: 28 },
    { header: 'Categoría', key: 'category', width: 14 },
    { header: 'Stock inicial (kg)', key: 'initial', width: 18 },
    { header: 'Entradas (kg)', key: 'entries', width: 16 },
    { header: 'Consumo (kg)', key: 'consumption', width: 16 },
    { header: 'Ajustes neto (kg)', key: 'adjustments', width: 18 },
    { header: 'Desperdicio (kg)', key: 'waste', width: 16 },
    { header: 'Teórico final (kg)', key: 'theoretical', width: 18 },
    { header: 'Conteo físico (val)', key: 'physVal', width: 18 },
    { header: 'Unidad', key: 'unit', width: 10 },
    { header: 'Peso vol. (kg/m³)', key: 'volW', width: 16 },
    { header: 'Fuente peso vol.', key: 'volSource', width: 18 },
    { header: 'Físico (kg)', key: 'physKg', width: 16 },
    { header: 'Varianza (kg)', key: 'varKg', width: 16 },
    { header: 'Varianza (%)', key: 'varPct', width: 14 },
    { header: 'Requiere justif.', key: 'reqJust', width: 16 },
    { header: 'Justificación', key: 'justification', width: 40 },
    { header: 'Ajuste creado', key: 'adjId', width: 38 },
  ]

  ws.columns = cols.map((c) => ({ width: c.width }))

  // Title row
  titleRow(ws, 'Conciliación de inventario — Detalle por material', cols.length, 1)

  // Column headers
  const hRow = ws.getRow(2)
  hRow.height = 30
  cols.forEach((c, i) => {
    const cell = hRow.getCell(i + 1)
    cell.value = c.header
    cell.style = headerStyle()
  })

  let rowIdx = 3
  for (const m of detail.materials) {
    const alt = rowIdx % 2 === 0
    const row = ws.getRow(rowIdx++)
    row.height = 14

    const vals = [
      m.material?.material_name ?? m.material_id,
      m.material?.category ?? '—',
      m.initial_stock_kg ?? 0,
      m.period_entries_kg ?? 0,
      m.period_consumption_kg ?? 0,
      m.period_adjustments_kg ?? 0,
      m.period_waste_kg ?? 0,
      m.theoretical_final_kg ?? 0,
      m.physical_count_value ?? '—',
      m.physical_count_unit ?? '—',
      m.volumetric_weight_kg_per_m3 ?? '—',
      m.volumetric_weight_source ?? '—',
      m.physical_count_kg ?? '—',
      m.variance_kg ?? 0,
      m.variance_pct ?? '—',
      m.requires_justification ? 'Sí' : 'No',
      m.justification_text ?? '—',
      m.adjustment_id ?? '—',
    ]

    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = typeof v === 'number' ? Number(v.toFixed(4)) : v
      if (typeof v === 'number') cell.numFmt = '#,##0.00'
      cell.style = dataStyle(alt)
      if (i === 13 || i === 14) {
        const num = Number(v)
        if (!isNaN(num)) {
          cell.font = {
            ...dataStyle(alt).font,
            color: { argb: num > 0 ? argb('#166534') : num < 0 ? argb('#991B1B') : argb(C.textSecondary) },
          }
        }
      }
    })
  }

  // Totals
  const totRow = ws.getRow(rowIdx)
  totRow.height = 16
  const totStyle = totalStyle()
  for (let i = 1; i <= cols.length; i++) {
    const cell = totRow.getCell(i)
    cell.style = totStyle
  }
  totRow.getCell(1).value = 'TOTAL'
  const numCols: number[] = [3, 4, 5, 6, 7, 8, 13, 14]
  const materialsList = detail.materials
  for (const ci of numCols) {
    const key = cols[ci - 1].key
    const sum = materialsList.reduce((s, m) => {
      const map: Record<string, number> = {
        initial: m.initial_stock_kg ?? 0, entries: m.period_entries_kg ?? 0,
        consumption: m.period_consumption_kg ?? 0, adjustments: m.period_adjustments_kg ?? 0,
        waste: m.period_waste_kg ?? 0, theoretical: m.theoretical_final_kg ?? 0,
        physKg: m.physical_count_kg ?? 0, varKg: m.variance_kg ?? 0,
      }
      return s + (map[key] ?? 0)
    }, 0)
    totRow.getCell(ci).value = Number(sum.toFixed(4))
    totRow.getCell(ci).numFmt = '#,##0.00'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 3: Entradas del período
// ─────────────────────────────────────────────────────────────────────────────
async function buildEntradasSheet(wb: ExcelJS.Workbook, detail: InventoryClosureDetail, supabase: any) {
  const ws = wb.addWorksheet('Entradas')
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const { data: entries } = await supabase
    .from('material_entries')
    .select('entry_number, entry_date, material:materials(material_name), quantity_received, received_qty_kg, unit_price, total_cost, supplier_invoice, entered_by_user:user_profiles!entered_by(first_name, last_name)')
    .eq('plant_id', detail.plant_id)
    .gte('entry_date', detail.period_start)
    .lte('entry_date', detail.period_end)
    .order('entry_date')

  const cols = [
    { header: '# Entrada', width: 18 },
    { header: 'Fecha', width: 14 },
    { header: 'Material', width: 28 },
    { header: 'Cantidad recibida', width: 18 },
    { header: 'Cantidad (kg)', width: 16 },
    { header: 'Precio unit.', width: 14 },
    { header: 'Costo total', width: 14 },
    { header: 'Remisión proveedor', width: 22 },
    { header: 'Capturado por', width: 22 },
  ]

  titleRow(ws, 'Entradas del período', cols.length, 1)
  ws.columns = cols.map((c) => ({ width: c.width }))

  const hRow = ws.getRow(2)
  hRow.height = 30
  cols.forEach((c, i) => { const cell = hRow.getCell(i + 1); cell.value = c.header; cell.style = headerStyle() })

  let r = 3
  for (const e of (entries ?? [])) {
    const alt = r % 2 === 0
    const row = ws.getRow(r++)
    row.height = 14
    const userName = e.entered_by_user ? `${e.entered_by_user.first_name} ${e.entered_by_user.last_name}` : '—'
    const vals = [e.entry_number, e.entry_date, e.material?.material_name ?? '—', e.quantity_received, e.received_qty_kg, e.unit_price ?? '—', e.total_cost ?? '—', e.supplier_invoice ?? '—', userName]
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = typeof v === 'number' ? Number(v) : v
      if (typeof v === 'number' && i >= 3) cell.numFmt = '#,##0.00'
      cell.style = dataStyle(alt)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 4: Consumos (reuse existing per-remision data)
// ─────────────────────────────────────────────────────────────────────────────
async function buildConsumosSheet(wb: ExcelJS.Workbook, detail: InventoryClosureDetail, supabase: any) {
  const ws = wb.addWorksheet('Consumos')
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const { data: rows } = await supabase
    .from('remision_materiales')
    .select('material:materials(material_name), cantidad_teorica, cantidad_real, remision:remisiones!remision_id(folio, fecha, cliente:orders(client:clients(name)))')
    .eq('remision.plant_id', detail.plant_id)
    .gte('remision.fecha', detail.period_start)
    .lte('remision.fecha', detail.period_end)
    .order('remision.fecha')

  const cols = [
    { header: 'Folio remisión', width: 18 },
    { header: 'Fecha', width: 14 },
    { header: 'Cliente', width: 28 },
    { header: 'Material', width: 28 },
    { header: 'Cant. teórica (kg)', width: 18 },
    { header: 'Cant. real (kg)', width: 18 },
  ]

  titleRow(ws, 'Consumos por remisión del período', cols.length, 1)
  ws.columns = cols.map((c) => ({ width: c.width }))

  const hRow = ws.getRow(2)
  hRow.height = 30
  cols.forEach((c, i) => { const cell = hRow.getCell(i + 1); cell.value = c.header; cell.style = headerStyle() })

  let r = 3
  for (const row of (rows ?? [])) {
    const alt = r % 2 === 0
    const ws_row = ws.getRow(r++)
    ws_row.height = 14
    const vals = [row.remision?.folio ?? '—', row.remision?.fecha ?? '—', row.remision?.cliente?.client?.name ?? '—', row.material?.material_name ?? '—', row.cantidad_teorica, row.cantidad_real]
    vals.forEach((v, i) => {
      const cell = ws_row.getCell(i + 1)
      cell.value = typeof v === 'number' ? Number(v) : v
      if (typeof v === 'number' && i >= 4) cell.numFmt = '#,##0.00'
      cell.style = dataStyle(alt)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 5: Ajustes del período (including closure-generated)
// ─────────────────────────────────────────────────────────────────────────────
async function buildAjustesSheet(wb: ExcelJS.Workbook, detail: InventoryClosureDetail, supabase: any) {
  const ws = wb.addWorksheet('Ajustes')
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const { data: adjustments } = await supabase
    .from('material_adjustments')
    .select('adjustment_number, adjustment_date, adjustment_type, quantity_adjusted, inventory_before, inventory_after, reference_notes, adjusted_by_user:user_profiles!adjusted_by(first_name, last_name), material:materials(material_name)')
    .eq('plant_id', detail.plant_id)
    .gte('adjustment_date', detail.period_start)
    .lte('adjustment_date', detail.period_end)
    .order('adjustment_date')

  const closureAdjIds = new Set(detail.materials.map((m) => m.adjustment_id).filter(Boolean))

  const cols = [
    { header: '# Ajuste', width: 20 },
    { header: 'Fecha', width: 14 },
    { header: 'Material', width: 28 },
    { header: 'Tipo', width: 20 },
    { header: 'Cantidad (kg)', width: 16 },
    { header: 'Stock antes', width: 14 },
    { header: 'Stock después', width: 14 },
    { header: 'Notas / referencia', width: 40 },
    { header: 'Realizado por', width: 22 },
    { header: 'Del cierre', width: 12 },
  ]

  titleRow(ws, 'Ajustes del período', cols.length, 1)
  ws.columns = cols.map((c) => ({ width: c.width }))

  const hRow = ws.getRow(2)
  hRow.height = 30
  cols.forEach((c, i) => { const cell = hRow.getCell(i + 1); cell.value = c.header; cell.style = headerStyle() })

  let r = 3
  for (const a of (adjustments ?? [])) {
    const alt = r % 2 === 0
    const row = ws.getRow(r++)
    row.height = 14
    const userName = a.adjusted_by_user ? `${a.adjusted_by_user.first_name} ${a.adjusted_by_user.last_name}` : '—'
    const isClosure = closureAdjIds.has(a.id)
    const vals = [a.adjustment_number, a.adjustment_date, a.material?.material_name ?? '—', a.adjustment_type, a.quantity_adjusted, a.inventory_before, a.inventory_after, a.reference_notes ?? '—', userName, isClosure ? 'Sí' : 'No']
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = typeof v === 'number' ? Number(v) : v
      if (typeof v === 'number' && i >= 4) cell.numFmt = '#,##0.00'
      let style = dataStyle(alt)
      if (isClosure) {
        style = { ...style, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } } }
      }
      cell.style = style
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 6: Evidencias
// ─────────────────────────────────────────────────────────────────────────────
function buildEvidenciasSheet(wb: ExcelJS.Workbook, detail: InventoryClosureDetail) {
  const ws = wb.addWorksheet('Evidencias')
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const allEvidence = [
    ...detail.evidence,
    ...detail.materials.flatMap((m) => m.evidence ?? []),
  ]

  const cols = [
    { header: 'Material', width: 28 },
    { header: 'Nombre archivo', width: 35 },
    { header: 'Tipo', width: 18 },
    { header: 'Subido por (ID)', width: 36 },
    { header: 'Fecha de subida', width: 22 },
    { header: 'URL firmada (1h)', width: 80 },
  ]

  titleRow(ws, 'Evidencias del cierre', cols.length, 1)
  ws.columns = cols.map((c) => ({ width: c.width }))

  const hRow = ws.getRow(2)
  hRow.height = 30
  cols.forEach((c, i) => { const cell = hRow.getCell(i + 1); cell.value = c.header; cell.style = headerStyle() })

  let r = 3
  const materialNameMap = new Map(detail.materials.map((m) => [m.material_id, m.material?.material_name ?? m.material_id]))

  for (const ev of allEvidence) {
    const alt = r % 2 === 0
    const row = ws.getRow(r++)
    row.height = 14
    const matName = ev.material_id ? (materialNameMap.get(ev.material_id) ?? ev.material_id) : '(cierre general)'
    const vals = [matName, ev.original_name, ev.file_type ?? '—', ev.uploaded_by, ev.uploaded_at ? fmtDate(ev.uploaded_at) : '—', ev.signed_url ?? ev.file_path]
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      cell.style = dataStyle(alt)
      if (i === 5 && v && typeof v === 'string' && v.startsWith('http')) {
        cell.value = { text: 'Abrir', hyperlink: v }
        cell.style = { ...dataStyle(alt), font: { ...dataStyle(alt).font, underline: true, color: { argb: argb('#1D4ED8') } } }
      }
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export async function buildInventoryClosureExcel(
  detail: InventoryClosureDetail,
  supabase?: any,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DC Concretos — Sistema de Control'
  wb.created = new Date()

  // Fetch signature image for embedding in Resumen sheet
  let signatureBuffer: Buffer | undefined
  let signatureExtension: string | undefined
  if (detail.signature_image_url) {
    try {
      const sigRes = await fetch(detail.signature_image_url)
      if (sigRes.ok) {
        const arrayBuf = await sigRes.arrayBuffer()
        signatureBuffer = Buffer.from(arrayBuf)
        const contentType = sigRes.headers.get('content-type') ?? ''
        signatureExtension = contentType.includes('png') ? 'png' : 'jpeg'
      }
    } catch {
      // Signature fetch failed — skip gracefully
    }
  }

  await buildResumenSheet(wb, detail, signatureBuffer, signatureExtension)
  buildConciliacionSheet(wb, detail)

  if (supabase) {
    await buildEntradasSheet(wb, detail, supabase)
    await buildConsumosSheet(wb, detail, supabase)
    await buildAjustesSheet(wb, detail, supabase)
  } else {
    // Placeholder sheets when supabase not available (e.g., client-side preview)
    for (const name of ['Entradas', 'Consumos', 'Ajustes']) {
      const ws = wb.addWorksheet(name)
      ws.getCell(1, 1).value = 'Datos disponibles al descargar desde el servidor'
    }
  }

  buildEvidenciasSheet(wb, detail)

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
