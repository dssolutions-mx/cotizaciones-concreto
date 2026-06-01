'use client'

import React, { useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CreditNoteBulkPreviewRow } from '@/lib/ap/creditNoteBulk'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const STATUS_LABELS: Record<CreditNoteBulkPreviewRow['status'], string> = {
  ready: 'Listo',
  duplicate: 'Duplicado',
  no_related_invoices: 'Sin facturas',
  allocation_mismatch: 'Reparto inválido',
  receptor_mismatch: 'RFC receptor',
  missing_supplier_group: 'Sin proveedor',
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

  const reset = () => {
    setPreview([])
    setSelected(new Set())
    setParseErrors([])
  }

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
      setSelected(new Set(rows.filter((r) => r.status === 'ready').map((r) => r.cfdi_uuid)))

      if (rows.length === 0) {
        toast.error('No se encontraron notas de crédito (tipo E) válidas')
        return
      }
      toast.success(`${rows.filter((r) => r.status === 'ready').length} NC lista(s) para aplicar`)
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleCreate = async () => {
    const rows = preview.filter((r) => selected.has(r.cfdi_uuid) && r.status === 'ready')
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
        toast.warning(`${data.failed.length} fallaron — ver consola`)
      }
      onOpenChange(false)
      reset()
      onSuccess()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-[min(96vw,900px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notas de crédito masivas (ZIP/XML)</DialogTitle>
          <DialogDescription>
            Importe CFDI tipo Egreso (E). Se asignan a facturas abiertas por UUID en CfdiRelacionados.
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
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-stone-50 border-b">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left">Estado</th>
                    <th className="px-2 py-2 text-left">NC</th>
                    <th className="px-2 py-2 text-left">Proveedor</th>
                    <th className="px-2 py-2 text-right">Monto</th>
                    <th className="px-2 py-2 text-left">Facturas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.map((r) => {
                    const canSelect = r.status === 'ready'
                    return (
                      <tr key={r.cfdi_uuid} className="hover:bg-stone-50">
                        <td className="px-2 py-2">
                          {canSelect ? (
                            <Checkbox
                              checked={selected.has(r.cfdi_uuid)}
                              onCheckedChange={(v) => {
                                setSelected((prev) => {
                                  const next = new Set(prev)
                                  if (v) next.add(r.cfdi_uuid)
                                  else next.delete(r.cfdi_uuid)
                                  return next
                                })
                              }}
                            />
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              canSelect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                            )}
                            title={r.message}
                          >
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-mono">{r.credit_number}</td>
                        <td className="px-2 py-2">{r.supplier_group_name ?? r.emisor_rfc}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{mxn.format(r.amount)}</td>
                        <td className="px-2 py-2 text-stone-600">
                          {r.invoice_allocations.length > 0
                            ? r.invoice_allocations.map((a) => a.invoice_number).join(', ')
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
