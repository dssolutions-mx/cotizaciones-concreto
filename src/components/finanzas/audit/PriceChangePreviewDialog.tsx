'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export type PreviewRow = {
  label: string
  oldValue: string
  newValue: string
  tone?: 'neutral' | 'favorable' | 'unfavorable'
}

export type PriceChangePreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Optional subtitle (e.g. audit context). */
  description?: string
  rows: PreviewRow[]
  /**
   * When set, inserts a "Totales del pedido" heading before this row index
   * (use the count of line-level diff rows so order totals appear below).
   */
  orderSummaryStartsAtIndex?: number
  warnings: string[]
  requirePostCloseAck: boolean
  onConfirm: (reason: string, allowPostClose: boolean) => Promise<void>
}

export default function PriceChangePreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  rows,
  orderSummaryStartsAtIndex,
  warnings,
  requirePostCloseAck,
  onConfirm,
}: PriceChangePreviewDialogProps) {
  const [reason, setReason] = useState('')
  const [postClose, setPostClose] = useState(false)
  const [busy, setBusy] = useState(false)

  const canSubmit =
    reason.trim().length >= 10 && (!requirePostCloseAck || postClose)

  const handleConfirm = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      await onConfirm(reason.trim(), postClose)
      setReason('')
      setPostClose(false)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v)
      }}
    >
      <DialogContent
        className={cn(
          'max-w-lg gap-0 p-0 overflow-hidden sm:rounded-xl',
          'border-stone-200/90 shadow-xl max-h-[85vh] flex flex-col',
          'w-[calc(100vw-1.5rem)] sm:w-full'
        )}
      >
        <div className="shrink-0 border-b border-stone-200/80 bg-gradient-to-b from-stone-50/90 to-stone-50/30 px-6 pt-6 pb-4">
          <DialogHeader className="text-left space-y-1.5 pr-8">
            <DialogTitle className="text-lg font-semibold text-stone-900">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-sm text-stone-600 leading-relaxed">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] max-h-[min(52vh,420px)] sm:max-h-[50vh]">
          <div className="px-6 py-4 space-y-4">
            {warnings.length > 0 && (
              <Alert className="border-amber-200/80 bg-amber-50/60 text-amber-950 py-3">
                <AlertDescription className="text-xs space-y-1.5 leading-relaxed">
                  {warnings.map((w) => (
                    <div key={w}>{w}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 mb-2">
                Resumen de cambios
              </p>
              <div className="space-y-2">
                {rows.length === 0 ? (
                  <p className="text-sm text-stone-500">Sin filas de comparación.</p>
                ) : (
                  rows.map((r, i) => (
                    <React.Fragment key={`${i}-${r.label}`}>
                      {orderSummaryStartsAtIndex != null &&
                        orderSummaryStartsAtIndex > 0 &&
                        i === orderSummaryStartsAtIndex && (
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 pt-1">
                            Totales del pedido
                          </p>
                        )}
                      <div
                        className={cn(
                          'rounded-lg border px-3 py-2.5 text-sm',
                          r.tone === 'favorable' && 'border-emerald-200/80 bg-emerald-50/50',
                          r.tone === 'unfavorable' && 'border-rose-200/80 bg-rose-50/50',
                          r.tone === 'neutral' && 'border-stone-200/80 bg-white'
                        )}
                      >
                        <div className="font-medium text-stone-800 text-xs">{r.label}</div>
                        <div className="text-stone-600 mt-1 text-xs sm:text-sm">
                          <span className="line-through opacity-80">{r.oldValue}</span>
                          <span className="mx-1.5 text-stone-400">→</span>
                          <span className="font-mono tabular-nums font-medium text-stone-900">
                            {r.newValue}
                          </span>
                        </div>
                      </div>
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>

            <Separator className="bg-stone-200/80" />

            <div className="space-y-2">
              <Label htmlFor="audit-reason" className="text-xs font-medium text-stone-700">
                Motivo de la corrección (mínimo 10 caracteres)
              </Label>
              <Textarea
                id="audit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="text-sm resize-none border-stone-200 bg-white"
                placeholder="Ej. Se alinea el precio a la cotización aprobada acordada con el cliente."
              />
            </div>

            {requirePostCloseAck && (
              <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer rounded-lg border border-stone-200/80 bg-stone-50/50 p-3">
                <Checkbox
                  className="mt-0.5"
                  checked={postClose}
                  onCheckedChange={(c) => setPostClose(c === true)}
                />
                <span className="leading-snug">
                  Confirmo que autorizo esta corrección con el pedido en estado completado o cancelado.
                </span>
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-stone-200/80 bg-stone-50/50 px-6 py-3 gap-2 sm:gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-stone-900 text-white hover:bg-stone-800 min-w-[120px]"
            disabled={!canSubmit || busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
