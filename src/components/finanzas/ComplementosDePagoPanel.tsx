'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileUp, Loader2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { REP_APPLICABLE_STATUSES } from '@/lib/sat/repPayments'
import type { RepPaymentPreviewRow } from '@/types/finance'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export const REP_STATUS_LABELS: Record<RepPaymentPreviewRow['status'], string> = {
  ready: 'Listo (UUID)',
  match_folio_confirm: 'Match folio',
  ambiguous_match: 'Varias facturas',
  sat_without_invoice: 'SAT sin CxP',
  receptor_mismatch: 'RFC receptor',
  already_applied: 'Ya aplicado',
  invoice_not_found: 'Sin factura',
  no_payable: 'Sin CxP',
  overpayment: 'Excede saldo',
  invoice_void: 'Anulada',
  invoice_paid: 'Pagada',
  skipped_not_p: 'No es REP',
}

const MATCH_METHOD_LABELS: Record<string, string> = {
  uuid: 'UUID',
  folio: 'Folio',
  sat_bridge: 'SAT + folio',
  ambiguous: '—',
  manual: 'Manual',
}

export function repRowKey(r: RepPaymentPreviewRow) {
  return `${r.rep_uuid}|${r.docto_uuid}|${r.num_parcialidad}`
}

function isApplicableStatus(status: RepPaymentPreviewRow['status']) {
  return REP_APPLICABLE_STATUSES.includes(status)
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
  const fileRef = useRef<HTMLInputElement>(null)
  const inputId = compact ? 'rep-import-file-compact' : 'rep-import-file'

  const rowIsApplicable = (r: RepPaymentPreviewRow) => {
    const key = repRowKey(r)
    if (isApplicableStatus(r.status)) return true
    if (r.status === 'ambiguous_match' && ambiguousPick[key]) return true
    return false
  }

  const applicableRows = preview.filter((r) => rowIsApplicable(r))

  const handleImport = async (file: File) => {
    setUploading(true)
    setImportResult(null)
    setPreview([])
    setSelected(new Set())
    setAmbiguousPick({})
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
      toast.success(`${data.imported} REP(s) importado(s)`)
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
        toast.warning(`${data.skipped} omitido(s) — ver detalle en tabla`)
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

  return (
    <div className={cn('space-y-4', className)}>
      {!compact && (
        <p className="text-sm text-stone-600">
          Importe complementos de pago (CFDI tipo P). Se vinculan a facturas por UUID del documento
          relacionado; si no hay UUID en CxP, se intenta por folio SAT y RFC del emisor.
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
        <div className="rounded-lg border border-stone-200 overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-2 py-2 w-8" />
                <th className="px-3 py-2 text-left font-medium text-stone-600">Estado</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Match</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Factura</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">UUID docto</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Folio SAT</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Proveedor</th>
                <th className="px-3 py-2 text-center font-medium text-stone-600">Parc.</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Fecha pago</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Importe REP</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {preview.map((r) => {
                const key = repRowKey(r)
                const isAmbiguous = r.status === 'ambiguous_match'
                const canSelect =
                  isApplicableStatus(r.status) ||
                  (isAmbiguous && Boolean(ambiguousPick[key]))
                return (
                  <tr key={key} className="hover:bg-stone-50">
                    <td className="px-2 py-2">
                      {canSelect ? (
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={(v) => toggleRow(key, v === true)}
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          canSelect
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'already_applied'
                              ? 'bg-stone-100 text-stone-600'
                              : 'bg-amber-100 text-amber-800',
                        )}
                        title={r.message}
                      >
                        {REP_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {r.match_method ? MATCH_METHOD_LABELS[r.match_method] ?? r.match_method : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {isAmbiguous && r.ambiguous_candidates ? (
                        <Select
                          value={ambiguousPick[key] ?? ''}
                          onValueChange={(v) => {
                            setAmbiguousPick((prev) => ({ ...prev, [key]: v }))
                            if (!selected.has(key)) toggleRow(key, true)
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-[140px]">
                            <SelectValue placeholder="Elegir factura" />
                          </SelectTrigger>
                          <SelectContent>
                            {r.ambiguous_candidates.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.invoice_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : r.supplier_invoice_id ? (
                        <Link
                          href={`/finanzas/procurement?tab=cxp&cxp_tab=facturas`}
                          className="font-mono font-semibold text-sky-700 hover:underline"
                        >
                          {r.invoice_number ?? r.supplier_invoice_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="font-mono text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-stone-500 max-w-[120px] truncate" title={r.docto_uuid}>
                      {r.docto_uuid.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 font-mono">{r.docto_folio ?? '—'}</td>
                    <td className="px-3 py-2">{r.emisor_nombre ?? r.emisor_rfc}</td>
                    <td className="px-3 py-2 text-center">{r.num_parcialidad}</td>
                    <td className="px-3 py-2">
                      {r.fecha_pago
                        ? format(new Date(r.fecha_pago + 'T00:00:00'), 'dd MMM yyyy', { locale: es })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{mxn.format(r.imp_pagado)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.balance != null ? mxn.format(r.balance) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
