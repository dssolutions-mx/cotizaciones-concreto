'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatMxCurrency } from '@/lib/finanzas/formatMxCurrency'
import {
  financialDeltaIsTrivial,
  formatAuditChangesForDisplay,
} from '@/lib/finanzas/formatAuditChangesForDisplay'

export type AuditLogRow = {
  id: string
  occurred_at: string
  actor_role: string
  entity_type: string
  action: string
  reason: string
  changes: unknown
  financial_delta: Record<string, number | null> | null
  flags: Record<string, unknown> | null
}

type Props = {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AuditHistorySheet({ orderId, open, onOpenChange }: Props) {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchFirst = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/finanzas/audit/log?order_id=${encodeURIComponent(orderId)}&limit=30`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setRows(json.data?.rows || [])
      setCursor(json.data?.next_cursor ?? null)
    } catch (e) {
      console.error(e)
      setRows([])
      setCursor(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  const fetchMore = useCallback(async () => {
    if (!orderId || !cursor) return
    setLoadingMore(true)
    try {
      const p = new URLSearchParams({
        order_id: orderId,
        limit: '30',
        cursor,
      })
      const res = await fetch(`/api/finanzas/audit/log?${p}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      const next: AuditLogRow[] = json.data?.rows || []
      setRows((prev) => [...prev, ...next])
      setCursor(json.data?.next_cursor ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMore(false)
    }
  }, [orderId, cursor])

  useEffect(() => {
    if (open && orderId) {
      void fetchFirst()
    }
    if (!open) {
      setRows([])
      setCursor(null)
    }
  }, [open, orderId, fetchFirst])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Historial de correcciones
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {loading && (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {!loading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin registros de auditoría para este pedido.
              </p>
            )}
            {rows.map((r) => {
              const fd = r.financial_delta
              const changeLines = formatAuditChangesForDisplay(r.changes)
              const totalsTrivial = financialDeltaIsTrivial(fd ?? null)
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-stone-200/80 bg-stone-50/50 p-3 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="font-normal text-[10px]">
                      {r.action}
                    </Badge>
                    <Badge variant="secondary" className="font-normal text-[10px]">
                      {r.entity_type}
                    </Badge>
                    <span className="text-muted-foreground ml-auto tabular-nums">
                      {format(new Date(r.occurred_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{r.actor_role}</div>

                  {changeLines.length > 0 && (
                    <div className="rounded-md border border-stone-200/90 bg-white/90 px-2.5 py-2 space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                        Qué cambió
                      </p>
                      <ul className="space-y-2">
                        {changeLines.map((line, idx) => (
                          <li key={idx} className="text-[11px] leading-snug">
                            <span className="font-medium text-stone-800">{line.label}</span>
                            <div className="mt-0.5 text-stone-600 tabular-nums">
                              <span className="text-stone-500">{line.before}</span>
                              <span className="mx-1 text-stone-400">→</span>
                              <span className="font-medium text-stone-900">{line.after}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {fd &&
                    (fd.final_amount_after != null ||
                      fd.final_amount_before != null ||
                      (fd.invoice_amount_before != null && fd.invoice_amount_after != null)) && (
                      <details className="group text-[11px] text-stone-600">
                        <summary className="cursor-pointer list-none font-medium text-stone-500 hover:text-stone-700 [&::-webkit-details-marker]:hidden flex items-center gap-1">
                          <span className="inline-block transition-transform group-open:rotate-90 text-[10px]">
                            ▸
                          </span>
                          Totales del pedido
                          {totalsTrivial ? ' (sin variación)' : ''}
                        </summary>
                        <div className="mt-1.5 pl-3 border-l border-stone-200 font-mono text-[11px] text-stone-700 space-y-0.5">
                          {fd.final_amount_before != null && (
                            <div>Final antes: {formatMxCurrency(fd.final_amount_before)}</div>
                          )}
                          {fd.final_amount_after != null && (
                            <div>Final después: {formatMxCurrency(fd.final_amount_after)}</div>
                          )}
                          {fd.invoice_amount_before != null && fd.invoice_amount_after != null && (
                            <div>
                              Factura: {formatMxCurrency(fd.invoice_amount_before)} →{' '}
                              {formatMxCurrency(fd.invoice_amount_after)}
                            </div>
                          )}
                          {fd.preliminary_amount != null && (
                            <div>Preliminar (ref.): {formatMxCurrency(fd.preliminary_amount)}</div>
                          )}
                        </div>
                      </details>
                    )}

                  <p className="text-stone-800 whitespace-pre-wrap break-words">{r.reason}</p>
                  {r.flags && Object.keys(r.flags).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Boolean(r.flags.used_inactive) && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900">
                          Precio inactivo
                        </Badge>
                      )}
                      {Boolean(r.flags.cross_plant) && (
                        <Badge variant="outline" className="text-[10px]">
                          Cruce planta
                        </Badge>
                      )}
                      {Boolean(r.flags.post_close) && (
                        <Badge variant="outline" className="text-[10px] text-rose-800 border-rose-200">
                          Post-cierre
                        </Badge>
                      )}
                      {Boolean(r.flags.manual_price_orphan) && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900">
                          Precio manual
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {cursor && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={loadingMore}
                onClick={() => void fetchMore()}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar más'}
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
