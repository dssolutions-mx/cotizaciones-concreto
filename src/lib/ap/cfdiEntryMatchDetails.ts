import type { CfdiConcepto, ParsedCfdi } from '@/types/finance'
import type { MatchableOrphanEntry } from './matchCfdiToEntries'
import {
  cfdiConceptoQtyKg,
  cfdiConceptoQtyLiters,
  cfdiConceptoUoms,
  entryQtyKg,
  entryQtyLiters,
  normalizedUnitPrice,
  uomDimension,
  uomsSameDimension,
} from './uomCompare'

export type MatchFieldStatus = 'match' | 'mismatch' | 'neutral' | 'info'

export type MatchDetailField = {
  label: string
  entry_value: string | null
  cfdi_value: string | null
  status: MatchFieldStatus
  note?: string
}

export type ScoreBreakdownItem = {
  signal: string
  points: number
}

const AMOUNT_TOLERANCE = 1.0
const QTY_REL_TOLERANCE = 0.03
const UNIT_PRICE_REL_TOLERANCE = 0.02

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter(t => t.length > 2))
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) {
    if (tb.has(t)) shared++
  }
  return shared / Math.max(ta.size, tb.size)
}

function cfdiFolio(cfdi: ParsedCfdi): string {
  return [cfdi.serie, cfdi.folio].filter(Boolean).join('-')
}

function primaryConcepto(cfdi: ParsedCfdi): CfdiConcepto | null {
  if (!cfdi.conceptos.length) return null
  if (cfdi.conceptos.length === 1) return cfdi.conceptos[0]
  return cfdi.conceptos.reduce((best, c) =>
    (c.importe - c.descuento) > (best.importe - best.descuento) ? c : best,
  )
}

function conceptoUomLabel(c: CfdiConcepto): string {
  return c.unidad ?? c.clave_unidad ?? '—'
}

function primaryCfdiUom(concepto: CfdiConcepto): string {
  return concepto.unidad ?? concepto.clave_unidad ?? ''
}

function qtyCompare(
  entry: MatchableOrphanEntry,
  concepto: CfdiConcepto | null,
): { score: number; field: MatchDetailField } {
  const entryQty = entry.received_qty_entered
  const entryUom = entry.received_uom ?? '—'
  const cQty = concepto?.cantidad ?? null
  const cUom = concepto ? conceptoUomLabel(concepto) : '—'

  const entryVal = entryQty != null ? `${entryQty} ${entryUom}` : null
  const cfdiVal = cQty != null ? `${cQty} ${cUom}` : null

  if (entryQty == null || !concepto || cQty == null) {
    return {
      score: 0,
      field: {
        label: 'Cantidad',
        entry_value: entryVal,
        cfdi_value: cfdiVal,
        status: 'neutral',
        note: 'Sin cantidad comparable',
      },
    }
  }

  const entryKg = entryQtyKg(entry)
  const cfdiKg = cfdiConceptoQtyKg(concepto)
  if (entryKg != null && cfdiKg != null) {
    const relDiff = Math.abs(entryKg - cfdiKg) / Math.max(entryKg, cfdiKg)
    const match = relDiff <= QTY_REL_TOLERANCE
    return {
      score: match ? 50 : relDiff <= 0.08 ? 25 : 0,
      field: {
        label: 'Cantidad (masa)',
        entry_value: `${entryKg.toFixed(2)} kg eq.`,
        cfdi_value: `${cfdiKg.toFixed(2)} kg eq.`,
        status: match ? 'match' : 'neutral',
        note: match
          ? `Original: ${entryVal} ↔ ${cfdiVal}`
          : `Diferencia ${(relDiff * 100).toFixed(1)}% en kg equivalentes`,
      },
    }
  }

  const entryL = entryQtyLiters(entry)
  const cfdiL = cfdiConceptoQtyLiters(concepto)
  if (entryL != null && cfdiL != null) {
    const relDiff = Math.abs(entryL - cfdiL) / Math.max(entryL, cfdiL)
    const match = relDiff <= QTY_REL_TOLERANCE
    return {
      score: match ? 45 : relDiff <= 0.08 ? 20 : 0,
      field: {
        label: 'Cantidad (volumen)',
        entry_value: `${entryL.toFixed(2)} L eq.`,
        cfdi_value: `${cfdiL.toFixed(2)} L eq.`,
        status: match ? 'match' : 'neutral',
        note: match ? `Original: ${entryVal} ↔ ${cfdiVal}` : undefined,
      },
    }
  }

  const cfdiUom = primaryCfdiUom(concepto)
  if (
    uomsSameDimension(entry.received_uom, cfdiUom)
    && uomDimension(entry.received_uom) === 'count'
    && Math.abs(entryQty - cQty) / Math.max(entryQty, cQty) <= QTY_REL_TOLERANCE
  ) {
    return {
      score: 40,
      field: {
        label: 'Cantidad',
        entry_value: entryVal,
        cfdi_value: cfdiVal,
        status: 'match',
      },
    }
  }

  if (
    entry.received_uom
    && cfdiConceptoUoms(concepto).some(u => u === entry.received_uom?.toUpperCase())
    && Math.abs(entryQty - cQty) / Math.max(entryQty, cQty) <= QTY_REL_TOLERANCE
  ) {
    return {
      score: 45,
      field: {
        label: 'Cantidad',
        entry_value: entryVal,
        cfdi_value: cfdiVal,
        status: 'match',
      },
    }
  }

  const entryDim = uomDimension(entry.received_uom)
  const cfdiDim = uomDimension(cfdiUom)
  if (entryDim !== 'unknown' && cfdiDim !== 'unknown' && entryDim !== cfdiDim) {
    return {
      score: 0,
      field: {
        label: 'Cantidad',
        entry_value: entryVal,
        cfdi_value: cfdiVal,
        status: 'neutral',
        note: 'Dimensiones distintas (masa vs volumen) — revisar por monto',
      },
    }
  }

  return {
    score: 0,
    field: {
      label: 'Cantidad',
      entry_value: entryVal,
      cfdi_value: cfdiVal,
      status: 'neutral',
      note: 'Unidades no convertibles automáticamente',
    },
  }
}

function unitPriceCompare(
  entry: MatchableOrphanEntry,
  concepto: CfdiConcepto | null,
): { score: number; field: MatchDetailField } {
  const entryUp = entry.unit_price
  const cfdiUp = concepto?.valor_unitario ?? null

  if (entryUp == null || cfdiUp == null || entryUp <= 0 || cfdiUp <= 0) {
    return {
      score: 0,
      field: {
        label: 'Precio unitario',
        entry_value: entryUp != null ? entryUp.toFixed(2) : null,
        cfdi_value: cfdiUp != null ? cfdiUp.toFixed(2) : null,
        status: 'neutral',
      },
    }
  }

  const entryNorm = normalizedUnitPrice(entryUp, entry.received_uom)
  const cfdiNorm = normalizedUnitPrice(cfdiUp, concepto ? primaryCfdiUom(concepto) : null)

  if (
    entryNorm
    && cfdiNorm
    && entryNorm.dimension === cfdiNorm.dimension
    && entryNorm.dimension !== 'count'
  ) {
    const rel = Math.abs(entryNorm.price - cfdiNorm.price) / Math.max(entryNorm.price, cfdiNorm.price)
    const match = rel <= UNIT_PRICE_REL_TOLERANCE
    const unitLabel = entryNorm.dimension === 'mass' ? '/kg' : '/L'
    return {
      score: match ? 40 : rel <= 0.05 ? 20 : 0,
      field: {
        label: 'Precio unitario',
        entry_value: `${entryNorm.price.toFixed(4)}${unitLabel} (${entryUp} / ${entry.received_uom ?? '?'})`,
        cfdi_value: `${cfdiNorm.price.toFixed(4)}${unitLabel} (${cfdiUp} / ${concepto ? conceptoUomLabel(concepto) : '?'})`,
        status: match ? 'match' : 'mismatch',
        note: match ? undefined : `Diferencia ${(rel * 100).toFixed(1)}% en precio normalizado`,
      },
    }
  }

  const rel = Math.abs(entryUp - cfdiUp) / Math.max(entryUp, cfdiUp)
  const match = rel <= UNIT_PRICE_REL_TOLERANCE
  return {
    score: match ? 40 : rel <= 0.05 ? 20 : 0,
    field: {
      label: 'Precio unitario',
      entry_value: entryUp.toFixed(2),
      cfdi_value: cfdiUp.toFixed(2),
      status: match ? 'match' : 'mismatch',
      note: match ? undefined : `Diferencia ${(rel * 100).toFixed(1)}%`,
    },
  }
}

export function buildMatchDetails(
  entry: MatchableOrphanEntry,
  cfdi: ParsedCfdi,
): { fields: MatchDetailField[]; score_breakdown: ScoreBreakdownItem[] } {
  const concepto = primaryConcepto(cfdi)
  const fields: MatchDetailField[] = []
  const score_breakdown: ScoreBreakdownItem[] = []

  const folioCfdi = cfdiFolio(cfdi)
  const folioEntry = entry.supplier_invoice?.trim() ?? ''
  const folioMatch = folioCfdi && folioEntry
    && normalizeText(folioCfdi) === normalizeText(folioEntry)
  fields.push({
    label: 'Folio',
    entry_value: folioEntry || null,
    cfdi_value: folioCfdi || null,
    status: folioMatch ? 'match' : folioEntry || folioCfdi ? 'mismatch' : 'neutral',
  })
  if (folioMatch) score_breakdown.push({ signal: 'Folio coincide', points: 100 })

  const matName = entry.material?.material_name ?? ''
  const desc = concepto?.descripcion ?? cfdi.conceptos.map(c => c.descripcion).join('; ')
  const overlap = tokenOverlapScore(matName, desc)
  fields.push({
    label: 'Material / descripción',
    entry_value: matName || null,
    cfdi_value: desc || null,
    status: overlap >= 0.35 ? 'match' : overlap >= 0.15 ? 'info' : matName && desc ? 'mismatch' : 'neutral',
    note: overlap > 0 ? `${Math.round(overlap * 100)}% similitud textual` : undefined,
  })
  if (overlap >= 0.35) score_breakdown.push({ signal: 'Descripción material', points: 60 })
  else if (overlap >= 0.15) score_breakdown.push({ signal: 'Descripción parcial', points: 30 })

  const qtyResult = qtyCompare(entry, concepto)
  fields.push(qtyResult.field)
  if (qtyResult.score > 0) {
    score_breakdown.push({ signal: 'Cantidad / UOM', points: qtyResult.score })
  }

  const priceResult = unitPriceCompare(entry, concepto)
  fields.push(priceResult.field)
  if (priceResult.score > 0) {
    score_breakdown.push({ signal: 'Precio unitario', points: priceResult.score })
  }

  const entryAmt = Number(entry.total_cost ?? 0)
  const lineAmt = concepto ? concepto.importe - concepto.descuento : null
  const cfdiSub = Math.max(0, cfdi.subtotal - (cfdi.descuento || 0))
  const cfdiAmt = lineAmt ?? cfdiSub

  fields.push({
    label: 'Subtotal línea',
    entry_value: entryAmt > 0 ? entryAmt.toFixed(2) : null,
    cfdi_value: cfdiAmt > 0 ? cfdiAmt.toFixed(2) : null,
    status: entryAmt > 0 && Math.abs(entryAmt - cfdiAmt) <= AMOUNT_TOLERANCE ? 'match' : 'mismatch',
  })
  if (entryAmt > 0 && Math.abs(entryAmt - cfdiAmt) <= AMOUNT_TOLERANCE) {
    score_breakdown.push({ signal: 'Subtotal', points: 80 })
  } else if (entryAmt > 0 && Math.abs(entryAmt - cfdiAmt) <= 10) {
    score_breakdown.push({ signal: 'Subtotal cercano', points: 40 })
  }

  fields.push({
    label: 'Total CFDI (con IVA)',
    entry_value: null,
    cfdi_value: cfdi.total.toFixed(2),
    status: 'info',
  })

  fields.push({
    label: 'Fecha',
    entry_value: entry.entry_date?.slice(0, 10) ?? null,
    cfdi_value: cfdi.fecha_emision.slice(0, 10),
    status: 'neutral',
  })

  fields.push({
    label: 'RFC emisor',
    entry_value: entry.supplier?.supplier_group?.rfc ?? null,
    cfdi_value: cfdi.emisor_rfc,
    status:
      entry.supplier?.supplier_group?.rfc
      && normalizeText(entry.supplier.supplier_group.rfc) === normalizeText(cfdi.emisor_rfc)
        ? 'match'
        : 'info',
  })

  return { fields, score_breakdown }
}

export function scoreFromMatchDetails(
  entry: MatchableOrphanEntry,
  cfdi: ParsedCfdi,
): number {
  const { score_breakdown } = buildMatchDetails(entry, cfdi)
  let total = score_breakdown.reduce((s, x) => s + x.points, 0)

  const days = Math.abs(
    new Date(cfdi.fecha_emision.slice(0, 10)).getTime()
    - new Date(entry.entry_date.slice(0, 10)).getTime(),
  ) / (1000 * 60 * 60 * 24)
  if (days <= 30) total += Math.max(0, 20 - Math.floor(days / 2))

  return total
}
