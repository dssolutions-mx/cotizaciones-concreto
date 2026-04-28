'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronDown,
  ChevronsUpDown,
  DollarSign,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import OrderLineEditorDialog from '@/components/finanzas/audit/OrderLineEditorDialog'
import { formatMxCurrency } from '@/lib/finanzas/formatMxCurrency'
import {
  formatHoraCargaForDisplay,
  formatRemisionFechaForDisplay,
} from '@/lib/dates/remisionFechaDisplay'
import PriceChangePreviewDialog, {
  type PreviewRow,
} from '@/components/finanzas/audit/PriceChangePreviewDialog'
import { parseJsonResponse } from '@/lib/http/safeJsonResponse'
import { toast } from 'sonner'
import type { FinanzasItemOp } from '@/lib/finanzas/mergeOrderItemOps'
import {
  buildFinancialEstimatePreviewRows,
  type OrderItemLineDiff,
} from '@/lib/finanzas/buildOrderItemLineDiffs'
import { supabase } from '@/lib/supabase'
import {
  fetchCatalogAdditionalProducts,
  type CatalogAdditionalProduct,
} from '@/lib/finanzas/additionalProductsCatalog'
import {
  concreteVolumeForPerM3AdditionalProduct,
  type OrderItemLike,
} from '@/lib/finanzas/estimateOrderFinancials'

/** Combobox trigger: product name only when code is an internal ADDL-* id or too long. */
function additionalProductTriggerLabel(p: CatalogAdditionalProduct): string {
  const name = (p.name || '').trim()
  const code = (p.code || '').trim()
  if (!code) return name || 'Producto'
  if (/^ADDL-/i.test(code)) return name || 'Producto'
  if (code.length > 18) return name || 'Producto'
  return `${name} (${code})`
}

export type AuditSummaryPayload = {
  order: Record<string, unknown>
  order_items: Array<Record<string, unknown> & { id?: string; quote_details?: unknown }>
  pumping_remisiones: Array<Record<string, unknown>>
  concrete_remisiones_count: number
  pumping_remisiones_count: number
  concrete_volume_delivered_sum: number
  pumping_volume_sum: number
  pump_priced_volume: number
  quote: Record<string, unknown> | null
  product_prices: Array<Record<string, unknown>>
  capabilities: { canWrite: boolean; canPostClose: boolean }
}

type Props = {
  orderId: string
  summary: AuditSummaryPayload | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function recipeLabel(item: Record<string, unknown>): string {
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

function quoteDetailRecipeLabel(d: {
  recipes?: { recipe_code?: string }
  master_recipes?: { master_code?: string }
}): string {
  if (d.recipes?.recipe_code) return d.recipes.recipe_code
  if (d.master_recipes?.master_code) return d.master_recipes.master_code
  return 'Línea de cotización'
}

export default function ConcreteEvidenceOrderAuditSections({
  orderId,
  summary,
  loading,
  error,
  onRefresh,
}: Props) {
  const canWrite = summary?.capabilities.canWrite ?? false
  const canPostClose = summary?.capabilities.canPostClose ?? false
  const order = summary?.order

  const [lineEditorOpen, setLineEditorOpen] = useState(false)
  const [lineEditorLine, setLineEditorLine] = useState<Record<string, unknown> | null>(null)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [previewNeedsPostCloseAck, setPreviewNeedsPostCloseAck] = useState(false)
  const [previewOrderSummaryAt, setPreviewOrderSummaryAt] = useState<number | undefined>(undefined)
  const [pendingOps, setPendingOps] = useState<FinanzasItemOp[]>([])
  const [pendingMeta, setPendingMeta] = useState<{
    kind: 'items' | 'requote' | 'recalc' | 'quote_detail'
    body?: Record<string, unknown>
    url?: string
    method?: string
  } | null>(null)

  const [quotePickOpen, setQuotePickOpen] = useState(false)
  const [quoteCandidates, setQuoteCandidates] = useState<
    Array<{
      id: string
      quote_number: string
      created_at: string
      line_preview: Array<{ recipe_code: string; final_price: number }>
      recipes_covered: number
      total_recipes_needed: number
      matches_order_recipes: boolean
      total: number
    }>
  >([])
  const [quoteCandidatesLoading, setQuoteCandidatesLoading] = useState(false)

  const [quoteLinesOpen, setQuoteLinesOpen] = useState(false)
  const [quoteLinePrices, setQuoteLinePrices] = useState<Record<string, string>>({})
  const [quoteLinesReason, setQuoteLinesReason] = useState('')
  const [quoteLinesBusy, setQuoteLinesBusy] = useState(false)

  const [addLineOpen, setAddLineOpen] = useState(false)
  const [addLineVol, setAddLineVol] = useState('')
  const [catalogProducts, setCatalogProducts] = useState<CatalogAdditionalProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [pickedAdditional, setPickedAdditional] = useState<CatalogAdditionalProduct | null>(null)

  const orderStatus = (order?.order_status as string) || ''
  const postCloseWarning =
    orderStatus === 'completed' || orderStatus === 'cancelled'

  const vatRate = useMemo(() => {
    const plant = order?.plant as
      | { business_unit?: { vat_rate?: number } | { vat_rate?: number }[] }
      | undefined
    const bu = plant?.business_unit
    const raw = Array.isArray(bu) ? bu[0]?.vat_rate : bu?.vat_rate
    return raw != null ? Number(raw) : 0.16
  }, [order])

  /** Same basis as vista previa API + recalculateOrderAmount: líneas asignadas, o remisiones si aún no hay reparto. */
  const perM3ConcreteVolumeForAdditional = useMemo(() => {
    if (!summary) return 0
    return concreteVolumeForPerM3AdditionalProduct({
      items: summary.order_items as OrderItemLike[],
      remisionesConcreteVolumeSum: summary.concrete_volume_delivered_sum,
    })
  }, [summary])

  const openLineEditor = (item: Record<string, unknown>) => {
    setLineEditorLine(item)
    setLineEditorOpen(true)
  }

  const loadQuoteCandidates = useCallback(async () => {
    setQuoteCandidatesLoading(true)
    try {
      const res = await fetch(`/api/finanzas/audit/order/${orderId}/quote-candidates`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setQuoteCandidates(json.data?.candidates || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
      setQuoteCandidates([])
    } finally {
      setQuoteCandidatesLoading(false)
    }
  }, [orderId])

  const runPreviewThenConfirm = useCallback(
    async (
      kind: NonNullable<typeof pendingMeta>['kind'],
      ops: FinanzasItemOp[],
      title: string,
      warnings: string[],
      _requirePostClose: boolean
    ) => {
      const res = await fetch(`/api/finanzas/audit/order/${orderId}/items?preview=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops, reason: 'preview' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Error en vista previa')
        return
      }
      const before = json.data?.estimates?.before
      const after = json.data?.estimates?.after
      const lineDiffs = (json.data?.line_diffs as OrderItemLineDiff[]) || []

      const lineRows: PreviewRow[] = []
      for (const d of lineDiffs) {
        for (const f of d.fields) {
          lineRows.push({
            label: `${d.line_label} — ${f.label}`,
            oldValue: f.old,
            newValue: f.new,
            tone: 'neutral',
          })
        }
      }

      const financeRows: PreviewRow[] =
        before && after
          ? buildFinancialEstimatePreviewRows(
              {
                subtotalConcrete: Number(before.subtotalConcrete) || 0,
                finalAmount:
                  before.finalAmount != null ? Number(before.finalAmount) : null,
                invoiceAmount:
                  before.invoiceAmount != null ? Number(before.invoiceAmount) : null,
              },
              {
                subtotalConcrete: Number(after.subtotalConcrete) || 0,
                finalAmount: after.finalAmount != null ? Number(after.finalAmount) : null,
                invoiceAmount:
                  after.invoiceAmount != null ? Number(after.invoiceAmount) : null,
              }
            )
          : []

      setPreviewTitle(title)
      setPreviewRows([...lineRows, ...financeRows])
      setPreviewOrderSummaryAt(lineRows.length > 0 ? lineRows.length : undefined)
      setPreviewWarnings(warnings)
      setPreviewNeedsPostCloseAck(postCloseWarning && canPostClose)
      setPendingOps(ops)
      setPendingMeta({ kind })
      setPreviewOpen(true)
    },
    [orderId, postCloseWarning, canPostClose]
  )

  const confirmPendingItems = async (reason: string, allowPostClose: boolean) => {
    const res = await fetch(`/api/finanzas/audit/order/${orderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ops: pendingOps,
        reason,
        allow_post_close: allowPostClose,
      }),
    })
    const json = await parseJsonResponse<{ error?: string }>(res)
    if (!res.ok) throw new Error(json.error || 'Error al guardar')
    toast.success('Cambios guardados')
    onRefresh()
  }

  const handleDeleteItem = (item: Record<string, unknown>) => {
    if (!item.id) return
    if (postCloseWarning && !canPostClose) {
      toast.error('No puede eliminar líneas en pedido completado/cancelado')
      return
    }
    const warnings: string[] = []
    if (postCloseWarning) warnings.push('Pedido en estado completado o cancelado.')
    void runPreviewThenConfirm(
      'items',
      [{ type: 'delete', id: String(item.id) }],
      'Eliminar línea del pedido',
      warnings,
      false
    )
  }

  const handleAddLinePreview = async () => {
    if (!summary) return
    const ap = pickedAdditional
    if (!ap) {
      toast.error('Seleccione un producto de la cotización')
      return
    }
    if (postCloseWarning && !canPostClose) {
      toast.error('No autorizado para corrección post-cierre')
      return
    }
    const totalConcreteVol = perM3ConcreteVolumeForAdditional
    const bt = ap.billingType
    const unitPrice = ap.unitPrice
    let volume: number
    let totalPrice: number
    if (bt === 'PER_ORDER_FIXED') {
      volume = 1
      totalPrice = unitPrice
    } else if (bt === 'PER_UNIT') {
      const vol = Number(addLineVol)
      if (!Number.isFinite(vol) || vol <= 0) {
        toast.error('Cantidad inválida')
        return
      }
      volume = vol
      totalPrice = vol * unitPrice
    } else {
      volume = ap.quantity
      if (totalConcreteVol <= 0) {
        toast.error('No hay volumen de concreto entregado para calcular cobro por m³')
        return
      }
      totalPrice = ap.quantity * totalConcreteVol * unitPrice
    }
    const warnings: string[] = []
    if (postCloseWarning) warnings.push('Pedido en estado completado o cancelado.')
    setAddLineOpen(false)
    setPickedAdditional(null)
    setAddLineVol('')
    await runPreviewThenConfirm(
      'items',
      [
        {
          type: 'insert',
          item: {
            quote_detail_id: null,
            recipe_id: null,
            master_recipe_id: null,
            product_type: `PRODUCTO ADICIONAL: ${ap.name} (${ap.code})`,
            volume,
            unit_price: unitPrice,
            total_price: totalPrice,
            has_pump_service: false,
            billing_type: bt,
          },
        },
      ],
      'Añadir producto adicional al pedido',
      warnings,
      false
    )
  }

  useEffect(() => {
    if (!addLineOpen || !summary?.order) return
    const o = summary.order as Record<string, unknown>
    const clientId = o.client_id as string | undefined
    const constructionSite = o.construction_site as string | undefined
    let cancelled = false
    ;(async () => {
      setCatalogLoading(true)
      setPickedAdditional(null)
      setCatalogProducts([])
      setAddLineVol('')
      if (!clientId || !constructionSite) {
        setCatalogLoading(false)
        toast.error('Falta cliente u obra en el pedido')
        return
      }
      try {
        const list = await fetchCatalogAdditionalProducts(supabase, {
          clientId,
          constructionSite,
          constructionSiteId: (o.construction_site_id as string | null | undefined) ?? null,
          orderQuoteId: (o.quote_id as string | null | undefined) ?? null,
        })
        if (!cancelled) setCatalogProducts(list)
      } catch (e) {
        console.error(e)
        if (!cancelled) toast.error('No se pudieron cargar productos adicionales')
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [addLineOpen, summary])

  const handleRecalculate = async () => {
    if (postCloseWarning && !canPostClose) {
      toast.error('No autorizado para recalcular pedidos completados/cancelados')
      return
    }
    const warnings: string[] = []
    if (postCloseWarning) warnings.push('Pedido completado o cancelado.')
    setPreviewTitle('Recalcular totales del pedido')
    setPreviewOrderSummaryAt(undefined)
    setPreviewRows([
      {
        label: 'Acción',
        oldValue: '—',
        newValue: 'Ejecutar recalculateOrderAmount + balance',
        tone: 'neutral',
      },
    ])
    setPreviewWarnings(warnings)
    setPreviewNeedsPostCloseAck(postCloseWarning && canPostClose)
    setPendingMeta({ kind: 'recalc' })
    setPendingOps([])
    setPreviewOpen(true)
  }

  const onPreviewConfirm = async (reason: string, allowPostClose: boolean) => {
    if (pendingMeta?.kind === 'recalc') {
      const res = await fetch(`/api/finanzas/audit/order/${orderId}/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, allow_post_close: allowPostClose }),
      })
      const json = await parseJsonResponse<{ error?: string }>(res)
      if (!res.ok) throw new Error(json.error || 'Error')
      toast.success('Totales recalculados')
      onRefresh()
      return
    }
    if (pendingMeta?.kind === 'items') {
      await confirmPendingItems(reason, allowPostClose)
      return
    }
    if (pendingMeta?.kind === 'requote' && pendingMeta.body) {
      const res = await fetch(`/api/finanzas/audit/order/${orderId}/requote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingMeta.body,
          reason,
          allow_post_close: allowPostClose,
        }),
      })
      const json = await parseJsonResponse<{ error?: string }>(res)
      if (!res.ok) throw new Error(json.error || 'Error')
      toast.success('Cotización aplicada')
      onRefresh()
      return
    }
    if (pendingMeta?.kind === 'quote_detail' && pendingMeta.url && pendingMeta.body) {
      const res = await fetch(pendingMeta.url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingMeta.body, reason }),
      })
      const json = await parseJsonResponse<{ error?: string }>(res)
      if (!res.ok) throw new Error(json.error || 'Error')
      toast.success('Línea de cotización actualizada')
      onRefresh()
      return
    }
  }

  const openQuoteLinesEditor = () => {
    const details = (summary.quote as { quote_details?: Array<{ id: string; final_price?: number }> })
      ?.quote_details
    const init: Record<string, string> = {}
    for (const d of details || []) {
      init[d.id] = String(d.final_price ?? '')
    }
    setQuoteLinePrices(init)
    setQuoteLinesReason('')
    setQuoteLinesOpen(true)
  }

  const saveQuoteLines = async () => {
    const reason = quoteLinesReason.trim()
    if (reason.length < 10) {
      toast.error('Motivo mín. 10 caracteres')
      return
    }
    const details = (summary.quote as { quote_details?: Array<{ id: string; final_price?: number }> })
      ?.quote_details
    setQuoteLinesBusy(true)
    try {
      for (const d of details || []) {
        const raw = quoteLinePrices[d.id]
        if (raw === undefined || raw === '') continue
        const final_price = Number(raw)
        if (!Number.isFinite(final_price) || final_price === Number(d.final_price)) continue
        const res = await fetch(`/api/finanzas/audit/quote-detail/${d.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ final_price, reason }),
        })
        const json = await parseJsonResponse<{ error?: string }>(res)
        if (!res.ok) throw new Error(json.error || 'Error al guardar línea')
      }
      toast.success('Cotización actualizada')
      setQuoteLinesOpen(false)
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setQuoteLinesBusy(false)
    }
  }

  const previewRequoteFromCandidate = async (targetQuoteId: string) => {
    if (postCloseWarning && !canPostClose) {
      toast.error('No autorizado para re-cotizar pedidos completados/cancelados')
      return
    }
    setQuotePickOpen(false)
    const res = await fetch(
      `/api/finanzas/audit/order/${orderId}/requote?preview=1`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_quote_id: targetQuoteId }),
      }
    )
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error || 'Error')
      return
    }
    const itemById = new Map(
      (summary.order_items || []).map((i) => [String(i.id), i] as const)
    )
    const pickedQuote = quoteCandidates.find((c) => c.id === targetQuoteId)
    const rows: PreviewRow[] =
      (json.data?.line_diffs as Array<Record<string, unknown>>)?.map((d) => {
        const oid = String(d.order_item_id)
        const item = itemById.get(oid)
        const lineName = item ? recipeLabel(item) : 'Línea'
        return {
          label: `${lineName} — Precio unitario (m³)`,
          oldValue: formatMxCurrency(Number(d.old_unit_price)),
          newValue: formatMxCurrency(Number(d.new_unit_price)),
          tone: 'neutral' as const,
        }
      }) ?? []
    setPreviewTitle('Aplicar cotización al pedido')
    setPreviewOrderSummaryAt(undefined)
    setPreviewRows(
      rows.length
        ? rows
        : [
            {
              label: 'Cotización',
              oldValue: '—',
              newValue: pickedQuote?.quote_number?.trim() || 'Cotización seleccionada',
            },
          ]
    )
    setPreviewWarnings(postCloseWarning ? ['Pedido completado o cancelado.'] : [])
    setPreviewNeedsPostCloseAck(postCloseWarning && canPostClose)
    setPendingMeta({
      kind: 'requote',
      body: { target_quote_id: targetQuoteId, confirm: true },
    })
    setPendingOps([])
    setPreviewOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando datos de auditoría…
      </div>
    )
  }
  if (error) {
    return <p className="text-destructive text-xs py-2">{error}</p>
  }
  if (!summary || !order) return null

  const prelim = order.preliminary_amount as number | null
  const itemsSum =
    summary.order_items?.reduce((s, i) => s + (Number(i.total_price) || 0), 0) ?? 0
  const mismatchPrelim =
    prelim != null && Math.abs(prelim - itemsSum) > 0.01

  return (
    <>
      <Collapsible className="rounded-lg border border-stone-200/80 bg-stone-50/50">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-stone-800 hover:bg-stone-100/80 rounded-t-lg [&[data-state=open]_svg:last-child]:rotate-180">
          <span className="inline-flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-stone-500" />
            Productos y precios ({summary.order_items?.length ?? 0})
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
            {mismatchPrelim && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900">
                Σ líneas {formatMxCurrency(itemsSum)} ≠ preliminar {formatMxCurrency(prelim)}
              </Badge>
            )}
            {canWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full text-[11px]"
                onClick={() => setAddLineOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Añadir producto adicional
              </Button>
            )}
            {(summary.order_items || []).map((item) => (
              <div
                key={String(item.id)}
                className="rounded border border-stone-200/60 bg-background px-2 py-1.5 text-xs space-y-1"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-stone-900 truncate">
                    {recipeLabel(item)}
                  </span>
                  {canWrite && (
                    <div className="flex shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openLineEditor(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteItem(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground tabular-nums">
                  Vol {item.volume ?? '—'} · PU {formatMxCurrency(Number(item.unit_price))} · Total{' '}
                  {formatMxCurrency(Number(item.total_price))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible className="rounded-lg border border-stone-200/80 bg-stone-50/50">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-stone-800 hover:bg-stone-100/80 rounded-t-lg [&[data-state=open]_svg:last-child]:rotate-180">
          <span className="inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-stone-500" />
            Cotización vinculada
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2 text-xs">
            {summary.quote ? (
              <>
                <p>
                  <span className="text-muted-foreground">Folio:</span>{' '}
                  <span className="font-medium text-stone-800">
                    {String((summary.quote as { quote_number?: string }).quote_number || '—')}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Estado:</span>{' '}
                  {String((summary.quote as { status?: string }).status)}
                </p>
                <Button variant="outline" size="sm" className="h-8" asChild>
                  <Link
                    href={`/quotes?id=${String((summary.quote as { id?: string }).id)}`}
                    target="_blank"
                  >
                    Ver cotización
                  </Link>
                </Button>
                {canWrite && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-stone-200/60">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-fit"
                      onClick={openQuoteLinesEditor}
                    >
                      Editar líneas (precios cotización)
                    </Button>
                    <Label className="text-[11px]">Cambiar cotización del pedido</Label>
                    <Popover
                      open={quotePickOpen}
                      onOpenChange={(o) => {
                        setQuotePickOpen(o)
                        if (o) void loadQuoteCandidates()
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 w-full justify-between font-normal"
                          disabled={quoteCandidatesLoading}
                        >
                          <span className="truncate text-[11px]">
                            Buscar cotización APPROVED…
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Filtrar por número o fecha…" className="h-8" />
                          <CommandList>
                            <CommandEmpty>
                              {quoteCandidatesLoading ? (
                                <span className="flex items-center justify-center gap-2 py-4 text-xs">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                                </span>
                              ) : (
                                <span className="text-xs">Sin cotizaciones.</span>
                              )}
                            </CommandEmpty>
                            <CommandGroup heading="Cotizaciones del cliente y obra">
                              {quoteCandidates.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.quote_number} ${c.id}`}
                                  className="text-xs flex flex-col items-start gap-0.5 py-2"
                                  onSelect={() => void previewRequoteFromCandidate(c.id)}
                                >
                                  <div className="flex w-full items-center gap-2">
                                    <span className="font-medium truncate">{c.quote_number}</span>
                                    {c.matches_order_recipes && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] h-5 shrink-0 bg-emerald-50"
                                      >
                                        Cubre recetas
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(c.created_at), 'dd MMM yyyy', { locale: es })} ·{' '}
                                    {c.recipes_covered}/{c.total_recipes_needed || '—'} recetas · Σ{' '}
                                    {formatMxCurrency(c.total)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin cotización vinculada</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {(summary.pumping_remisiones_count ?? 0) > 0 && (
        <Collapsible className="rounded-lg border border-stone-200/80 bg-stone-50/50">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-stone-800 hover:bg-stone-100/80 rounded-t-lg [&[data-state=open]_svg:last-child]:rotate-180">
            <span className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-stone-500" />
              Bombeo ({summary.pumping_remisiones_count})
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Remisiones bombeadas: {summary.pumping_volume_sum.toFixed(2)} m³ · Precio pedido (vol.
                bombeo): {summary.pump_priced_volume.toFixed(2)} m³
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {(summary.pumping_remisiones || []).map((r) => (
                  <li
                    key={String(r.id)}
                    className="rounded border border-stone-200/60 bg-background px-2 py-1.5 text-xs"
                  >
                    <div className="font-medium">{String(r.remision_number)}</div>
                    <div className="text-muted-foreground text-[11px] tabular-nums">
                      {formatRemisionFechaForDisplay(r.fecha as string)}
                      {formatHoraCargaForDisplay(r.hora_carga as string | null) ? (
                        <span className="ml-1">
                          {formatHoraCargaForDisplay(r.hora_carga as string | null)}
                        </span>
                      ) : null}
                      {r.volumen_fabricado != null && (
                        <span className="ml-2">
                          · {String(r.volumen_fabricado)} {String(r.unidad || 'm³')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible className="rounded-lg border border-stone-200/80 bg-stone-50/50">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-stone-800 hover:bg-stone-100/80 rounded-t-lg [&[data-state=open]_svg:last-child]:rotate-180">
          <span className="inline-flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-stone-500" />
            Totales y facturación
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2 text-xs">
            <p>
              Preliminar: {formatMxCurrency(order.preliminary_amount as number | null)}
            </p>
            <p>Final: {formatMxCurrency(order.final_amount as number | null)}</p>
            <p>Factura: {formatMxCurrency(order.invoice_amount as number | null)}</p>
            <p>Requiere factura: {order.requires_invoice ? 'Sí' : 'No'}</p>
            <p>IVA planta: {(vatRate * 100).toFixed(2)}%</p>
            {canWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => void handleRecalculate()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recalcular totales
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <OrderLineEditorDialog
        open={lineEditorOpen}
        onOpenChange={setLineEditorOpen}
        orderId={orderId}
        line={lineEditorLine}
        order={order}
        canWrite={canWrite}
        canPostClose={canPostClose}
        postCloseWarning={postCloseWarning}
        onRefresh={onRefresh}
        linkedQuoteNumberFromOrder={
          summary?.quote
            ? String((summary.quote as { quote_number?: string | null }).quote_number || '').trim() ||
              null
            : null
        }
        onRunItemsPreview={async (ops, title, warnings) => {
          await runPreviewThenConfirm('items', ops, title, warnings, false)
        }}
      />

      <PriceChangePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={previewTitle}
        rows={previewRows}
        orderSummaryStartsAtIndex={previewOrderSummaryAt}
        warnings={previewWarnings}
        requirePostCloseAck={previewNeedsPostCloseAck}
        onConfirm={async (reason, allow) => {
          await onPreviewConfirm(reason, allow)
        }}
      />

      <Dialog open={quoteLinesOpen} onOpenChange={setQuoteLinesOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar precios en cotización</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            {(
              (
                summary.quote as {
                  quote_details?: Array<{
                    id: string
                    final_price?: number
                    recipes?: { recipe_code?: string }
                    master_recipes?: { master_code?: string }
                  }>
                }
              )?.quote_details || []
            ).map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <span
                  className="text-[11px] text-stone-800 w-28 sm:w-36 shrink-0 truncate font-medium"
                  title={quoteDetailRecipeLabel(d)}
                >
                  {quoteDetailRecipeLabel(d)}
                </span>
                <Input
                  className="h-8 tabular-nums"
                  value={quoteLinePrices[d.id] ?? ''}
                  onChange={(e) =>
                    setQuoteLinePrices((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div>
              <Label>Motivo (auditoría)</Label>
              <Input
                value={quoteLinesReason}
                onChange={(e) => setQuoteLinesReason(e.target.value)}
                className="h-9 mt-1"
                placeholder="Mínimo 10 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteLinesOpen(false)}>
              Cerrar
            </Button>
            <Button disabled={quoteLinesBusy} onClick={() => void saveQuoteLines()}>
              {quoteLinesBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addLineOpen}
        onOpenChange={(open) => {
          setAddLineOpen(open)
          if (!open) {
            setPickedAdditional(null)
            setAddLineVol('')
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 overflow-hidden border-stone-200 p-0 shadow-lg sm:rounded-xl">
          <DialogHeader className="space-y-2 border-b border-stone-200/80 bg-stone-50/80 px-6 py-5 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-stone-900">
              Producto adicional
            </DialogTitle>
            <DialogDescription className="text-sm text-stone-600 leading-relaxed">
              Elija un producto definido en la cotización aprobada del cliente. Los precios y la forma de facturación
              provienen de la cotización.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5 text-sm">
            {catalogLoading ? (
              <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-6 text-stone-600">
                <Loader2 className="h-5 w-5 animate-spin shrink-0 text-stone-500" />
                <span>Cargando catálogo de cotización…</span>
              </div>
            ) : catalogProducts.length === 0 ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 leading-relaxed">
                No hay productos adicionales en cotizaciones aprobadas para este cliente y obra. Revise la cotización o
                agregue el producto desde la ficha del pedido.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="additional-product-combo" className="text-sm font-medium text-stone-800">
                    Producto de cotización
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="additional-product-combo"
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="h-auto min-h-11 w-full justify-between gap-2 border-stone-300 bg-white px-3 py-2.5 text-left font-normal text-stone-900 shadow-sm hover:bg-stone-50/80"
                      >
                        <span className="line-clamp-2 min-w-0 flex-1">
                          {pickedAdditional ? (
                            <>
                              <span className="block font-medium leading-snug">
                                {additionalProductTriggerLabel(pickedAdditional)}
                              </span>
                              {pickedAdditional.code && /^ADDL-/i.test(pickedAdditional.code.trim()) ? (
                                <span className="mt-0.5 block text-xs font-mono text-stone-500">
                                  Ref. {pickedAdditional.code.trim()}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Seleccionar producto…</span>
                          )}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command className="rounded-md border-0">
                        <CommandInput placeholder="Buscar por nombre…" className="h-11 border-b" />
                        <CommandList className="max-h-64">
                          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                            Sin resultados.
                          </CommandEmpty>
                          <CommandGroup className="p-1">
                            {catalogProducts.map((p) => (
                              <CommandItem
                                key={p.quoteAdditionalProductId}
                                value={`${p.name} ${p.code} ${p.billingType}`}
                                className="cursor-pointer rounded-md px-2 py-2.5 aria-selected:bg-stone-100"
                                onSelect={() => {
                                  setPickedAdditional(p)
                                  setAddLineVol(String(p.quantity))
                                }}
                              >
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="font-medium leading-snug text-stone-900">{p.name.trim()}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatMxCurrency(p.unitPrice)} · {p.billingType}
                                    {p.code && !/^ADDL-/i.test(p.code.trim()) ? ` · ${p.code}` : ''}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {pickedAdditional && (
                  <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
                    <dl className="divide-y divide-stone-100 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <dt className="text-stone-600">Facturación</dt>
                        <dd>
                          <Badge variant="secondary" className="font-mono text-xs font-medium">
                            {pickedAdditional.billingType}
                          </Badge>
                        </dd>
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                        <dt className="text-stone-600">Precio unitario</dt>
                        <dd className="font-mono text-base font-semibold tabular-nums text-stone-900">
                          {formatMxCurrency(pickedAdditional.unitPrice)}
                        </dd>
                      </div>
                      {pickedAdditional.billingType === 'PER_M3' && summary ? (
                        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                          <dt className="text-stone-600">Volumen concreto entregado</dt>
                          <dd className="font-mono tabular-nums text-stone-900">
                            {perM3ConcreteVolumeForAdditional.toFixed(2)} m³
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                )}

                {pickedAdditional?.billingType === 'PER_UNIT' && (
                  <div className="space-y-2">
                    <Label htmlFor="additional-product-qty" className="text-sm font-medium text-stone-800">
                      Cantidad
                    </Label>
                    <Input
                      id="additional-product-qty"
                      className="h-11 border-stone-300 bg-white text-base tabular-nums shadow-sm"
                      value={addLineVol}
                      onChange={(e) => setAddLineVol(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <Separator />

          <DialogFooter className="flex-row justify-end gap-2 border-t border-stone-200/80 bg-stone-50/50 px-6 py-4 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11 border-stone-300" onClick={() => setAddLineOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="solid"
              size="lg"
              className="min-h-11 min-w-[8rem]"
              disabled={catalogLoading || !pickedAdditional || catalogProducts.length === 0}
              onClick={() => void handleAddLinePreview()}
            >
              Vista previa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
