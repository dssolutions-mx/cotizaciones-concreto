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
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileUp, Loader2, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrphanEntry } from './CreateSupplierInvoiceDrawer'
import { orphanEntryLoggedRemisionLabel } from '@/lib/ap/orphanEntryRemisionNumbers'
import type { ParsedCfdiBulkItem } from '@/app/api/ap/cfdi/parse-bulk/route'
import {
  matchCfdiToEntries,
  getEligibleCfdisForEntry,
  getOrphanCfdis,
  getAlreadyAllocatedCfdis,
  getUploadDuplicateCfdis,
  buildMatchDetails,
  cfdiDisplayLabel,
  shouldOmitCfdiFromBulkCreate,
  type BulkAssignment,
  type MatchConfidence,
  type ParsedCfdiForMatch,
} from '@/lib/ap/matchCfdiToEntries'
import BulkCfdiMatchReview from '@/components/finanzas/BulkCfdiMatchReview'
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
    duplicate_invoice_folio: p.duplicate_invoice_folio,
    duplicate_cfdi_in_upload: p.duplicate_cfdi_in_upload,
    duplicate_folio_in_upload: p.duplicate_folio_in_upload,
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
        const rem = orphanEntryLoggedRemisionLabel(entry, 'material')
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
  if (p && shouldOmitCfdiFromBulkCreate(p)) {
    const omitMsg = p.duplicate_invoice
      ? `Ya facturado en sistema (${p.duplicate_invoice.invoice_number})`
      : p.duplicate_invoice_folio
        ? `Folio ya registrado (${p.duplicate_invoice_folio.invoice_number})`
        : p.duplicate_cfdi_in_upload
          ? 'CFDI repetido en el archivo — omitido'
          : 'Folio repetido en el archivo — omitido'
    if (!warnings.includes(omitMsg)) warnings.push(omitMsg)
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
  const [companyRfc, setCompanyRfc] = useState<string | null>(null)
  const [skippedNonInvoice, setSkippedNonInvoice] = useState<Array<{ file: string; tipo: string; emisor_rfc: string; folio: string | null }>>([])
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null)
  const [showOrphanCfdis, setShowOrphanCfdis] = useState(false)

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
    setCompanyRfc(null)
    setSkippedNonInvoice([])
    setExpandedReviewId(null)
    setShowOrphanCfdis(false)
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
      if (plantId) form.append('plant_id', plantId)
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
      setCompanyRfc(data.company_rfc ?? null)
      setSkippedNonInvoice(data.skipped_non_invoice ?? [])

      if (parsed.length === 0) {
        toast.error('No se pudo leer ningún CFDI válido')
        return
      }

      const forMatch = toMatchInput(parsed)
      const auto = matchCfdiToEntries(entries, forMatch)
      setAssignments(auto)
      setStep('assign')
      const allocatedN = getAlreadyAllocatedCfdis(forMatch).length
      toast.success(
        `${parsed.length} factura(s) de ingreso`
        + `${allocatedN ? `, ${allocatedN} ya facturada(s) (omitidas)` : ''}`
        + `${data.skipped_non_invoice?.length ? `, ${data.skipped_non_invoice.length} omitido(s) (no tipo I)` : ''}`
        + `${errors.length ? `, ${errors.length} con error` : ''}`,
      )
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

  const orphanCfdis = useMemo(
    () => getOrphanCfdis(parsedForMatch, assignments),
    [parsedForMatch, assignments],
  )

  const allocatedCfdis = useMemo(
    () => getAlreadyAllocatedCfdis(parsedForMatch),
    [parsedForMatch],
  )

  const uploadDuplicateCfdis = useMemo(
    () => getUploadDuplicateCfdis(parsedForMatch),
    [parsedForMatch],
  )

  const isOmitFromCreateWarning = (w: string) =>
    w.includes('Ya facturado en sistema')
    || w.includes('Folio ya registrado')
    || w.includes('repetido en el archivo — omitido')

  const isBlockerWarning = (w: string) =>
    w.includes('RFC receptor no coincide')
    || w.includes('más de una recepción')
    || w.includes('Proveedor no coincide')
    || w.startsWith('Precio unitario:')

  const rowsToCreate = useMemo(() =>
    enrichedRows.filter(r => {
      if (!r.assignment.cfdi_id || r.assignment.include_in_create === false) return false
      const parsed = parsedForMatch.find(p => p.id === r.assignment.cfdi_id)
      if (parsed && shouldOmitCfdiFromBulkCreate(parsed)) return false
      return !r.warnings.some(isBlockerWarning)
    }),
  [enrichedRows, parsedForMatch])

  const blockingIssues = enrichedRows.some(r => {
    if (!r.assignment.cfdi_id || r.assignment.include_in_create === false) return false
    const parsed = parsedForMatch.find(p => p.id === r.assignment.cfdi_id)
    if (parsed && shouldOmitCfdiFromBulkCreate(parsed)) return false
    return r.warnings.some(isBlockerWarning)
  })

  const unassignedCount = assignments.filter(a => !a.cfdi_id).length
  const matchedCount = assignments.filter(a => a.cfdi_id).length

  const setAssignmentCfdi = (entryId: string, cfdiId: string | null) => {
    setAssignments(prev => prev.map(a => {
      if (a.entry_id !== entryId) return a
      if (!cfdiId) {
        return {
          ...a,
          cfdi_id: null,
          confidence: null,
          warnings: ['Sin CFDI asignado — se omitirá al facturar'],
          match_details: undefined,
          include_in_create: false,
        }
      }
      const parsed = parsedForMatch.find(p => p.id === cfdiId)
      const entry = entryById.get(entryId)!
      if (!parsed) return a

      const match_details = buildMatchDetails(entry, parsed.cfdi)
      const auto = matchCfdiToEntries([entry], parsedForMatch)
      const confidence = auto[0]?.cfdi_id === cfdiId ? auto[0].confidence : 'manual'
      const warnings = rowWarnings(
        entry,
        { ...a, cfdi_id: cfdiId, confidence, warnings: [], match_details },
        parsedForMatch,
        duplicateCfdiIds,
      )

      const omit = shouldOmitCfdiFromBulkCreate(parsed)
      return {
        entry_id: entryId,
        cfdi_id: cfdiId,
        confidence,
        warnings,
        match_details,
        include_in_create: !omit,
      }
    }))
  }

  const toggleInclude = (entryId: string, include: boolean) => {
    setAssignments(prev => prev.map(a =>
      a.entry_id === entryId ? { ...a, include_in_create: include } : a,
    ))
  }

  const handleCreate = async () => {
    if (rowsToCreate.length === 0) {
      toast.error('No hay recepciones listas para facturar')
      return
    }
    if (blockingIssues) {
      toast.error('Corrige las asignaciones con errores bloqueantes antes de continuar')
      return
    }

    setStep('creating')
    try {
      const payloads = rowsToCreate.map(({ assignment, entry }) => {
        const parsed = parsedCfdis.find(p => p.id === assignment.cfdi_id)!
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
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
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
                Sube el ZIP completo del proveedor — los XML sin recepción se listan como huérfanos
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
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-1 font-medium">
                  {matchedCount} emparejada{matchedCount !== 1 ? 's' : ''}
                </span>
                <span className="rounded-full bg-stone-100 text-stone-700 px-2.5 py-1">
                  {unassignedCount} recepción{unassignedCount !== 1 ? 'es' : ''} sin CFDI
                </span>
                <span className="rounded-full bg-stone-100 text-stone-700 px-2.5 py-1">
                  {orphanCfdis.length} CFDI{orphanCfdis.length !== 1 ? 's' : ''} huérfano{orphanCfdis.length !== 1 ? 's' : ''}
                </span>
                {allocatedCfdis.length > 0 && (
                  <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-1">
                    {allocatedCfdis.length} ya facturado{allocatedCfdis.length !== 1 ? 's' : ''}
                  </span>
                )}
                {uploadDuplicateCfdis.length > 0 && (
                  <span className="rounded-full bg-stone-100 text-stone-600 px-2.5 py-1">
                    {uploadDuplicateCfdis.length} duplicado{uploadDuplicateCfdis.length !== 1 ? 's' : ''} en archivo
                  </span>
                )}
                {skippedNonInvoice.length > 0 && (
                  <span className="rounded-full bg-stone-100 text-stone-500 px-2.5 py-1">
                    {skippedNonInvoice.length} omitido(s) — no factura ingreso
                  </span>
                )}
              </div>

              {companyRfc ? (
                <div className="text-xs text-emerald-700 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  RFC empresa configurado: <span className="font-mono font-semibold">{companyRfc}</span>
                </div>
              ) : (
                <div className="text-xs text-stone-600 flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  RFC empresa no encontrado en configuración — validación de receptor omitida
                </div>
              )}

              {(allocatedCfdis.length > 0 || uploadDuplicateCfdis.length > 0) && (
                <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 space-y-2">
                  <div className="font-medium">
                    {allocatedCfdis.length + uploadDuplicateCfdis.length} CFDI
                    {allocatedCfdis.length + uploadDuplicateCfdis.length !== 1 ? 's' : ''}{' '}
                    omitido{allocatedCfdis.length + uploadDuplicateCfdis.length !== 1 ? 's' : ''} del lote
                    {allocatedCfdis.length > 0 ? ' (ya registrados en el sistema)' : ''}
                  </div>
                  <ul className="list-disc pl-4 max-h-28 overflow-y-auto space-y-0.5">
                    {allocatedCfdis.map(p => (
                      <li key={p.id}>
                        {cfdiDisplayLabel(p)}
                        {p.duplicate_invoice && (
                          <span className="text-sky-700"> → {p.duplicate_invoice.invoice_number}</span>
                        )}
                        {!p.duplicate_invoice && p.duplicate_invoice_folio && (
                          <span className="text-sky-700"> → {p.duplicate_invoice_folio.invoice_number}</span>
                        )}
                      </li>
                    ))}
                    {uploadDuplicateCfdis.map(p => (
                      <li key={`up-${p.id}-${p.file_name}`} className="text-stone-600">
                        {cfdiDisplayLabel(p)} · repetido en el ZIP
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                      <th className="w-8 px-2 py-2" />
                      <th className="text-left px-2 py-2 font-medium text-stone-600 w-8">Fact.</th>
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
                      const remisionLabel = orphanEntryLoggedRemisionLabel(entry, 'material')
                      const eligible = getEligibleCfdisForEntry(entry, parsedForMatch)
                      const selectedParsed = parsedForMatch.find(p => p.id === assignment.cfdi_id)
                      const omittedFromCreate = Boolean(
                        selectedParsed && shouldOmitCfdiFromBulkCreate(selectedParsed),
                      )
                      const hasBlocker = warnings.some(isBlockerWarning)
                      const issueWarnings = warnings.filter(w => !isOmitFromCreateWarning(w))
                      const isExpanded = expandedReviewId === entry.id
                      const canReview = Boolean(assignment.cfdi_id && assignment.match_details)
                      return (
                        <React.Fragment key={entry.id}>
                        <tr
                          className={cn(
                            'border-b',
                            !assignment.cfdi_id && 'bg-stone-50/80',
                            omittedFromCreate && 'bg-sky-50/40',
                            hasBlocker && assignment.cfdi_id && 'bg-red-50/30',
                            assignment.confidence === 'high'
                              && !hasBlocker
                              && !omittedFromCreate
                              && assignment.cfdi_id
                              && 'bg-emerald-50/20',
                          )}
                        >
                          <td className="px-2 py-2">
                            {canReview ? (
                              <button
                                type="button"
                                className="p-0.5 text-stone-400 hover:text-stone-700"
                                onClick={() => setExpandedReviewId(isExpanded ? null : entry.id)}
                                aria-label="Ver comparación"
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <Checkbox
                              checked={
                                assignment.include_in_create !== false
                                && Boolean(assignment.cfdi_id)
                                && !omittedFromCreate
                              }
                              disabled={!assignment.cfdi_id || hasBlocker || omittedFromCreate}
                              onCheckedChange={(v) => toggleInclude(entry.id, Boolean(v))}
                              aria-label="Incluir en lote"
                            />
                          </td>
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
                                {parsedForMatch.map(p => {
                                  const isEligible = eligible.some(e => e.id === p.id)
                                  const omitted = shouldOmitCfdiFromBulkCreate(p)
                                  const suffix = omitted
                                    ? p.duplicate_invoice || p.duplicate_invoice_folio
                                      ? ' (ya facturado)'
                                      : ' (dup. archivo)'
                                    : !isEligible
                                      ? ' (revisar)'
                                      : ''
                                  return (
                                    <SelectItem key={p.id} value={p.id}>
                                      {cfdiDisplayLabel(p)}{suffix}
                                    </SelectItem>
                                  )
                                })}
                                {assignment.cfdi_id && !parsedForMatch.some(p => p.id === assignment.cfdi_id) && selectedParsed && (
                                  <SelectItem value={assignment.cfdi_id}>
                                    {cfdiDisplayLabel(selectedParsed)}
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
                            {omittedFromCreate && issueWarnings.length === 0 ? (
                              <span className="text-sky-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Omitido — ya asignado
                              </span>
                            ) : issueWarnings.length === 0 && warnings.length === 0 ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> OK
                              </span>
                            ) : (
                              <ul className="text-[10px] space-y-0.5">
                                {warnings.map((w, i) => (
                                  <li
                                    key={i}
                                    className={cn(
                                      'flex items-start gap-1',
                                      isOmitFromCreateWarning(w) ? 'text-sky-800' : 'text-amber-800',
                                    )}
                                  >
                                    {isOmitFromCreateWarning(w) ? (
                                      <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                                    ) : (
                                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                    )}
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                        {isExpanded && assignment.match_details && selectedParsed && (
                          <tr className="border-b bg-white">
                            <td colSpan={8} className="px-3 py-2">
                              <BulkCfdiMatchReview
                                fields={assignment.match_details.fields}
                                scoreBreakdown={assignment.match_details.score_breakdown}
                                fileName={selectedParsed.file_name}
                                emisorNombre={selectedParsed.cfdi.emisor_nombre}
                              />
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {unassignedCount > 0 && (
                <p className="text-xs text-stone-500">
                  {unassignedCount} recepción{unassignedCount !== 1 ? 'es' : ''} sin CFDI — puedes facturarlas después o subir más XML.
                </p>
              )}

              {(orphanCfdis.length > 0 || skippedNonInvoice.length > 0) && (
                <div className="rounded-lg border border-stone-200 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100"
                    onClick={() => setShowOrphanCfdis(v => !v)}
                  >
                    <span>
                      CFDIs sin recepción ({orphanCfdis.length})
                      {skippedNonInvoice.length > 0 && ` · ${skippedNonInvoice.length} no factura ingreso`}
                    </span>
                    {showOrphanCfdis ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {showOrphanCfdis && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 text-xs">
                      {orphanCfdis.map(p => (
                        <div key={p.id} className="px-3 py-2 flex justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-stone-800">{cfdiDisplayLabel(p)}</div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {p.cfdi.conceptos[0]?.descripcion ?? p.file_name}
                            </div>
                          </div>
                          <span className="text-stone-400 shrink-0">sin match</span>
                        </div>
                      ))}
                      {skippedNonInvoice.slice(0, 50).map((s, i) => (
                        <div key={`skip-${i}`} className="px-3 py-2 flex justify-between gap-2 text-stone-500">
                          <span className="truncate">{s.folio || s.file} · {s.emisor_rfc}</span>
                          <span className="shrink-0">tipo {s.tipo}</span>
                        </div>
                      ))}
                      {skippedNonInvoice.length > 50 && (
                        <div className="px-3 py-2 text-stone-400 text-[10px]">
                          … y {skippedNonInvoice.length - 50} más omitidos
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                disabled={rowsToCreate.length === 0 || blockingIssues}
                onClick={() => void handleCreate()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Crear {rowsToCreate.length} factura{rowsToCreate.length !== 1 ? 's' : ''}
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
