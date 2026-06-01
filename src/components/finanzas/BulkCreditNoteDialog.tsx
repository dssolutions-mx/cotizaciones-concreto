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

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const STATUS_LABELS: Record<CreditNoteBulkPreviewRow['status'], string> = {
  ready: 'Listo para crear',
  duplicate: 'Duplicado',
  no_related_invoices: 'Sin match',
  allocation_mismatch: 'Reparto inválido',
  receptor_mismatch: 'RFC receptor',
  missing_supplier_group: 'Sin proveedor en CxP',
}

function isReady(r: CreditNoteBulkPreviewRow) {
  return r.status === 'ready'
}

function needsAttention(r: CreditNoteBulkPreviewRow) {
  return !isReady(r)
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

function NcReviewCard({
  row,
  selected,
  onToggleSelect,
}: {
  row: CreditNoteBulkPreviewRow
  selected: boolean
  onToggleSelect: (checked: boolean) => void
}) {
  const canSelect = isReady(row)
  const defaultOpen = needsAttention(row)

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-start gap-2 p-3 border-b border-stone-100">
        {canSelect ? (
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
                canSelect ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900',
              )}
            >
              {STATUS_LABELS[row.status]}
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
            {(row.cfdi_serie || row.cfdi_folio) && (
              <div>
                <span className="text-stone-500">Serie / folio CFDI</span>
                <p className="font-mono">
                  {[row.cfdi_serie, row.cfdi_folio].filter(Boolean).join('-')}
                </p>
              </div>
            )}
          </div>

          {row.invoice_allocations.length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-stone-700 mb-1">Asignación propuesta</p>
              <ul className="space-y-0.5">
                {row.invoice_allocations.map((a) => (
                  <li key={a.invoice_id} className="flex justify-between gap-2">
                    <span className="font-mono">{a.invoice_number}</span>
                    <span className="tabular-nums">{mxn.format(a.allocated_subtotal)}</span>
                  </li>
                ))}
              </ul>
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
  const [parseErrors, setParseErrors] = useState<Array<{ file: string; message: string }>>([])
  const [filter, setFilter] = useState<ImportReviewFilter>('all')
  const [search, setSearch] = useState('')
  const [groupByRfc, setGroupByRfc] = useState(true)

  const reset = () => {
    setPreview([])
    setSelected(new Set())
    setParseErrors([])
    setFilter('all')
    setSearch('')
  }

  const counts = useMemo(
    () => ({
      all: preview.length,
      ready: preview.filter(isReady).length,
      attention: preview.filter(needsAttention).length,
    }),
    [preview],
  )

  const filtered = useMemo(() => {
    return preview.filter((r) => {
      if (filter === 'ready' && !isReady(r)) return false
      if (filter === 'attention' && !needsAttention(r)) return false
      return rowMatchesSearch(r, search)
    })
  }, [preview, filter, search])

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
      setParseErrors(data.errors ?? [])
      setSelected(new Set(rows.filter(isReady).map((r) => r.cfdi_uuid)))

      if (rows.length === 0) {
        toast.error('No se encontraron notas de crédito (tipo E) válidas')
        return
      }
      const readyN = rows.filter(isReady).length
      const attn = rows.length - readyN
      if (attn > 0) {
        setFilter('attention')
        toast.info(`${readyN} lista(s), ${attn} requieren revisión — expanda cada tarjeta para ver criterios`)
      } else {
        toast.success(`${readyN} NC lista(s) para aplicar`)
      }
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleCreate = async () => {
    const rows = preview.filter((r) => selected.has(r.cfdi_uuid) && isReady(r))
    if (rows.length === 0) {
      toast.error('Seleccione al menos una NC lista')
      return
    }

    const missingPlant = rows.find((r) => !r.plant_id)
    if (missingPlant) {
      toast.error('Falta planta en una o más NC — filtre por planta o vincule facturas')
      return
    }

    setCreating(true)
    try {
      const credit_notes = rows.map((r) => ({
        supplier_group_id: r.supplier_group_id!,
        plant_id: r.plant_id!,
        credit_number: r.credit_number,
        credit_date: r.credit_date,
        reason: r.reason,
        amount: r.amount,
        vat_rate: r.vat_rate,
        invoice_allocations: r.invoice_allocations,
        cfdi_uuid: r.cfdi_uuid,
        cfdi_tipo_comprobante: 'E',
        cfdi_emisor_rfc: r.emisor_rfc,
        cfdi_capture_mode: 'cfdi',
      }))

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
          onToggleSelect={(checked) => {
            setSelected((prev) => {
              const next = new Set(prev)
              if (checked) next.add(r.cfdi_uuid)
              else next.delete(r.cfdi_uuid)
              return next
            })
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
            CFDI tipo Egreso (E). El match usa el RFC del emisor como proveedor y los UUID en
            CfdiRelacionados contra facturas abiertas en CxP. Expanda cada fila para ver criterios y facturas del proveedor.
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
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {counts.attention} a revisar
                </span>
              </div>

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
