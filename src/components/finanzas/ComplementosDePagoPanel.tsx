'use client'

import React, { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileUp, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'
import { REP_APPLICABLE_STATUSES } from '@/lib/sat/repPayments'
import type { RepPaymentPreviewRow } from '@/types/finance'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import ImportReviewToolbar, { type ImportReviewFilter } from '@/components/finanzas/cfdi-import/ImportReviewToolbar'
import MatchDiagnosticsPanel from '@/components/finanzas/cfdi-import/MatchDiagnosticsPanel'
import { UuidChip } from '@/components/finanzas/cfdi-import/UuidChip'
import ImportAllocatedSummary from '@/components/finanzas/cfdi-import/ImportAllocatedSummary'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export const REP_STATUS_LABELS: Record<RepPaymentPreviewRow['status'], string> = {
  ready: 'Listo (UUID)',
  match_folio_confirm: 'Match por folio — confirmar',
  ambiguous_match: 'Elegir factura',
  sat_without_invoice: 'SAT sin CxP',
  receptor_mismatch: 'RFC receptor',
  already_applied: 'Ya registrado',
  invoice_not_found: 'Sin factura',
  no_payable: 'Sin CxP (se crea al aplicar)',
  overpayment: 'Excede saldo',
  invoice_void: 'Anulada',
  invoice_paid: 'Pagada',
  skipped_not_p: 'No es REP',
}

const MATCH_METHOD_LABELS: Record<string, string> = {
  uuid: 'UUID en factura',
  folio: 'Folio + RFC emisor',
  sat_bridge: 'Inventario SAT + folio',
  ambiguous: 'Varias candidatas',
  manual: 'Manual',
}

export function repRowKey(r: RepPaymentPreviewRow) {
  return `${r.rep_uuid}|${r.docto_uuid}|${r.num_parcialidad}`
}

function isApplicableStatus(status: RepPaymentPreviewRow['status']) {
  return REP_APPLICABLE_STATUSES.includes(status)
}

function isReadyRow(r: RepPaymentPreviewRow, ambiguousPick: Record<string, string>) {
  const key = repRowKey(r)
  if (isApplicableStatus(r.status)) return true
  if (r.status === 'ambiguous_match' && ambiguousPick[key]) return true
  return false
}

function needsAttention(r: RepPaymentPreviewRow, ambiguousPick: Record<string, string>) {
  return !isReadyRow(r, ambiguousPick) && r.status !== 'already_applied'
}

function rowMatchesSearch(r: RepPaymentPreviewRow, q: string) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  return (
    r.emisor_rfc.toLowerCase().includes(s) ||
    (r.emisor_nombre ?? '').toLowerCase().includes(s) ||
    r.docto_uuid.toLowerCase().includes(s) ||
    r.rep_uuid.toLowerCase().includes(s) ||
    (r.docto_folio ?? '').toLowerCase().includes(s) ||
    (r.invoice_number ?? '').toLowerCase().includes(s) ||
    [r.rep_serie, r.rep_folio].filter(Boolean).join('-').toLowerCase().includes(s)
  )
}

function RepReviewCard({
  row,
  rowKey,
  selected,
  canSelect,
  ambiguousPick,
  onToggleSelect,
  onAmbiguousPick,
}: {
  row: RepPaymentPreviewRow
  rowKey: string
  selected: boolean
  canSelect: boolean
  ambiguousPick: Record<string, string>
  onToggleSelect: (checked: boolean) => void
  onAmbiguousPick: (invoiceId: string) => void
}) {
  const isAmbiguous = row.status === 'ambiguous_match'
  const defaultOpen = needsAttention(row, ambiguousPick) || isAmbiguous
  const repLabel =
    [row.rep_serie, row.rep_folio].filter(Boolean).join('-') ||
    `REP · parc. ${row.num_parcialidad}`

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
                canSelect
                  ? 'bg-emerald-100 text-emerald-900'
                  : row.status === 'already_applied'
                    ? 'bg-stone-100 text-stone-600'
                    : 'bg-amber-100 text-amber-900',
              )}
            >
              {REP_STATUS_LABELS[row.status]}
            </span>
            {row.match_method && (
              <span className="text-[10px] text-stone-500 border border-stone-200 rounded px-1.5 py-0.5">
                {MATCH_METHOD_LABELS[row.match_method] ?? row.match_method}
              </span>
            )}
            <span className="font-mono text-sm font-semibold">{repLabel}</span>
            <span className="text-sm">{mxn.format(row.imp_pagado)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-600">
            <span>
              <span className="text-stone-500">RFC proveedor:</span>{' '}
              <span className="font-mono font-medium text-stone-900">{row.emisor_rfc}</span>
            </span>
            {row.emisor_nombre && <span>{row.emisor_nombre}</span>}
            {row.invoice_number && (
              <span>
                → Factura <span className="font-mono font-medium">{row.invoice_number}</span>
              </span>
            )}
            {row.docto_folio && (
              <span className="font-mono text-stone-500">Folio docto. {row.docto_folio}</span>
            )}
          </div>
          {row.message && <p className="text-xs text-amber-800 mt-1">{row.message}</p>}
          <ChevronDown className="h-4 w-4 text-stone-400 mt-2 group-data-[state=open]:rotate-180 transition-transform" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="p-3 space-y-3 border-t border-stone-100 bg-stone-50/50 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-stone-500">UUID documento relacionado (factura ingreso)</span>
              <div className="mt-0.5">
                <UuidChip uuid={row.docto_uuid} />
              </div>
            </div>
            <div>
              <span className="text-stone-500">UUID nodo pago (REP)</span>
              <div className="mt-0.5">
                <UuidChip uuid={row.rep_uuid} />
              </div>
            </div>
            <div>
              <span className="text-stone-500">Parcialidad</span>
              <p className="font-mono">{row.num_parcialidad}</p>
            </div>
            <div>
              <span className="text-stone-500">Fecha pago / forma</span>
              <p>
                {row.fecha_pago
                  ? format(new Date(row.fecha_pago + 'T00:00:00'), 'dd MMM yyyy', { locale: es })
                  : '—'}
                {row.forma_pago_p ? ` · ${row.forma_pago_p}` : ''}
              </p>
            </div>
            {row.receptor_rfc && (
              <div>
                <span className="text-stone-500">RFC receptor</span>
                <p className="font-mono">{row.receptor_rfc}</p>
              </div>
            )}
            {row.balance != null && (
              <div>
                <span className="text-stone-500">Saldo factura</span>
                <p className="font-medium">{mxn.format(row.balance)}</p>
              </div>
            )}
          </div>

          {isAmbiguous && row.ambiguous_candidates && (
            <div className="rounded border border-amber-200 bg-amber-50/80 p-2 space-y-2">
              <p className="font-medium text-amber-900">Seleccione la factura correcta</p>
              <Select
                value={ambiguousPick[rowKey] ?? ''}
                onValueChange={onAmbiguousPick}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Elegir por folio / saldo" />
                </SelectTrigger>
                <SelectContent>
                  {row.ambiguous_candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.invoice_number}
                      {c.balance != null ? ` · ${mxn.format(c.balance)}` : ''}
                      {c.cfdi_uuid ? ` · UUID ${c.cfdi_uuid.slice(0, 8)}…` : ' · sin UUID'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {row.supplier_invoice_id && !isAmbiguous && (
            <p>
              <Link
                href="/finanzas/procurement?tab=cxp&cxp_tab=facturas"
                className="text-sky-700 hover:underline font-medium"
              >
                Ver facturas en CxP
              </Link>
              {row.backfill_cfdi_uuid && (
                <span className="text-stone-500 ml-2">
                  (al aplicar se guardará el UUID del docto en la factura)
                </span>
              )}
            </p>
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
  onApplied?: () => void
  compact?: boolean
  className?: string
}

export default function ComplementosDePagoPanel({ onApplied, compact = false, className }: Props) {
  const { profile } = useAuthSelectors()
  const canApply =
    profile?.role === 'EXECUTIVE' ||
    profile?.role === 'ADMIN_OPERATIONS' ||
    profile?.role === 'PLANT_MANAGER'

  const [uploading, setUploading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    skipped: number
    errors: { file: string; message: string }[]
    skipped_details?: { file: string; reason: string }[]
  } | null>(null)
  const [preview, setPreview] = useState<RepPaymentPreviewRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [ambiguousPick, setAmbiguousPick] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<ImportReviewFilter>('all')
  const [search, setSearch] = useState('')
  const [groupByRfc, setGroupByRfc] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputId = compact ? 'rep-import-file-compact' : 'rep-import-file'

  const rowIsApplicable = (r: RepPaymentPreviewRow) => isReadyRow(r, ambiguousPick)

  const applicableRows = preview.filter((r) => rowIsApplicable(r))

  const allocatedRows = useMemo(
    () => preview.filter(r => r.status === 'already_applied'),
    [preview],
  )

  const counts = useMemo(
    () => ({
      all: preview.length,
      ready: preview.filter((r) => rowIsApplicable(r)).length,
      attention: preview.filter((r) => needsAttention(r, ambiguousPick)).length,
      allocated: allocatedRows.length,
    }),
    [preview, ambiguousPick, allocatedRows],
  )

  const filtered = useMemo(() => {
    return preview.filter((r) => {
      if (filter === 'ready' && !rowIsApplicable(r)) return false
      if (filter === 'attention' && !needsAttention(r, ambiguousPick)) return false
      return rowMatchesSearch(r, search)
    })
  }, [preview, filter, search, ambiguousPick])

  const grouped = useMemo(() => {
    if (!groupByRfc) return null
    const map = new Map<string, RepPaymentPreviewRow[]>()
    for (const r of filtered) {
      const key = r.emisor_rfc
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, groupByRfc])

  const handleImport = async (file: File) => {
    setUploading(true)
    setImportResult(null)
    setPreview([])
    setSelected(new Set())
    setAmbiguousPick({})
    setFilter('all')
    setSearch('')
    try {
      const form = new FormData()
      const isZip = file.name.toLowerCase().endsWith('.zip')
      form.append(isZip ? 'zip_file' : 'xml_file', file)
      const res = await fetch('/api/ap/sat-pagos-import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al importar')
        return
      }
      setImportResult({
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors ?? [],
        skipped_details: data.skipped_details ?? [],
      })
      const rows: RepPaymentPreviewRow[] = data.preview ?? []
      setPreview(rows)
      const readyKeys = rows
        .filter((r) => r.status === 'ready' || r.status === 'match_folio_confirm')
        .map((r) => repRowKey(r))
      setSelected(new Set(readyKeys))
      const allocN = rows.filter(r => r.status === 'already_applied').length
      const attn = rows.filter((r) => needsAttention(r, {})).length
      if (attn > 0) {
        setFilter('attention')
        toast.info(
          `${readyKeys.length} listo(s)${allocN ? `, ${allocN} ya registrado(s)` : ''}, ${attn} a revisar — expanda para ver criterio`,
        )
      } else {
        toast.success(
          `${data.imported} REP(s) importado(s)${allocN ? ` · ${allocN} ya registrado(s) (omitidos)` : ''}`,
        )
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggleRow = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleApply = async () => {
    const items = preview
      .filter((r) => selected.has(repRowKey(r)) && rowIsApplicable(r))
      .map((r) => ({
        rep_uuid: r.rep_uuid,
        docto_uuid: r.docto_uuid,
        num_parcialidad: r.num_parcialidad,
        supplier_invoice_id:
          ambiguousPick[repRowKey(r)] ?? r.supplier_invoice_id ?? undefined,
      }))
    if (items.length === 0) {
      toast.error('Seleccione al menos un pago listo')
      return
    }
    setApplying(true)
    try {
      const res = await fetch('/api/ap/sat-pagos-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al aplicar')
        return
      }
      toast.success(`${data.applied} pago(s) registrado(s)`)
      if (data.errors?.length) {
        toast.warning(`${data.skipped} omitido(s)`)
      }
      setPreview((prev) =>
        prev.map((r) =>
          items.some(
            (i) =>
              i.rep_uuid === r.rep_uuid &&
              i.docto_uuid === r.docto_uuid &&
              i.num_parcialidad === r.num_parcialidad,
          )
            ? { ...r, status: 'already_applied' as const, message: 'Pago REP ya registrado' }
            : r,
        ),
      )
      setSelected(new Set())
      onApplied?.()
    } finally {
      setApplying(false)
    }
  }

  const renderList = (rows: RepPaymentPreviewRow[]) => (
    <div className="space-y-2">
      {rows.map((r) => {
        const key = repRowKey(r)
        const isAmbiguous = r.status === 'ambiguous_match'
        const canSelect =
          isApplicableStatus(r.status) ||
          (isAmbiguous && Boolean(ambiguousPick[key]))
        return (
          <RepReviewCard
            key={key}
            row={r}
            rowKey={key}
            selected={selected.has(key)}
            canSelect={canSelect}
            ambiguousPick={ambiguousPick}
            onToggleSelect={(checked) => toggleRow(key, checked)}
            onAmbiguousPick={(v) => {
              setAmbiguousPick((prev) => ({ ...prev, [key]: v }))
              if (!selected.has(key)) toggleRow(key, true)
            }}
          />
        )
      })}
    </div>
  )

  return (
    <div className={cn('space-y-4', className)}>
      {!compact && (
        <p className="text-sm text-stone-600">
          Complementos de pago (CFDI tipo P). Match en orden: UUID del documento relacionado →
          inventario SAT → folio y RFC del emisor. Cada fila muestra el RFC proveedor, UUID buscado y
          facturas abiertas del mismo proveedor si no hay coincidencia.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors',
            uploading
              ? 'border-sky-300 bg-sky-50 text-sky-700 cursor-wait'
              : 'border-stone-300 bg-white hover:bg-stone-50 text-stone-700',
          )}
        >
          <FileUp className="h-3.5 w-3.5" />
          {uploading ? 'Importando…' : 'Importar ZIP / XML (REP)'}
        </label>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept=".zip,.xml,text/xml,application/xml,application/zip"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImport(f)
          }}
        />
        {canApply && applicableRows.length > 0 && (
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
            disabled={applying || selected.size === 0}
            onClick={() => void handleApply()}
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Aplicar seleccionados ({selected.size})
          </Button>
        )}
        {!canApply && applicableRows.length > 0 && (
          <span className="text-xs text-stone-500">Solo puede revisar; no tiene permiso para aplicar pagos.</span>
        )}
      </div>

      {importResult && (
        <div
          className={cn(
            'rounded-md border p-3 text-xs space-y-1',
            importResult.errors.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50',
          )}
        >
          <div className="font-medium">
            {importResult.imported} REP importado(s) · {importResult.skipped} omitido(s) ·{' '}
            {importResult.errors.length} error(es)
          </div>
          {importResult.skipped_details?.map((e, i) => (
            <div key={`skip-${i}`} className="text-amber-800">
              {e.file}: {e.reason}
            </div>
          ))}
          {importResult.errors.map((e, i) => (
            <div key={i} className="text-red-700">
              {e.file}: {e.message}
            </div>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {counts.ready} aplicables
            </span>
            {counts.allocated > 0 && (
              <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                {counts.allocated} ya registrado{counts.allocated !== 1 ? 's' : ''}
              </span>
            )}
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {counts.attention} a revisar
            </span>
          </div>

          <ImportAllocatedSummary
            title={`${counts.allocated} complemento(s) de pago omitido(s) (ya en el sistema o repetidos en el archivo)`}
            rows={allocatedRows.map(r => {
              const repLabel =
                [r.rep_serie, r.rep_folio].filter(Boolean).join('-')
                || `parc. ${r.num_parcialidad}`
              return {
                key: repRowKey(r),
                label: `${repLabel} · ${r.emisor_rfc}`,
                detail: r.message ?? r.invoice_number,
              }
            })}
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
                      {rows[0]?.emisor_nombre ?? ''} · {rows.length} pago(s)
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
  )
}
