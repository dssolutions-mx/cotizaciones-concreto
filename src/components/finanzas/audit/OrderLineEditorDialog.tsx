'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatMxCurrency } from '@/lib/finanzas/formatMxCurrency'
import { parseJsonResponse } from '@/lib/http/safeJsonResponse'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FinanzasItemOp } from '@/lib/finanzas/mergeOrderItemOps'
import PriceChangePreviewDialog, {
  type PreviewRow,
} from '@/components/finanzas/audit/PriceChangePreviewDialog'

type QuoteOptionRow = {
  quote_detail_id: string
  quote_id: string
  quote_number: string
  quote_created_at: string
  final_price: number
  recipe_code: string
  is_current_active: boolean
  is_linked_to_line: boolean
}

function recipeLabelFromItem(item: Record<string, unknown>): string {
  const qd = item.quote_details as
    | {
        recipes?: { recipe_code?: string }
        master_recipes?: { master_code?: string }
      }
    | undefined
  if (qd?.recipes?.recipe_code) return qd.recipes.recipe_code
  if (qd?.master_recipes?.master_code) return qd.master_recipes.master_code
  return (item.product_type as string) || '—'
}

const QD_FIELD_LABELS: Record<string, string> = {
  final_price: 'Precio en cotización (m³)',
  pump_price: 'Bombeo en cotización',
}

function mapPreviewFieldLabel(key: string): string {
  return QD_FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

function formatQuoteListDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d)
  } catch {
    return ''
  }
}

/** Quita sufijos numéricos largos típicos de folios internos (p. ej. timestamp) para lectura humana. */
function friendlyQuoteDisplay(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  const parts = s.split('-')
  const last = parts[parts.length - 1] ?? ''
  if (parts.length > 1 && /^\d{8,}$/.test(last)) {
    const stripped = parts.slice(0, -1).join('-')
    return stripped || s
  }
  return s
}

/** Short label for long internal quote numbers (keeps start + end scannable). */
function compactQuoteLabel(quoteNumber: string, max = 36): string {
  const s = friendlyQuoteDisplay(quoteNumber.trim())
  if (s.length <= max) return s
  const head = Math.max(12, Math.floor(max * 0.55))
  const tail = Math.max(6, max - head - 1)
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

function formatSignedMx(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return formatMxCurrency(0)
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${formatMxCurrency(Math.abs(delta))}`
}

function QuoteVsPedidoTable({
  currentUnit,
  newUnit,
  currentLineTotal,
  newLineTotal,
  volume,
}: {
  currentUnit: number
  newUnit: number
  currentLineTotal: number
  newLineTotal: number
  volume: number
}) {
  const dU = newUnit - currentUnit
  const dT = newLineTotal - currentLineTotal
  return (
    <div className="mt-2 rounded-lg border border-stone-200/80 bg-white/90 px-2.5 py-2 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500 mb-1.5">
        Efecto en este pedido
      </p>
      <div className="grid grid-cols-[minmax(0,4.5rem)_1fr_1fr] gap-x-2 gap-y-2 text-[11px] sm:text-xs">
        <span className="text-stone-500 self-center" />
        <span className="text-stone-500 font-medium">Ahora</span>
        <span className="text-stone-700 font-medium">Con esta cotización</span>

        <span className="text-stone-600 self-center">PU</span>
        <span className="tabular-nums text-stone-700">{formatMxCurrency(currentUnit)}</span>
        <span className="tabular-nums font-semibold text-stone-900">{formatMxCurrency(newUnit)}</span>

        <span className="text-stone-600 self-center">Total</span>
        <span className="tabular-nums text-stone-700">{formatMxCurrency(currentLineTotal)}</span>
        <span className="tabular-nums font-semibold text-stone-900">
          {volume > 0 ? formatMxCurrency(newLineTotal) : '—'}
        </span>
      </div>
      {volume > 0 ? (
        <p className="mt-2 pt-2 border-t border-stone-200/70 text-[11px] text-stone-600 leading-snug tabular-nums">
          Diferencia:{' '}
          <span className="font-semibold text-stone-800">{formatSignedMx(dU)}</span> por m³ ·{' '}
          <span className="font-semibold text-stone-800">{formatSignedMx(dT)}</span> en la línea
        </p>
      ) : (
        <p className="mt-2 pt-2 border-t border-stone-200/70 text-[11px] text-amber-900/90">
          Sin volumen no se puede calcular el total; use Precio manual o asigne volumen a la línea.
        </p>
      )}
    </div>
  )
}

export type OrderLineEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  line: Record<string, unknown> | null
  order: Record<string, unknown>
  canWrite: boolean
  canPostClose: boolean
  postCloseWarning: boolean
  onRefresh: () => void
  onRunItemsPreview: (
    ops: FinanzasItemOp[],
    title: string,
    warnings: string[]
  ) => Promise<void>
  /** Folio de la cotización del pedido (si existe), para mostrar sin pedir IDs técnicos al usuario. */
  linkedQuoteNumberFromOrder?: string | null
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <Label className="text-xs font-medium text-stone-700">{label}</Label>
        {hint ? <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

export default function OrderLineEditorDialog({
  open,
  onOpenChange,
  orderId,
  line,
  order,
  canWrite,
  canPostClose,
  postCloseWarning,
  onRefresh,
  onRunItemsPreview,
  linkedQuoteNumberFromOrder = null,
}: OrderLineEditorDialogProps) {
  const [tab, setTab] = useState('linked')
  const [options, setOptions] = useState<QuoteOptionRow[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [selectedAlternativeDetailId, setSelectedAlternativeDetailId] = useState<string | null>(null)
  const [quoteApplyBusy, setQuoteApplyBusy] = useState(false)

  const qd = line?.quote_details as
    | {
        id?: string
        final_price?: number
        base_price?: number
        profit_margin?: number
        pump_price?: number
      }
    | undefined

  const [qdFinal, setQdFinal] = useState('')
  const [qdPump, setQdPump] = useState('')

  const [manualVol, setManualVol] = useState('')
  const [manualUnit, setManualUnit] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [manualPump, setManualPump] = useState('')

  const [qdPreviewOpen, setQdPreviewOpen] = useState(false)
  const [qdPreviewRows, setQdPreviewRows] = useState<PreviewRow[]>([])
  const [qdPreviewWarnings, setQdPreviewWarnings] = useState<string[]>([])
  const [qdPreviewBody, setQdPreviewBody] = useState<Record<string, number> | null>(null)
  const [qdDetailId, setQdDetailId] = useState<string | null>(null)
  const [qdBusy, setQdBusy] = useState(false)

  const lineId = line?.id ? String(line.id) : null
  const quoteDetailId = (line?.quote_detail_id as string | null) || qd?.id || null
  const clientId = String(order.client_id || '')
  const constructionSite = String(order.construction_site || '')
  const masterRecipeId = (line?.master_recipe_id as string | null) || null

  const resetForms = useCallback(() => {
    if (!line) return
    setManualVol(String(line.volume ?? ''))
    setManualUnit(String(line.unit_price ?? ''))
    setManualTotal(String(line.total_price ?? ''))
    setManualPump(String(line.pump_price ?? ''))
    const d = line.quote_details as
      | {
          final_price?: number
          base_price?: number
          profit_margin?: number
          pump_price?: number
        }
      | undefined
    setQdFinal(String(d?.final_price ?? ''))
    setQdPump(String(d?.pump_price ?? ''))
  }, [line])

  useEffect(() => {
    if (!open || !line) return
    setTab(quoteDetailId ? 'linked' : 'alternatives')
    resetForms()
  }, [open, line, quoteDetailId, resetForms])

  useEffect(() => {
    setSelectedAlternativeDetailId(null)
  }, [tab])

  useEffect(() => {
    if (!selectedAlternativeDetailId) return
    if (!options.some((o) => o.quote_detail_id === selectedAlternativeDetailId)) {
      setSelectedAlternativeDetailId(null)
    }
  }, [options, selectedAlternativeDetailId])

  useEffect(() => {
    if (!open || !lineId || !canWrite) return
    let cancelled = false
    setOptionsLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/finanzas/audit/order/${orderId}/quote-options?order_item_id=${encodeURIComponent(lineId)}`
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error')
        if (!cancelled) setOptions((json.data?.options as QuoteOptionRow[]) || [])
      } catch (e) {
        if (!cancelled) {
          setOptions([])
          toast.error(e instanceof Error ? e.message : 'Error')
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, lineId, orderId, canWrite])

  const buildManualWarnings = (): string[] => {
    const w: string[] = []
    if (postCloseWarning) w.push('Pedido completado o cancelado.')
    w.push(
      'Si el precio no coincide con ninguna cotización aprobada del mismo cliente y obra, la línea quedará sin vínculo a cotización y el historial marcará precio manual.'
    )
    return w
  }

  const handleManualPreview = async () => {
    if (!lineId) return
    if (postCloseWarning && !canPostClose) {
      toast.error('No autorizado para corrección post-cierre')
      return
    }
    const patch: Record<string, unknown> = {}
    if (manualVol !== '') patch.volume = Number(manualVol)
    if (manualUnit !== '') patch.unit_price = Number(manualUnit)
    if (manualTotal !== '') patch.total_price = Number(manualTotal)
    if (manualPump !== '') patch.pump_price = Number(manualPump)
    if (Object.keys(patch).length === 0) {
      toast.error('Sin cambios')
      return
    }
    await onRunItemsPreview(
      [{ type: 'update', id: lineId, patch }],
      'Confirmar precio o volumen manual',
      buildManualWarnings()
    )
    onOpenChange(false)
  }

  const handleUseQuoteDetail = async (detailId: string, finalPrice: number) => {
    if (!lineId) return
    if (postCloseWarning && !canPostClose) {
      toast.error('No autorizado para corrección post-cierre')
      return
    }
    const vol = Number(line?.volume) || 0
    const warnings: string[] = []
    if (postCloseWarning) warnings.push('Pedido completado o cancelado.')
    await onRunItemsPreview(
      [
        {
          type: 'update',
          id: lineId,
          patch: {
            quote_detail_id: detailId,
            unit_price: finalPrice,
            total_price: finalPrice * vol,
          },
        },
      ],
      'Vincular línea a otra cotización aprobada',
      warnings
    )
    onOpenChange(false)
  }

  const applySelectedAlternative = async () => {
    const sel = options.find((o) => o.quote_detail_id === selectedAlternativeDetailId)
    if (!sel || sel.is_linked_to_line) return
    setQuoteApplyBusy(true)
    try {
      await handleUseQuoteDetail(sel.quote_detail_id, sel.final_price)
    } finally {
      setQuoteApplyBusy(false)
    }
  }

  const openQuoteDetailPricePreview = async () => {
    const id = qd?.id || quoteDetailId
    if (!id) {
      toast.error('Esta línea no tiene detalle de cotización para editar')
      return
    }
    const body: Record<string, number> = {}
    if (qdFinal !== '') body.final_price = Number(qdFinal)
    if (qdPump !== '') body.pump_price = Number(qdPump)
    if (Object.keys(body).length === 0) {
      toast.error('Sin cambios')
      return
    }
    setQdBusy(true)
    try {
      const res = await fetch(`/api/finanzas/audit/quote-detail/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, preview: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      const patch = json.data?.patch as Record<string, number> | undefined
      const impacted = json.data?.impacted_orders as Array<{ id: string; order_number?: string }> | undefined
      const rows: PreviewRow[] = Object.entries(patch || body).map(([k, v]) => {
        const num = Number(v)
        const newValue =
          k === 'profit_margin' && Number.isFinite(num)
            ? String(num)
            : Number.isFinite(num)
              ? formatMxCurrency(num)
              : String(v)
        return {
          label: mapPreviewFieldLabel(k),
          oldValue: '—',
          newValue,
          tone: 'neutral' as const,
        }
      })
      if (impacted?.length) {
        rows.push({
          label: 'Otros pedidos con esta cotización',
          oldValue: String(impacted.length),
          newValue: impacted
            .slice(0, 5)
            .map((o) => o.order_number || 'Pedido')
            .join(', '),
          tone: 'neutral',
        })
      }
      setQdPreviewRows(rows)
      setQdPreviewWarnings(postCloseWarning ? ['Pedido completado o cancelado.'] : [])
      setQdPreviewBody(body)
      setQdDetailId(id)
      setQdPreviewOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setQdBusy(false)
    }
  }

  const confirmQuoteDetailPatch = async (reason: string) => {
    if (!qdDetailId || !qdPreviewBody) return
    const res = await fetch(`/api/finanzas/audit/quote-detail/${qdDetailId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...qdPreviewBody, reason }),
    })
    const json = await parseJsonResponse<{ error?: string }>(res)
    if (!res.ok) throw new Error(json.error || 'Error')
    toast.success('Cotización actualizada')
    onRefresh()
    setQdPreviewOpen(false)
    onOpenChange(false)
  }

  if (!line) return null

  const titleRecipe = recipeLabelFromItem(line)
  const lineTotal = Number(line.total_price) || 0
  const lineVolume = Number(line.volume) || 0
  const currentUnitPrice = Number(line.unit_price) || 0
  const quotesCreateHref = `/quotes?tab=create&client_hint=${encodeURIComponent(clientId)}&site_hint=${encodeURIComponent(constructionSite)}&prefill_master_recipe=${encodeURIComponent(masterRecipeId || '')}`

  const selectedAlternative = selectedAlternativeDetailId
    ? options.find((o) => o.quote_detail_id === selectedAlternativeDetailId)
    : undefined
  const showApplyAlternative =
    canWrite && tab === 'alternatives' && selectedAlternative && !selectedAlternative.is_linked_to_line

  const quoteFinalInDb =
    qd?.final_price != null && Number.isFinite(Number(qd.final_price)) ? Number(qd.final_price) : null
  const editedFinalNum = qdFinal.trim() === '' ? null : Number(qdFinal)
  const editedPumpNum = qdPump.trim() === '' ? null : Number(qdPump)
  const pumpDbVal = Number(qd?.pump_price ?? 0) || 0
  const finalPriceEdited =
    editedFinalNum != null &&
    Number.isFinite(editedFinalNum) &&
    quoteFinalInDb !== null &&
    editedFinalNum !== quoteFinalInDb
  const pumpPriceEdited =
    editedPumpNum != null && Number.isFinite(editedPumpNum) && editedPumpNum !== pumpDbVal

  const linkedQuoteFromOptions = options.find((o) => o.is_linked_to_line)?.quote_number
  const rawLinkedQuoteName = (
    linkedQuoteFromOptions?.trim() ||
    linkedQuoteNumberFromOrder?.trim() ||
    ''
  ).trim()
  const friendlyLinkedQuoteTitle = rawLinkedQuoteName
    ? friendlyQuoteDisplay(rawLinkedQuoteName)
    : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'max-w-xl gap-0 p-0 overflow-hidden sm:rounded-xl',
            'border-stone-200/90 shadow-xl max-h-[85vh] flex flex-col',
            'w-[calc(100vw-1.5rem)] sm:w-full'
          )}
        >
          <div className="shrink-0 border-b border-stone-200/80 bg-gradient-to-b from-stone-50/90 to-stone-50/40 px-6 pt-6 pb-4">
            <DialogHeader className="text-left space-y-1 pr-8">
              <DialogTitle className="text-lg font-semibold text-stone-900 tracking-tight">
                Corregir línea del pedido
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-600 leading-relaxed">
                <span className="font-medium text-stone-800">{titleRecipe}</span>
                {line.product_type && String(line.product_type) !== titleRecipe ? (
                  <span className="text-stone-500"> · {String(line.product_type)}</span>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-stone-200/70 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  Precio unitario
                </p>
                <p className="text-sm font-semibold tabular-nums text-stone-900 mt-0.5">
                  {formatMxCurrency(Number(line.unit_price) || 0)}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200/70 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Volumen</p>
                <p className="text-sm font-semibold tabular-nums text-stone-900 mt-0.5">
                  {line.volume != null ? String(line.volume) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200/70 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Total línea</p>
                <p className="text-sm font-semibold tabular-nums text-stone-900 mt-0.5">
                  {formatMxCurrency(lineTotal)}
                </p>
              </div>
            </div>

            {quoteDetailId ? (
              <div className="mt-3 rounded-lg border border-stone-200/80 bg-white/90 px-3 py-2.5 shadow-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  Cotización vinculada
                </p>
                {friendlyLinkedQuoteTitle ? (
                  <p className="text-sm font-semibold text-stone-900 mt-1 leading-snug break-words">
                    {friendlyLinkedQuoteTitle}
                  </p>
                ) : optionsLoading ? (
                  <p className="text-xs text-stone-500 mt-1">Cargando folio de cotización…</p>
                ) : (
                  <p className="text-xs text-stone-600 mt-1 leading-snug">
                    Esta línea está ligada a una cotización aprobada. El folio aparece al cargar las opciones
                    o en el módulo de cotizaciones.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <Badge variant="secondary" className="text-xs font-normal">
                  Sin vínculo a cotización
                </Badge>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            <div className="px-6 py-4">
              {!canWrite ? (
                <p className="text-sm text-muted-foreground">No tiene permisos para aplicar correcciones.</p>
              ) : (
                <Tabs value={tab} onValueChange={setTab} className="w-full">
                  <TabsList
                    className={cn(
                      'w-full h-auto min-h-10 flex flex-wrap justify-stretch gap-1 p-1.5',
                      'rounded-lg bg-stone-100/80 border border-stone-200/60'
                    )}
                  >
                    <TabsTrigger
                      value="linked"
                      className="flex-1 min-w-[7.5rem] text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Línea en cotización
                    </TabsTrigger>
                    <TabsTrigger
                      value="alternatives"
                      className="flex-1 min-w-[7.5rem] text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Otra cotización
                    </TabsTrigger>
                    <TabsTrigger
                      value="manual"
                      className="flex-1 min-w-[7.5rem] text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Precio manual
                    </TabsTrigger>
                    <TabsTrigger
                      value="create"
                      className="flex-1 min-w-[7.5rem] text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Nueva cotización
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="linked" className="space-y-4 mt-4 text-sm focus-visible:outline-none">
                    {!qd?.id && !quoteDetailId ? (
                      <p className="text-sm text-stone-600 leading-relaxed">
                        Esta línea no está vinculada a un detalle de cotización. Use{' '}
                        <strong className="font-medium text-stone-800">Otra cotización</strong> o{' '}
                        <strong className="font-medium text-stone-800">Precio manual</strong>.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          Edite el <span className="font-medium text-stone-800">precio que aparece en la cotización</span>{' '}
                          (y el bombeo si la línea lo lleva). Margen y costo base no se ajustan desde aquí.
                        </p>
                        <div className="rounded-lg border border-stone-200/80 bg-white px-3 py-2.5 text-xs text-stone-700 shadow-sm">
                          <span className="font-medium text-stone-800">Este pedido ahora:</span>{' '}
                          <span className="tabular-nums">PU {formatMxCurrency(currentUnitPrice)}</span>
                          <span className="text-stone-400 mx-1">·</span>
                          <span className="tabular-nums">total línea {formatMxCurrency(lineTotal)}</span>
                          {lineVolume > 0 ? (
                            <>
                              <span className="text-stone-400 mx-1">·</span>
                              <span className="tabular-nums">{lineVolume} m³</span>
                            </>
                          ) : null}
                        </div>
                        <div className="space-y-4">
                          <Field
                            label="Precio en cotización (por m³)"
                            hint="Es el precio de venta por metro cúbico que define esta línea en la cotización."
                          >
                            <Input
                              className="h-11 text-base tabular-nums border-stone-200 bg-white font-medium"
                              value={qdFinal}
                              onChange={(e) => setQdFinal(e.target.value)}
                              inputMode="decimal"
                            />
                          </Field>
                          <Field
                            label="Bombeo en cotización"
                            hint="Solo si esta línea cotiza bombeo aparte del concreto. Si no aplica, déjelo en 0."
                          >
                            <Input
                              className="h-9 tabular-nums border-stone-200 bg-white"
                              value={qdPump}
                              onChange={(e) => setQdPump(e.target.value)}
                              inputMode="decimal"
                            />
                          </Field>
                        </div>
                        {finalPriceEdited && editedFinalNum != null && lineVolume > 0 ? (
                          <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 px-3 py-2.5 text-xs text-blue-950 leading-relaxed">
                            <span className="font-medium">Referencia en el pedido:</span> con volumen{' '}
                            <span className="tabular-nums">{lineVolume} m³</span>, un PU de{' '}
                            <span className="tabular-nums font-semibold">{formatMxCurrency(editedFinalNum)}</span>{' '}
                            implicaría un total de línea de{' '}
                            <span className="tabular-nums font-semibold">
                              {formatMxCurrency(editedFinalNum * lineVolume)}
                            </span>{' '}
                            (hoy <span className="tabular-nums">{formatMxCurrency(lineTotal)}</span>, diferencia{' '}
                            <span className="tabular-nums font-semibold">
                              {formatSignedMx(editedFinalNum * lineVolume - lineTotal)}
                            </span>
                            ). El pedido se actualiza según el flujo de auditoría y recálculo.
                          </div>
                        ) : null}
                        {pumpPriceEdited && !finalPriceEdited ? (
                          <p className="text-[11px] text-stone-600 leading-snug">
                            Actualizará el importe de bombeo en la línea de cotización. Revise la vista previa
                            antes de confirmar.
                          </p>
                        ) : null}
                        <Separator className="bg-stone-200/80" />
                        <Button
                          type="button"
                          className="w-full h-10 bg-stone-900 text-white hover:bg-stone-800"
                          disabled={qdBusy}
                          onClick={() => void openQuoteDetailPricePreview()}
                        >
                          {qdBusy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Preparando vista previa…
                            </>
                          ) : (
                            'Revisar y confirmar cambios'
                          )}
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="alternatives" className="mt-4 focus-visible:outline-none space-y-3">
                    {optionsLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-stone-500">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Cargando cotizaciones aprobadas…</span>
                      </div>
                    ) : options.length === 0 ? (
                      <p className="text-sm text-stone-600 leading-relaxed">
                        No hay otras líneas de cotización aprobadas que coincidan con esta receta u obra.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          Elija una cotización: verá cómo cambia el{' '}
                          <span className="font-medium text-stone-800">precio unitario</span> y el{' '}
                          <span className="font-medium text-stone-800">total de la línea</span> respecto a lo
                          que tiene el pedido hoy
                          {lineVolume > 0 ? (
                            <span className="tabular-nums"> (volumen {lineVolume} m³)</span>
                          ) : null}
                          .
                        </p>
                        <ul className="space-y-2 pr-1">
                          {options.map((o) => {
                            const projectedTotal = o.final_price * lineVolume
                            const listDate = formatQuoteListDate(o.quote_created_at)
                            const quoteShort = compactQuoteLabel(o.quote_number)
                            const quoteFriendly = friendlyQuoteDisplay(o.quote_number)
                            const isCurrent = o.is_linked_to_line
                            const isSelected = selectedAlternativeDetailId === o.quote_detail_id && !isCurrent

                            if (isCurrent) {
                              return (
                                <li
                                  key={o.quote_detail_id}
                                  className="rounded-xl border border-stone-300/90 bg-white px-3.5 py-3 shadow-sm"
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-600"
                                      aria-hidden
                                    >
                                      <Check className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <p className="text-sm font-semibold text-stone-900 truncate">
                                                {quoteShort}
                                              </p>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-sm">
                                              <div className="space-y-1.5">
                                                <p className="text-xs font-medium text-stone-900 leading-snug">
                                                  {quoteFriendly}
                                                </p>
                                                {quoteFriendly !== o.quote_number.trim() ? (
                                                  <p className="text-[10px] text-stone-500 leading-snug break-words">
                                                    Folio en sistema:{' '}
                                                    <span className="font-mono">{o.quote_number}</span>
                                                  </p>
                                                ) : null}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                                          En uso en este pedido
                                        </Badge>
                                        {o.is_current_active ? (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] font-normal shrink-0 border-emerald-200 bg-emerald-50/60 text-emerald-900"
                                          >
                                            Lista activa
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-stone-600">
                                        {o.recipe_code}
                                        {listDate ? (
                                          <span className="text-stone-500"> · {listDate}</span>
                                        ) : null}
                                      </p>
                                      <p className="text-xs text-stone-700 tabular-nums">
                                        Precio en cotización:{' '}
                                        <span className="font-medium text-stone-900">
                                          {formatMxCurrency(o.final_price)}
                                        </span>
                                        {lineVolume > 0 ? (
                                          <>
                                            {' '}
                                            · Total con este volumen:{' '}
                                            <span className="font-medium text-stone-900">
                                              {formatMxCurrency(projectedTotal)}
                                            </span>
                                          </>
                                        ) : null}
                                      </p>
                                    </div>
                                  </div>
                                </li>
                              )
                            }

                            return (
                              <li key={o.quote_detail_id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedAlternativeDetailId((cur) =>
                                      cur === o.quote_detail_id ? null : o.quote_detail_id
                                    )
                                  }
                                  className={cn(
                                    'w-full rounded-xl border px-3.5 py-3 text-left transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
                                    isSelected
                                      ? 'border-stone-800 bg-stone-50 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.06)]'
                                      : 'border-stone-200/90 bg-stone-50/40 hover:bg-white hover:border-stone-300'
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className={cn(
                                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums',
                                        isSelected
                                          ? 'border-stone-800 bg-stone-900 text-white'
                                          : 'border-stone-300 bg-white text-stone-500'
                                      )}
                                      aria-hidden
                                    >
                                      {isSelected ? (
                                        <Check className="h-4 w-4" strokeWidth={2.5} />
                                      ) : (
                                        <span className="h-2 w-2 rounded-full bg-stone-300" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <p className="text-sm font-semibold text-stone-900 truncate">
                                                {quoteShort}
                                              </p>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-sm">
                                              <div className="space-y-1.5">
                                                <p className="text-xs font-medium text-stone-900 leading-snug">
                                                  {quoteFriendly}
                                                </p>
                                                {quoteFriendly !== o.quote_number.trim() ? (
                                                  <p className="text-[10px] text-stone-500 leading-snug break-words">
                                                    Folio en sistema:{' '}
                                                    <span className="font-mono">{o.quote_number}</span>
                                                  </p>
                                                ) : null}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        {o.is_current_active ? (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] font-normal shrink-0 border-emerald-200 bg-emerald-50/60 text-emerald-900"
                                          >
                                            Lista activa
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-stone-600">
                                        {o.recipe_code}
                                        {listDate ? (
                                          <span className="text-stone-500"> · {listDate}</span>
                                        ) : null}
                                      </p>
                                      <QuoteVsPedidoTable
                                        currentUnit={currentUnitPrice}
                                        newUnit={o.final_price}
                                        currentLineTotal={lineTotal}
                                        newLineTotal={projectedTotal}
                                        volume={lineVolume}
                                      />
                                    </div>
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                        {showApplyAlternative && selectedAlternative && lineVolume > 0 ? (
                          <div className="rounded-xl border-2 border-stone-800/20 bg-gradient-to-b from-stone-50 to-white px-3.5 py-3 shadow-sm">
                            <p className="text-xs font-semibold text-stone-900 mb-2">
                              Resumen antes de aplicar
                            </p>
                            <QuoteVsPedidoTable
                              currentUnit={currentUnitPrice}
                              newUnit={selectedAlternative.final_price}
                              currentLineTotal={lineTotal}
                              newLineTotal={selectedAlternative.final_price * lineVolume}
                              volume={lineVolume}
                            />
                          </div>
                        ) : null}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4 mt-4 focus-visible:outline-none">
                    <Alert className="border-amber-200/80 bg-amber-50/50 text-amber-950">
                      <AlertDescription className="text-xs leading-relaxed">
                        Si el importe no coincide con ninguna cotización aprobada del cliente y la obra, el
                        sistema quitará el vínculo al detalle de cotización y dejará constancia en el historial
                        de auditoría.
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Volumen">
                        <Input
                          className="h-9 tabular-nums border-stone-200 bg-white"
                          value={manualVol}
                          onChange={(e) => setManualVol(e.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                      <Field label="Precio unitario">
                        <Input
                          className="h-9 tabular-nums border-stone-200 bg-white"
                          value={manualUnit}
                          onChange={(e) => setManualUnit(e.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                      <Field label="Total" hint="Opcional si recalcula desde volumen × unitario.">
                        <Input
                          className="h-9 tabular-nums border-stone-200 bg-white"
                          value={manualTotal}
                          onChange={(e) => setManualTotal(e.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                      <Field label="Precio bombeo" hint="Solo para líneas de servicio de bombeo.">
                        <Input
                          className="h-9 tabular-nums border-stone-200 bg-white"
                          value={manualPump}
                          onChange={(e) => setManualPump(e.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 border-stone-300"
                      onClick={() => void handleManualPreview()}
                    >
                      Vista previa en el pedido
                    </Button>
                  </TabsContent>

                  <TabsContent value="create" className="space-y-4 mt-4 focus-visible:outline-none">
                    <p className="text-sm text-stone-600 leading-relaxed">
                      Cree la cotización en el módulo de cotizaciones con el mismo cliente y obra. Cuando esté
                      aprobada, vuelva a este panel y actualice los datos para elegir la nueva cotización en
                      la pestaña <strong className="font-medium">Otra cotización</strong>.
                    </p>
                    <Button variant="default" className="w-full h-10 gap-2" asChild>
                      <Link href={quotesCreateHref} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Abrir módulo de cotizaciones
                      </Link>
                    </Button>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-stone-200/80 bg-stone-50/50 px-6 py-3 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-stone-500 leading-snug order-2 sm:order-1 sm:max-w-[58%]">
              {tab === 'alternatives' && !optionsLoading && options.length > 0
                ? 'Seleccione una cotización y confirme abajo. Podrá revisar el impacto en el pedido antes de guardar.'
                : tab === 'linked'
                  ? 'Los cambios en la cotización enlazada pueden afectar otras líneas que compartan ese precio.'
                  : null}
            </p>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end order-1 sm:order-2">
              {showApplyAlternative ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto h-9 bg-stone-900 text-white hover:bg-stone-800"
                  disabled={quoteApplyBusy || lineVolume <= 0}
                  onClick={() => void applySelectedAlternative()}
                >
                  {quoteApplyBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Aplicando…
                    </>
                  ) : (
                    'Usar esta cotización en el pedido'
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-stone-600 h-9 w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PriceChangePreviewDialog
        open={qdPreviewOpen}
        onOpenChange={setQdPreviewOpen}
        title="Confirmar cambios en la cotización"
        description="Revise el precio en cotización (y bombeo si aplica) y registre un motivo para la auditoría."
        rows={qdPreviewRows}
        warnings={qdPreviewWarnings}
        requirePostCloseAck={postCloseWarning && canPostClose}
        onConfirm={async (reason, _allowPostClose) => {
          await confirmQuoteDetailPatch(reason)
        }}
      />
    </>
  )
}
