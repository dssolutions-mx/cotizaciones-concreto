import type { ParsedCfdi } from '@/types/finance'
import {
  buildMatchDetails,
  cfdiEntryDateDiffDays,
  scoreFromMatchDetails,
  type MatchDetailField,
  type ScoreBreakdownItem,
} from './cfdiEntryMatchDetails'
import {
  allocatedCfdiLabel,
  isCfdiAlreadyAllocated,
  isCfdiUploadDuplicate,
  shouldOmitCfdiFromBulkCreate,
  uploadDuplicateCfdiLabel,
} from './bulkCfdiValidation'

/** Minimal entry shape for matching — avoids coupling to UI component types. */
export type MatchableOrphanEntry = {
  id: string
  entry_number: string
  entry_date: string
  plant_id: string
  total_cost: number | null
  supplier_invoice: string | null
  received_qty_entered?: number | null
  received_qty_kg?: number | null
  received_uom?: string | null
  unit_price?: number | null
  material?: { id: string; material_name: string } | null
  supplier?: {
    group_id: string | null
    supplier_group?: { id: string; name: string; rfc?: string | null } | null
  } | null
}

export type ParsedCfdiForMatch = {
  id: string
  file_name: string
  cfdi: ParsedCfdi
  supplier_group: { id: string; name: string; rfc: string | null } | null
  receptor_match: 'ok' | 'mismatch' | 'skipped'
  duplicate_invoice: { id: string; invoice_number: string } | null
  /** Same folio already exists for supplier + plant in DB. */
  duplicate_invoice_folio: { id: string; invoice_number: string } | null
  duplicate_cfdi_in_upload: boolean
  duplicate_folio_in_upload: boolean
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'manual'

export type BulkAssignment = {
  entry_id: string
  cfdi_id: string | null
  confidence: MatchConfidence | null
  warnings: string[]
  match_details?: {
    fields: MatchDetailField[]
    score_breakdown: ScoreBreakdownItem[]
  }
  /** User can exclude a matched row from batch create without unassigning. */
  include_in_create?: boolean
}


function cfdiFolioLabel(cfdi: ParsedCfdi): string {
  return [cfdi.serie, cfdi.folio].filter(Boolean).join('-')
}

function cfdiTaxableBase(cfdi: ParsedCfdi): number {
  return Math.max(0, cfdi.subtotal - (cfdi.descuento || 0))
}

function entryGroupId(entry: MatchableOrphanEntry): string | null {
  return entry.supplier?.group_id ?? entry.supplier?.supplier_group?.id ?? null
}

export function cfdiEligibleForEntry(
  entry: MatchableOrphanEntry,
  parsed: ParsedCfdiForMatch,
): { eligible: boolean; reason?: string } {
  if (parsed.receptor_match === 'mismatch') {
    return { eligible: false, reason: 'RFC receptor no coincide con la empresa' }
  }
  if (parsed.cfdi.tipo_comprobante !== 'I') {
    return { eligible: false, reason: 'No es factura de ingreso (tipo I)' }
  }
  const entryGroup = entryGroupId(entry)
  const cfdiGroup = parsed.supplier_group?.id ?? null
  if (entryGroup && cfdiGroup && entryGroup !== cfdiGroup) {
    return { eligible: false, reason: 'Proveedor no coincide' }
  }
  return { eligible: true }
}

function scorePair(entry: MatchableOrphanEntry, parsed: ParsedCfdiForMatch): number {
  if (shouldOmitCfdiFromBulkCreate(parsed)) return -1
  const { eligible } = cfdiEligibleForEntry(entry, parsed)
  if (!eligible) return -1
  return scoreFromMatchDetails(entry, parsed.cfdi)
}

function confidenceFromScore(score: number): MatchConfidence {
  if (score >= 150) return 'high'
  if (score >= 90) return 'medium'
  if (score >= 45) return 'low'
  return 'manual'
}

function warningsForPair(entry: MatchableOrphanEntry, parsed: ParsedCfdiForMatch): string[] {
  const warnings: string[] = []
  const allocated = allocatedCfdiLabel(parsed)
  if (allocated) warnings.push(allocated)
  const uploadDup = uploadDuplicateCfdiLabel(parsed)
  if (uploadDup) warnings.push(uploadDup)

  const { reason, eligible } = cfdiEligibleForEntry(entry, parsed)
  if (!eligible && reason) warnings.push(reason)

  const details = buildMatchDetails(entry, parsed.cfdi)
  for (const f of details.fields) {
    if (f.status !== 'mismatch') continue
    if (f.label.startsWith('Cantidad')) continue
    warnings.push(`${f.label}: recepción ${f.entry_value ?? '—'} vs CFDI ${f.cfdi_value ?? '—'}`)
  }

  const entryAmount = Number(entry.total_cost ?? 0)
  const cfdiBase = cfdiTaxableBase(parsed.cfdi)
  if (entryAmount > 0 && Math.abs(entryAmount - cfdiBase) > 1) {
    if (!warnings.some(w => w.includes('Subtotal'))) {
      warnings.push(
        `Subtotal recepción (${entryAmount.toFixed(2)}) difiere del CFDI (${cfdiBase.toFixed(2)})`,
      )
    }
  }

  return warnings
}

function assignmentForPair(
  entry: MatchableOrphanEntry,
  parsed: ParsedCfdiForMatch,
  confidence: MatchConfidence | null,
): BulkAssignment {
  const match_details = parsed
    ? buildMatchDetails(entry, parsed.cfdi)
    : undefined
  const omit = parsed ? shouldOmitCfdiFromBulkCreate(parsed) : false
  return {
    entry_id: entry.id,
    cfdi_id: parsed?.id ?? null,
    confidence,
    warnings: parsed ? warningsForPair(entry, parsed) : ['Sin CFDI asignado'],
    match_details,
    include_in_create: !omit && confidence !== null && confidence !== 'manual',
  }
}

/**
 * Greedy unique assignment: highest-scoring (entry, cfdi) pairs first.
 */
export function matchCfdiToEntries(
  entries: MatchableOrphanEntry[],
  parsedCfdis: ParsedCfdiForMatch[],
): BulkAssignment[] {
  type ScoredPair = { entryId: string; cfdiId: string; score: number; dateDays: number }
  const pairs: ScoredPair[] = []

  for (const entry of entries) {
    for (const parsed of parsedCfdis) {
      const score = scorePair(entry, parsed)
      if (score >= 0) {
        pairs.push({
          entryId: entry.id,
          cfdiId: parsed.id,
          score,
          dateDays: cfdiEntryDateDiffDays(entry.entry_date, parsed.cfdi.fecha_emision),
        })
      }
    }
  }

  // Higher score first; when several CFDIs share amount/supplier, prefer closest invoice date.
  pairs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.dateDays !== b.dateDays) return a.dateDays - b.dateDays
    return a.cfdiId.localeCompare(b.cfdiId)
  })

  const assignedEntries = new Set<string>()
  const assignedCfdis = new Set<string>()
  const assignmentByEntry = new Map<string, { cfdiId: string; score: number }>()

  for (const p of pairs) {
    if (assignedEntries.has(p.entryId) || assignedCfdis.has(p.cfdiId)) continue
    if (p.score < 45) continue
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
        warnings: ['Sin CFDI asignado — se omitirá al facturar'],
        include_in_create: false,
      }
    }
    const parsed = parsedCfdis.find(p => p.id === match.cfdiId)!
    return {
      ...assignmentForPair(entry, parsed, confidenceFromScore(match.score)),
      cfdi_id: match.cfdiId,
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
  const concepto = parsed.cfdi.conceptos[0]
  const desc = concepto?.descripcion
    ? (concepto.descripcion.length > 28 ? `${concepto.descripcion.slice(0, 28)}…` : concepto.descripcion)
    : null
  const parts = [folio || parsed.file_name, desc, `$${base.toFixed(2)}`].filter(Boolean)
  return parts.join(' · ')
}

export function getOrphanCfdis(
  parsedCfdis: ParsedCfdiForMatch[],
  assignments: BulkAssignment[],
): ParsedCfdiForMatch[] {
  const used = new Set(assignments.map(a => a.cfdi_id).filter(Boolean) as string[])
  return parsedCfdis.filter(p => !used.has(p.id) && !shouldOmitCfdiFromBulkCreate(p))
}

/** Parsed CFDIs already in the system — shown for reference, excluded from create. */
export function getAlreadyAllocatedCfdis(parsedCfdis: ParsedCfdiForMatch[]): ParsedCfdiForMatch[] {
  return parsedCfdis.filter(isCfdiAlreadyAllocated)
}

export function getUploadDuplicateCfdis(parsedCfdis: ParsedCfdiForMatch[]): ParsedCfdiForMatch[] {
  return parsedCfdis.filter(p => isCfdiUploadDuplicate(p) && !isCfdiAlreadyAllocated(p))
}

export {
  buildMatchDetails,
  cfdiTaxableBase,
  cfdiFolioLabel,
  isCfdiAlreadyAllocated,
  shouldOmitCfdiFromBulkCreate,
  allocatedCfdiLabel,
}
