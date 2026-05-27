'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  AlertTriangle, CheckCircle2, FileUp, Loader2, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrphanEntry } from './CreateSupplierInvoiceDrawer'
import { formatOrphanEntryRemisionLabel } from '@/lib/ap/orphanEntryRemisionNumbers'
import type { ParsedCfdiBulkItem } from '@/app/api/ap/cfdi/parse-bulk/route'
import {
  matchCfdiToEntries,
  getEligibleCfdisForEntry,
  cfdiDisplayLabel,
  type BulkAssignment,
  type MatchConfidence,
  type ParsedCfdiForMatch,
} from '@/lib/ap/matchCfdiToEntries'
import { retentionsFromCfdi, toRetentionPayload } from '@/components/finanzas/InvoiceRetentionsEditor'

type Step = 'upload' | 'assign' | 'creating' | 'results'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: OrphanEntry[]
  onSuccess: () => void
}

type BulkCreateResult = {
  created: Array<{ entry_id: string; invoice_id: string; invoice_number: string }>
  failed: Array<{ entry_id: string; error: string }>
  warnings: Array<{ entry_id: string; messages: string[] }>
}

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const NONE_VALUE = '__none__'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function toMatchInput(parsed: ParsedCfdiBulkItem[]): ParsedCfdiForMatch[] {
  return parsed.map(p => ({
    id: p.id,
    file_name: p.file_name,
    cfdi: p.cfdi,
    supplier_group: p.supplier_group,
    receptor_match: p.receptor_match,
    duplicate_invoice: p.duplicate_invoice,
  }))
}

function confidenceLabel(c: MatchConfidence | null): string {
  if (!c) return '—'
  const map: Record<MatchConfidence, string> = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
    manual: 'Manual',
  }
  return map[c]
}

function confidenceClass(c: MatchConfidence | null): string {
  if (c === 'high') return 'text-emerald-700 bg-emerald-50'
  if (c === 'medium') return 'text-amber-700 bg-amber-50'
  if (c === 'low' || c === 'manual') return 'text-stone-600 bg-stone-100'
  return 'text-red-700 bg-red-50'
}

function buildInvoicePayload(entry: OrphanEntry, parsed: ParsedCfdiBulkItem) {
  const cfdi = parsed.cfdi
  const subtotal = Number(entry.total_cost ?? 0)
  const vatRate = entry.supplier?.default_vat_rate ?? cfdi.vat_rate ?? 0.16
  const invoiceDate = cfdi.fecha_emision.slice(0, 10)
  const dueDate = entry.ap_due_date_material ?? addDays(invoiceDate, 30)
  const supplierGroupId = entry.supplier?.group_id ?? parsed.supplier_group?.id ?? ''

  const taxableBase = subtotal
  const retentionRows = cfdi.retenciones?.length
    ? retentionsFromCfdi(cfdi.retenciones, taxableBase)
    : []

  return {
    entry_id: entry.id,
    supplier_group_id: supplierGroupId,
    plant_id: entry.plant_id,
    invoice_number: [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid.slice(0, 8),
    invoice_date: invoiceDate,
    due_date: dueDate,
    vat_rate: vatRate,
    subtotal,
    discount_amount: 0,
    retentions: toRetentionPayload(retentionRows),
    items: [{
      entry_id: entry.id,
      line_source: 'entry' as const,
      cost_category: 'material' as const,
      description: (() => {
        const rem = formatOrphanEntryRemisionLabel(entry.remision_numbers)
        const base = `${entry.material?.material_name ?? 'Material'} — ${entry.entry_number}`
        return rem ? `${base} · Rem. ${rem}` : base
      })(),
      qty: entry.received_qty_entered,
      unit_price: entry.unit_price,
      amount: subtotal,
    }],
    cfdi_uuid: cfdi.uuid,
    cfdi_serie: cfdi.serie,
    cfdi_folio: cfdi.folio,
    cfdi_forma_pago: cfdi.forma_pago,
    cfdi_metodo_pago: cfdi.metodo_pago,
    cfdi_uso: cfdi.uso_cfdi,
    cfdi_tipo_comprobante: cfdi.tipo_comprobante,
    cfdi_fecha_emision: cfdi.fecha_emision,
    cfdi_fecha_timbrado: cfdi.fecha_timbrado,
    cfdi_emisor_rfc: cfdi.emisor_rfc,
    cfdi_receptor_rfc: cfdi.receptor_rfc,
    cfdi_capture_mode: 'cfdi' as const,
  }
}

function rowWarnings(
  entry: OrphanEntry,
  assignment: BulkAssignment,
  parsed: ParsedCfdiForMatch[],
  duplicateCfdiIds: Set<string>,
): string[] {
  const warnings = [...assignment.warnings]
  if (!assignment.cfdi_id) return warnings
  if (duplicateCfdiIds.has(assignment.cfdi_id)) {
    warnings.push('CFDI asignado a más de una recepción')
  }
  const p = parsed.find(x => x.id === assignment.cfdi_id)
  if (p?.receptor_match === 'mismatch') {
    warnings.push('RFC receptor no coincide con la empresa')
  }
  if (p?.duplicate_invoice) {
    warnings.push(`CFDI ya registrado (${p.duplicate_invoice.invoice_number})`)
  }
  const amt = Number(entry.total_cost ?? 0)
  const cfdiBase = Math.max(0, (p?.cfdi.subtotal ?? 0) - (p?.cfdi.descuento ?? 0))
  if (p && amt > 0 && Math.abs(amt - cfdiBase) > 1) {
    if (!warnings.some(w => w.includes('Monto'))) {
      warnings.push(`Monto recepción (${amt.toFixed(2)}) difiere del CFDI (${cfdiBase.toFixed(2)})`)
    }
  }
  return warnings
}

export default function BulkCfdiInvoiceDialog({ open, onOpenChange, entries, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [parsing, setParsing] = useState(false)
  const [parsedCfdis, setParsedCfdis] = useState<ParsedCfdiBulkItem[]>([])
  const [parseErrors, setParseErrors] = useState<Array<{ file: string; message: string }>>([])
  const [assignments, setAssignments] = useState<BulkAssignment[]>([])
  const [filterUnassigned, setFilterUnassigned] = useState(false)
  const [filterWarnings, setFilterWarnings] = useState(false)
  const [createResult, setCreateResult] = useState<BulkCreateResult | null>(null)

  const parsedForMatch = useMemo(() => toMatchInput(parsedCfdis), [parsedCfdis])
  const entryById = useMemo(() => new Map(entries.map(e => [e.id, e])), [entries])
  const plantId = entries[0]?.plant_id ?? ''

  const reset = useCallback(() => {
    setStep('upload')
    setParsing(false)
    setParsedCfdis([])
    setParseErrors([])
    setAssignments([])
    setFilterUnassigned(false)
    setFilterWarnings(false)
    setCreateResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return

    setParsing(true)
    setParseErrors([])
    try {
      const form = new FormData()
      const zipFile = list.find(f => f.name.toLowerCase().endsWith('.zip'))
      if (zipFile && list.length === 1) {
        form.append('zip_file', zipFile)
      } else {
        for (const f of list) {
          if (f.name.toLowerCase().endsWith('.xml')) {
            form.append('xml_files[]', f)
          }
        }
        if (form.getAll('xml_files[]').length === 0) {
          toast.error('No se encontraron archivos XML')
          return
        }
      }

      const res = await fetch('/api/ap/cfdi/parse-bulk', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al leer CFDIs')
        return
      }

      const parsed: ParsedCfdiBulkItem[] = data.parsed ?? []
      const errors: Array<{ file: string; message: string }> = data.errors ?? []
      setParsedCfdis(parsed)
      setParseErrors(errors)

      if (parsed.length === 0) {
        toast.error('No se pudo leer ningún CFDI válido')
        return
      }

      const auto = matchCfdiToEntries(entries, toMatchInput(parsed))
      setAssignments(auto)
      setStep('assign')
      toast.success(`${parsed.length} CFDI(s) listos${errors.length ? `, ${errors.length} con error` : ''}`)
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const duplicateCfdiIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of assignments) {
      if (!a.cfdi_id) continue
      counts.set(a.cfdi_id, (counts.get(a.cfdi_id) ?? 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id))
  }, [assignments])

  const enrichedRows = useMemo(() => {
    return assignments.map(a => {
      const entry = entryById.get(a.entry_id)!
      const warnings = rowWarnings(entry, a, parsedForMatch, duplicateCfdiIds)
      return { assignment: a, entry, warnings }
    })
  }, [assignments, entryById, parsedForMatch, duplicateCfdiIds])

  const visibleRows = useMemo(() => {
    return enrichedRows.filter(r => {
      if (filterUnassigned && r.assignment.cfdi_id) return false
      if (filterWarnings && r.warnings.length === 0) return false
      return true
    })
  }, [enrichedRows, filterUnassigned, filterWarnings])

  const unassignedCount = assignments.filter(a => !a.cfdi_id).length
  const blockingIssues = enrichedRows.some(r =>
    !r.assignment.cfdi_id
    || r.warnings.some(w =>
      w.includes('RFC receptor')
      || w.includes('ya registrado')
      || w.includes('más de una recepción'),
    ),
  )

  const setAssignmentCfdi = (entryId: string, cfdiId: string | null) => {
    setAssignments(prev => prev.map(a => {
      if (a.entry_id !== entryId) return a
      if (!cfdiId) {
        return { ...a, cfdi_id: null, confidence: null, warnings: ['Sin CFDI asignado'] }
      }
      const parsed = parsedForMatch.find(p => p.id === cfdiId)
      const entry = entryById.get(entryId)!
      const eligible = getEligibleCfdisForEntry(entry, parsedForMatch)
      if (!eligible.some(p => p.id === cfdiId)) {
        return { ...a, cfdi_id: cfdiId, confidence: 'manual', warnings: ['Asignación manual'] }
      }
      const auto = matchCfdiToEntries([entry], parsedForMatch)
      const match = auto[0]
      return {
        entry_id: entryId,
        cfdi_id: cfdiId,
        confidence: match.cfdi_id === cfdiId ? match.confidence : 'manual',
        warnings: parsed ? rowWarnings(entry, { ...a, cfdi_id: cfdiId }, parsedForMatch, new Set()) : [],
      }
    }))
  }

  const handleCreate = async () => {
    if (blockingIssues) {
      toast.error('Corrige las asignaciones antes de continuar')
      return
    }

    setStep('creating')
    try {
      const payloads = assignments
        .filter(a => a.cfdi_id)
        .map(a => {
          const entry = entryById.get(a.entry_id)!
          const parsed = parsedCfdis.find(p => p.id === a.cfdi_id)!
          return buildInvoicePayload(entry, parsed)
        })

      const res = await fetch('/api/ap/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plant_id: plantId, assignments: payloads }),
      })
      const data: BulkCreateResult = await res.json()
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Error al crear facturas')
        setStep('assign')
        return
      }

      setCreateResult(data)
      setStep('results')
      const n = data.created?.length ?? 0
      const f = data.failed?.length ?? 0
      if (n > 0 && f === 0) toast.success(`${n} factura(s) creada(s)`)
      else if (n > 0) toast.warning(`${n} creada(s), ${f} error(es)`)
      else toast.error('No se creó ninguna factura')
    } catch {
      toast.error('Error de red')
      setStep('assign')
    }
  }

  const handleDone = () => {
    handleOpenChange(false)
    if (createResult && createResult.created.length > 0) onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Facturar en lote con XML</DialogTitle>
          <DialogDescription>
            {entries.length} recepción{entries.length !== 1 ? 'es' : ''} seleccionada{entries.length !== 1 ? 's' : ''}
            {step === 'upload' && ' — sube un ZIP o varios archivos XML'}
            {step === 'assign' && ' — revisa y confirma las asignaciones'}
            {step === 'results' && ' — resumen del proceso'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {step === 'upload' && (
            <label
              htmlFor="bulk-cfdi-upload"
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
                parsing
                  ? 'border-sky-300 bg-sky-50 cursor-wait'
                  : 'border-stone-300 hover:border-sky-400 hover:bg-sky-50/30',
              )}
            >
              {parsing ? (
                <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
              ) : (
                <FileUp className="h-8 w-8 text-stone-400" />
              )}
              <div className="text-sm text-stone-700">
                {parsing ? 'Leyendo CFDIs…' : 'Arrastra o haz clic para subir ZIP o XMLs'}
              </div>
              <div className="text-xs text-stone-500">
                Acepta .zip con XMLs o varios archivos .xml a la vez
              </div>
              <input
                id="bulk-cfdi-upload"
                ref={fileRef}
                type="file"
                accept=".zip,.xml,text/xml,application/xml,application/zip"
                multiple
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const files = e.target.files
                  if (files?.length) void handleFiles(files)
                }}
              />
            </label>
          )}

          {step === 'assign' && (
            <>
              {parseErrors.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
                  <div className="font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {parseErrors.length} archivo(s) omitido(s)
                  </div>
                  <ul className="list-disc pl-4 max-h-20 overflow-y-auto">
                    {parseErrors.map((e, i) => (
                      <li key={i}>{e.file}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-unassigned"
                    checked={filterUnassigned}
                    onCheckedChange={(v) => setFilterUnassigned(Boolean(v))}
                  />
                  <Label htmlFor="filter-unassigned" className="font-normal cursor-pointer">
                    Sin asignar ({unassignedCount})
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-warnings"
                    checked={filterWarnings}
                    onCheckedChange={(v) => setFilterWarnings(Boolean(v))}
                  />
                  <Label htmlFor="filter-warnings" className="font-normal cursor-pointer">
                    Con advertencia
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs ml-auto"
                  onClick={() => {
                    const auto = matchCfdiToEntries(entries, parsedForMatch)
                    setAssignments(auto)
                    toast.message('Asignaciones recalculadas')
                  }}
                >
                  Re-asignar automático
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-stone-600">Recepción</th>
                      <th className="text-left px-3 py-2 font-medium text-stone-600">Material</th>
                      <th className="text-right px-3 py-2 font-medium text-stone-600">Monto</th>
                      <th className="text-left px-3 py-2 font-medium text-stone-600 min-w-[200px]">CFDI</th>
                      <th className="text-left px-3 py-2 font-medium text-stone-600">Confianza</th>
                      <th className="text-left px-3 py-2 font-medium text-stone-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(({ assignment, entry, warnings }) => {
                      const remisionLabel = formatOrphanEntryRemisionLabel(entry.remision_numbers)
                      const eligible = getEligibleCfdisForEntry(entry, parsedForMatch)
                      const selectedParsed = parsedForMatch.find(p => p.id === assignment.cfdi_id)
                      const hasBlocker = warnings.some(w =>
                        w.includes('RFC receptor')
                        || w.includes('ya registrado')
                        || w.includes('más de una recepción'),
                      )
                      return (
                        <tr
                          key={entry.id}
                          className={cn(
                            'border-b last:border-0',
                            !assignment.cfdi_id && 'bg-red-50/50',
                            hasBlocker && assignment.cfdi_id && 'bg-red-50/30',
                            assignment.confidence === 'high' && !hasBlocker && 'bg-emerald-50/30',
                          )}
                        >
                          <td className="px-3 py-2 font-mono">
                            <div>{entry.entry_number}</div>
                            {remisionLabel && (
                              <div className="text-[10px] text-stone-500 font-normal">
                                Rem. {remisionLabel}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[120px]">
                            {entry.material?.material_name ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {mxn.format(Number(entry.total_cost ?? 0))}
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={assignment.cfdi_id ?? NONE_VALUE}
                              onValueChange={(v) => setAssignmentCfdi(entry.id, v === NONE_VALUE ? null : v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Seleccionar CFDI" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE}>— Sin asignar —</SelectItem>
                                {eligible.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {cfdiDisplayLabel(p)}
                                  </SelectItem>
                                ))}
                                {assignment.cfdi_id && !eligible.some(p => p.id === assignment.cfdi_id) && selectedParsed && (
                                  <SelectItem value={assignment.cfdi_id}>
                                    {cfdiDisplayLabel(selectedParsed)} (no elegible)
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn(
                              'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
                              confidenceClass(assignment.confidence),
                            )}>
                              {confidenceLabel(assignment.confidence)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {warnings.length === 0 ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> OK
                              </span>
                            ) : (
                              <ul className="text-[10px] text-amber-800 space-y-0.5">
                                {warnings.map((w, i) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {unassignedCount > 0 && (
                <p className="text-xs text-red-600">
                  Faltan {unassignedCount} asignación{unassignedCount !== 1 ? 'es' : ''}
                </p>
              )}
            </>
          )}

          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
              <p className="text-sm text-stone-600">Creando facturas…</p>
            </div>
          )}

          {step === 'results' && createResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="text-2xl font-semibold text-emerald-800 tabular-nums">
                    {createResult.created.length}
                  </div>
                  <div className="text-xs text-emerald-700">Facturas creadas</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="text-2xl font-semibold text-red-800 tabular-nums">
                    {createResult.failed.length}
                  </div>
                  <div className="text-xs text-red-700">Errores</div>
                </div>
              </div>

              {createResult.created.length > 0 && (
                <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  <div className="font-medium text-stone-700">Creadas</div>
                  {createResult.created.map(c => {
                    const entry = entryById.get(c.entry_id)
                    return (
                      <div key={c.invoice_id} className="text-stone-600">
                        {entry?.entry_number ?? c.entry_id} → {c.invoice_number}
                      </div>
                    )
                  })}
                </div>
              )}

              {createResult.failed.length > 0 && (
                <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  <div className="font-medium text-red-700">Errores</div>
                  {createResult.failed.map((f, i) => {
                    const entry = entryById.get(f.entry_id)
                    return (
                      <div key={i} className="text-red-600">
                        {entry?.entry_number ?? f.entry_id}: {f.error}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'upload' && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === 'assign' && (
            <>
              <Button type="button" variant="outline" onClick={() => { reset(); setStep('upload') }}>
                Volver a subir
              </Button>
              <Button
                type="button"
                className="bg-sky-700 hover:bg-sky-800"
                disabled={blockingIssues || assignments.length === 0}
                onClick={() => void handleCreate()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Crear {assignments.filter(a => a.cfdi_id).length} factura(s)
              </Button>
            </>
          )}
          {step === 'results' && (
            <Button type="button" onClick={handleDone}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
