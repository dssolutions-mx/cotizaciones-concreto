import type { ParsedCfdi } from '@/types/finance'

/** Minimal entry shape for matching — avoids coupling to UI component types. */
export type MatchableOrphanEntry = {
  id: string
  entry_number: string
  entry_date: string
  plant_id: string
  total_cost: number | null
  supplier_invoice: string | null
  supplier?: {
    group_id: string | null
    supplier_group?: { id: string; name: string; rfc?: string | null } | null
  } | null
}

export type ParsedCfdiForMatch = {
  /** Stable id for UI — file name or uuid */
  id: string
  file_name: string
  cfdi: ParsedCfdi
  supplier_group: { id: string; name: string; rfc: string | null } | null
  receptor_match: 'ok' | 'mismatch' | 'company_rfc_not_set'
  duplicate_invoice: { id: string; invoice_number: string } | null
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'manual'

export type BulkAssignment = {
  entry_id: string
  cfdi_id: string | null
  confidence: MatchConfidence | null
  warnings: string[]
}

const AMOUNT_TOLERANCE = 1.0
const DATE_PROXIMITY_DAYS = 30

function cfdiFolioLabel(cfdi: ParsedCfdi): string {
  return [cfdi.serie, cfdi.folio].filter(Boolean).join('-')
}

function cfdiTaxableBase(cfdi: ParsedCfdi): number {
  return Math.max(0, cfdi.subtotal - (cfdi.descuento || 0))
}

function normalizeFolio(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a.slice(0, 10))
  const db = new Date(b.slice(0, 10))
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24)
}

function entryGroupId(entry: MatchableOrphanEntry): string | null {
  return entry.supplier?.group_id ?? entry.supplier?.supplier_group?.id ?? null
}

function cfdiEligibleForEntry(
  entry: MatchableOrphanEntry,
  parsed: ParsedCfdiForMatch,
): { eligible: boolean; reason?: string } {
  if (parsed.receptor_match === 'mismatch') {
    return { eligible: false, reason: 'RFC receptor no coincide' }
  }
  if (parsed.duplicate_invoice) {
    return { eligible: false, reason: `CFDI ya registrado (${parsed.duplicate_invoice.invoice_number})` }
  }
  if (parsed.cfdi.tipo_comprobante !== 'I') {
    return { eligible: false, reason: 'No es factura de ingreso (tipo I)' }
  }
  const entryGroup = entryGroupId(entry)
  const cfdiGroup = parsed.supplier_group?.id ?? null
  if (entryGroup && cfdiGroup && entryGroup !== cfdiGroup) {
    return { eligible: false, reason: 'Proveedor no coincide' }
  }
  if (entryGroup && !cfdiGroup) {
    return { eligible: false, reason: 'CFDI sin grupo de proveedor conocido' }
  }
  return { eligible: true }
}

function scorePair(entry: MatchableOrphanEntry, parsed: ParsedCfdiForMatch): number {
  const { eligible } = cfdiEligibleForEntry(entry, parsed)
  if (!eligible) return -1

  let score = 0
  const cfdi = parsed.cfdi
  const entryAmount = Number(entry.total_cost ?? 0)
  const cfdiBase = cfdiTaxableBase(cfdi)

  const folioCfdi = normalizeFolio(cfdiFolioLabel(cfdi))
  const folioEntry = normalizeFolio(entry.supplier_invoice)
  if (folioCfdi && folioEntry && folioCfdi === folioEntry) {
    score += 100
  }

  if (entryAmount > 0 && Math.abs(entryAmount - cfdiBase) <= AMOUNT_TOLERANCE) {
    score += 80
  } else if (entryAmount > 0 && Math.abs(entryAmount - cfdiBase) <= 10) {
    score += 40
  }

  const days = daysBetween(cfdi.fecha_emision, entry.entry_date)
  if (days <= DATE_PROXIMITY_DAYS) {
    score += Math.max(0, 20 - Math.floor(days / 2))
  }

  return score
}

function confidenceFromScore(score: number): MatchConfidence {
  if (score >= 150) return 'high'
  if (score >= 80) return 'medium'
  if (score >= 40) return 'low'
  return 'manual'
}

function warningsForPair(entry: MatchableOrphanEntry, parsed: ParsedCfdiForMatch): string[] {
  const warnings: string[] = []
  const { reason, eligible } = cfdiEligibleForEntry(entry, parsed)
  if (!eligible && reason) warnings.push(reason)

  const entryAmount = Number(entry.total_cost ?? 0)
  const cfdiBase = cfdiTaxableBase(parsed.cfdi)
  if (entryAmount > 0 && Math.abs(entryAmount - cfdiBase) > AMOUNT_TOLERANCE) {
    warnings.push(
      `Monto recepción (${entryAmount.toFixed(2)}) difiere del CFDI (${cfdiBase.toFixed(2)})`,
    )
  }
  if (parsed.receptor_match === 'company_rfc_not_set') {
    warnings.push('RFC empresa no configurado')
  }
  return warnings
}

/**
 * Greedy unique assignment: highest-scoring (entry, cfdi) pairs first.
 */
export function matchCfdiToEntries(
  entries: MatchableOrphanEntry[],
  parsedCfdis: ParsedCfdiForMatch[],
): BulkAssignment[] {
  type ScoredPair = { entryId: string; cfdiId: string; score: number }
  const pairs: ScoredPair[] = []

  for (const entry of entries) {
    for (const parsed of parsedCfdis) {
      const score = scorePair(entry, parsed)
      if (score >= 0) {
        pairs.push({ entryId: entry.id, cfdiId: parsed.id, score })
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score)

  const assignedEntries = new Set<string>()
  const assignedCfdis = new Set<string>()
  const assignmentByEntry = new Map<string, { cfdiId: string; score: number }>()

  for (const p of pairs) {
    if (assignedEntries.has(p.entryId) || assignedCfdis.has(p.cfdiId)) continue
    if (p.score < 40) continue
    assignedEntries.add(p.entryId)
    assignedCfdis.add(p.cfdiId)
    assignmentByEntry.set(p.entryId, { cfdiId: p.cfdiId, score: p.score })
  }

  return entries.map(entry => {
    const match = assignmentByEntry.get(entry.id)
    if (!match) {
      return {
        entry_id: entry.id,
        cfdi_id: null,
        confidence: null,
        warnings: ['Sin CFDI asignado'],
      }
    }
    const parsed = parsedCfdis.find(p => p.id === match.cfdiId)!
    return {
      entry_id: entry.id,
      cfdi_id: match.cfdiId,
      confidence: confidenceFromScore(match.score),
      warnings: warningsForPair(entry, parsed),
    }
  })
}

export function getEligibleCfdisForEntry(
  entry: MatchableOrphanEntry,
  parsedCfdis: ParsedCfdiForMatch[],
): ParsedCfdiForMatch[] {
  return parsedCfdis.filter(p => cfdiEligibleForEntry(entry, p).eligible)
}

export function cfdiDisplayLabel(parsed: ParsedCfdiForMatch): string {
  const folio = cfdiFolioLabel(parsed.cfdi)
  const base = cfdiTaxableBase(parsed.cfdi)
  return folio ? `${folio} — $${base.toFixed(2)}` : `${parsed.file_name} — $${base.toFixed(2)}`
}
