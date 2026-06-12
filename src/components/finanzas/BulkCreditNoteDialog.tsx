'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FileUp, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CreditNoteBulkPreviewRow } from '@/lib/ap/creditNoteBulk'
import ImportReviewToolbar, { type ImportReviewFilter } from '@/components/finanzas/cfdi-import/ImportReviewToolbar'
import MatchDiagnosticsPanel from '@/components/finanzas/cfdi-import/MatchDiagnosticsPanel'
import { UuidChip } from '@/components/finanzas/cfdi-import/UuidChip'
import ImportAllocatedSummary from '@/components/finanzas/cfdi-import/ImportAllocatedSummary'
import CreditNoteInvoiceAllocator from '@/components/finanzas/CreditNoteInvoiceAllocator'
import type { CreditNoteInvoiceAllocationInput } from '@/lib/ap/creditNoteAllocationTypes'
import { isAllocationBalanced } from '@/lib/ap/creditNoteAllocationTypes'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const STATUS_LABELS: Record<CreditNoteBulkPreviewRow['status'], string> = {
  ready: 'Listo para crear',
  duplicate: 'Ya registrada',
  no_related_invoices: 'Asignar manualmente',
  allocation_mismatch: 'Reparto inválido',
  receptor_mismatch: 'RFC receptor',
  missing_supplier_group: 'Sin proveedor en CxP',
}

function isAllocated(r: CreditNoteBulkPreviewRow) {
  return r.status === 'duplicate'
}

function needsAttention(r: CreditNoteBulkPreviewRow) {
  return r.status !== 'ready' && r.status !== 'duplicate'
}

function rowMatchesSearch(r: CreditNoteBulkPreviewRow, q: string) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  return (
    r.emisor_rfc.toLowerCase().includes(s) ||
    (r.emisor_nombre ?? '').toLowerCase().includes(s) ||
    r.cfdi_uuid.toLowerCase().includes(s) ||
    r.credit_number.toLowerCase().includes(s) ||
    (r.supplier_group_name ?? '').toLowerCase().includes(s) ||
    r.file_name.toLowerCase().includes(s) ||
    (r.match_diagnostics?.searched_uuids.some((u) => u.toLowerCase().includes(s)) ?? false)
  )
}

function isCreatable(
  row: CreditNoteBulkPreviewRow,
  allocations: CreditNoteInvoiceAllocationInput[],
): boolean {
  if (isAllocated(row)) return false
  if (row.status === 'duplicate' || row.status === 'receptor_mismatch' || row.status === 'missing_supplier_group') {
    return false
  }
  if (!row.supplier_group_id || !row.plant_id) return false
  if (allocations.length === 0) return false
  return isAllocationBalanced(row.amount, allocations)
}

function NcReviewCard({
  row,
  selected,
  allocations,
  onToggleSelect,
  onAllocationsChange,
}: {
  row: CreditNoteBulkPreviewRow
  selected: boolean
  allocations: CreditNoteInvoiceAllocationInput[]
  onToggleSelect: (checked: boolean) => void
  onAllocationsChange: (next: CreditNoteInvoiceAllocationInput[]) => void
}) {
  const creatable = isCreatable(row, allocations)
  const allocated = isAllocated(row)
  const defaultOpen = needsAttention(row) || creatable

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-start gap-2 p-3 border-b border-stone-100">
        {creatable ? (
          <Checkbox
            className="mt-1"
            checked={selected}
            onCheckedChange={(v) => onToggleSelect(v === true)}
          />
        ) : (
          <div className="w-4" />
        )}
        <CollapsibleTrigger className="flex-1 text-left group">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                creatable
                  ? 'bg-emerald-100 text-emerald-900'
                  : allocated
                    ? 'bg-sky-100 text-sky-900'
                    : 'bg-amber-100 text-amber-900',
              )}
            >
              {creatable ? 'Listo para crear' : STATUS_LABELS[row.status]}
            </span>
            <span className="font-mono font-semibold text-sm">{row.credit_number}</span>
            <span className="text-sm text-stone-800">{mxn.format(row.amount)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-600">
            <span>
              <span className="text-stone-500">RFC proveedor:</span>{' '}
              <span className="font-mono font-medium text-stone-900">{row.emisor_rfc}</span>
            </span>
            {row.emisor_nombre && <span>{row.emisor_nombre}</span>}
            {row.supplier_group_name && (
              <span className="text-stone-500">· Grupo: {row.supplier_group_name}</span>
            )}
          </div>
          {allocations.length > 0 && (
            <div className="mt-1 text-[10px] text-stone-500">
              {allocations.length} factura(s):{' '}
              {allocations.map((a) => a.invoice_number ?? a.invoice_id.slice(0, 8)).join(', ')}
            </div>
          )}
          {row.message && (
            <p className="text-xs text-amber-800 mt-1">{row.message}</p>
          )}
          <ChevronDown className="h-4 w-4 text-stone-400 mt-2 group-data-[state=open]:rotate-180 transition-transform" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="p-3 space-y-3 border-t border-stone-100 bg-stone-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-stone-500">UUID nota de crédito</span>
              <div className="mt-0.5">
                <UuidChip uuid={row.cfdi_uuid} />
              </div>
            </div>
            <div>
              <span className="text-stone-500">Archivo</span>
              <p className="font-mono text-stone-800 truncate">{row.file_name}</p>
            </div>
            <div>
              <span className="text-stone-500">Fecha emisión</span>
              <p>{row.credit_date}</p>
            </div>
            <div>
              <span className="text-stone-500">RFC receptor (empresa)</span>
              <p className="font-mono">{row.receptor_rfc}</p>
            </div>
          </div>

          {row.available_invoices.length > 0 && !allocated && (
            <div className="rounded-md border border-sky-200 bg-white p-3">
              <CreditNoteInvoiceAllocator
                amount={row.amount}
                invoices={row.available_invoices}
                allocations={allocations}
                onChange={onAllocationsChange}
                compact
              />
            </div>
          )}

          {row.match_diagnostics && (
            <MatchDiagnosticsPanel diagnostics={row.match_diagnostics} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspacePlantId?: string
  onSuccess: () => void
}

export default function BulkCreditNoteDialog({
  open, onOpenChange, workspacePlantId = '', onSuccess,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState<CreditNoteBulkPreviewRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allocOverrides, setAllocOverrides] = useState<Record<string, CreditNoteInvoiceAllocationInput[]>>({})
  const [parseErrors, setParseErrors] = useState<Array<{ file: string; message: string }>>([])
  const [filter, setFilter] = useState<ImportReviewFilter>('all')
  const [search, setSearch] = useState('')
  const [groupByRfc, setGroupByRfc] = useState(true)

  const getAllocations = (row: CreditNoteBulkPreviewRow) =>
    allocOverrides[row.cfdi_uuid] ?? row.invoice_allocations

  const reset = () => {
    setPreview([])
    setSelected(new Set())
    setAllocOverrides({})
    setParseErrors([])
    setFilter('all')
    setSearch('')
  }

  const allocatedRows = useMemo(() => preview.filter(isAllocated), [preview])

  const counts = useMemo(() => {
    const ready = preview.filter((r) => isCreatable(r, getAllocations(r))).length
    return {
      all: preview.length,
      ready,
      attention: preview.filter(needsAttention).length,
      allocated: allocatedRows.length,
    }
  }, [preview, allocatedRows, allocOverrides])

  const filtered = useMemo(() => {
    return preview.filter((r) => {
      if (filter === 'ready' && !isCreatable(r, getAllocations(r))) return false
      if (filter === 'attention' && !needsAttention(r)) return false
      return rowMatchesSearch(r, search)
    })
  }, [preview, filter, search, allocOverrides])

  const grouped = useMemo(() => {
    if (!groupByRfc) return null
    const map = new Map<string, CreditNoteBulkPreviewRow[]>()
    for (const r of filtered) {
      const key = r.emisor_rfc
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, groupByRfc])

  const handleFiles = async (file: File) => {
    setParsing(true)
    reset()
    try {
      const form = new FormData()
      const isZip = file.name.toLowerCase().endsWith('.zip')
      form.append(isZip ? 'zip_file' : 'xml_file', file)
      if (workspacePlantId) form.append('plant_id', workspacePlantId)

      const res = await fetch('/api/ap/cfdi/parse-bulk-credit-notes', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al leer CFDIs')
        return
      }

      const rows: CreditNoteBulkPreviewRow[] = data.preview ?? []
      setPreview(rows)
      const initialSelected = rows.filter((r) => isCreatable(r, r.invoice_allocations))
      setSelected(new Set(initialSelected.map((r) => r.cfdi_uuid)))

      if (rows.length === 0) {
        toast.error('No se encontraron notas de crédito (tipo E) válidas')
        return
      }
      const readyN = initialSelected.length
      const allocN = rows.filter(isAllocated).length
      const attn = rows.filter(needsAttention).length
      if (attn > 0) {
        setFilter('attention')
        toast.info(
          `${readyN} lista(s)${allocN ? `, ${allocN} ya registrada(s)` : ''}, ${attn} a revisar — revise asignación en cada tarjeta`,
        )
      } else {
        toast.success(
          `${readyN} NC lista(s) — revise asignación antes de crear${allocN ? ` · ${allocN} omitida(s)` : ''}`,
        )
      }
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleCreate = async () => {
    const rows = preview.filter((r) => selected.has(r.cfdi_uuid) && isCreatable(r, getAllocations(r)))
    if (rows.length === 0) {
      toast.error('Seleccione al menos una NC con asignación válida')
      return
    }

    setCreating(true)
    try {
      const credit_notes = rows.map((r) => {
        const allocs = getAllocations(r)
        const firstInv = r.available_invoices.find((inv) =>
          allocs.some((a) => a.invoice_id === inv.id),
        )
        const plantId = r.plant_id ?? firstInv?.plant_id ?? workspacePlantId
        return {
          supplier_group_id: r.supplier_group_id!,
          plant_id: plantId,
          credit_number: r.credit_number,
          credit_date: r.credit_date,
          reason: r.reason,
          amount: r.amount,
          vat_rate: r.vat_rate,
          invoice_allocations: allocs,
          cfdi_uuid: r.cfdi_uuid,
          cfdi_tipo_comprobante: 'E',
          cfdi_emisor_rfc: r.emisor_rfc,
          cfdi_capture_mode: 'cfdi',
        }
      })

      const missingPlant = credit_notes.find((cn) => !cn.plant_id)
      if (missingPlant) {
        toast.error('Falta planta en una o más NC')
        return
      }

      const res = await fetch('/api/ap/credit-notes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit_notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al crear NC')
        return
      }

      toast.success(`${data.created?.length ?? 0} nota(s) de crédito creada(s)`)
      if (data.failed?.length) {
        toast.warning(`${data.failed.length} fallaron`)
      }
      onOpenChange(false)
      reset()
      onSuccess()
    } finally {
      setCreating(false)
    }
  }

  const renderList = (rows: CreditNoteBulkPreviewRow[]) => (
    <div className="space-y-2">
      {rows.map((r) => (
        <NcReviewCard
          key={r.cfdi_uuid}
          row={r}
          selected={selected.has(r.cfdi_uuid)}
          allocations={getAllocations(r)}
          onToggleSelect={(checked) => {
            setSelected((prev) => {
              const next = new Set(prev)
              if (checked) next.add(r.cfdi_uuid)
              else next.delete(r.cfdi_uuid)
              return next
            })
          }}
          onAllocationsChange={(next) => {
            setAllocOverrides((prev) => ({ ...prev, [r.cfdi_uuid]: next }))
            if (isCreatable(r, next)) {
              setSelected((prev) => new Set(prev).add(r.cfdi_uuid))
            }
          }}
        />
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-[min(96vw,960px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notas de crédito masivas (ZIP/XML)</DialogTitle>
          <DialogDescription>
            CFDI tipo Egreso (E). Revise y ajuste la asignación a facturas y líneas antes de crear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer',
              parsing ? 'border-sky-300 bg-sky-50' : 'border-stone-300 bg-white hover:bg-stone-50',
            )}
          >
            <FileUp className="h-3.5 w-3.5" />
            {parsing ? 'Leyendo…' : 'Seleccionar ZIP / XML'}
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.xml,application/zip,text/xml,application/xml"
              className="hidden"
              disabled={parsing}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFiles(f)
              }}
            />
          </label>

          {parseErrors.length > 0 && (
            <div className="text-xs text-red-700 space-y-1 border border-red-200 rounded p-2 bg-red-50">
              {parseErrors.map((e, i) => (
                <div key={i}>{e.file}: {e.message}</div>
              ))}
            </div>
          )}

          {preview.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {counts.ready} listas
                </span>
                {counts.allocated > 0 && (
                  <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                    {counts.allocated} ya registrada{counts.allocated !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {counts.attention} a revisar
                </span>
              </div>

              <ImportAllocatedSummary
                title={`${counts.allocated} nota(s) de crédito omitida(s) del lote (ya en el sistema)`}
                rows={allocatedRows.map(r => ({
                  key: r.cfdi_uuid,
                  label: `${r.credit_number} · ${r.emisor_rfc}`,
                  detail: r.message ?? null,
                }))}
              />

              <ImportReviewToolbar
                filter={filter}
                onFilterChange={setFilter}
                counts={counts}
                search={search}
                onSearchChange={setSearch}
                groupByRfc={groupByRfc}
                onGroupByRfcChange={setGroupByRfc}
              />

              {filtered.length === 0 ? (
                <p className="text-sm text-stone-500 py-4 text-center">Ningún resultado con este filtro.</p>
              ) : groupByRfc && grouped ? (
                <Accordion type="multiple" defaultValue={grouped.map(([rfc]) => rfc)} className="space-y-2">
                  {grouped.map(([rfc, rows]) => (
                    <AccordionItem key={rfc} value={rfc} className="border rounded-lg px-2 bg-white">
                      <AccordionTrigger className="text-sm py-3 hover:no-underline">
                        <span className="font-mono font-semibold">{rfc}</span>
                        <span className="text-stone-500 font-normal ml-2">
                          {rows[0]?.emisor_nombre ?? rows[0]?.supplier_group_name ?? ''} · {rows.length} NC
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">{renderList(rows)}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                renderList(filtered)
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button
            disabled={creating || selected.size === 0}
            onClick={() => void handleCreate()}
            className="bg-stone-800 hover:bg-stone-900 text-white"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Crear seleccionadas ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
