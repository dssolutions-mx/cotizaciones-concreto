'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePlantContext } from '@/contexts/PlantContext'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'
import { cn } from '@/lib/utils'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import Link from 'next/link'
import {
  Package, Truck, ChevronDown, ChevronUp, Edit2, ExternalLink,
  FileText, AlertTriangle, DollarSign, Clock, TrendingDown,
  ShoppingCart, Download, X, Search, CalendarDays, BookOpen, HelpCircle, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import CreatePOModal from '@/components/po/CreatePOModal'
import EditPOModal from '@/components/po/EditPOModal'
import POLifecycleView from '@/components/po/POLifecycleView'
import { procurementEntriesUrl } from '@/lib/procurement/navigation'
import type { MaterialAlert } from '@/types/alerts'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  partial: 'Parcial',
  fulfilled: 'Completada',
  closed: 'Completada',
  cancelled: 'Cancelada',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700 border border-sky-200',
  partial: 'bg-amber-50 text-amber-700 border border-amber-200',
  fulfilled: 'bg-green-50 text-green-700 border border-green-200',
  closed: 'bg-green-50 text-green-700 border border-green-200',
  cancelled: 'bg-muted text-muted-foreground border border-border',
}

const PAYMENT_TERMS_LABELS: Record<number, string> = {
  0: 'Contado',
  15: 'Net 15',
  30: 'Net 30',
  45: 'Net 45',
  60: 'Net 60',
}

const ALERT_STATUS_PO_LABELS: Record<string, string> = {
  pending_po: 'Requiere OC',
  po_linked: 'OC vinculada',
  delivery_scheduled: 'Entrega programada',
  validated: 'Validada',
  pending_validation: 'Pendiente validación',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
}

function isM3Uom(uom: string | null | undefined): boolean {
  const u = (uom || '').toLowerCase().trim()
  return u === 'm3' || u === 'm³'
}

/** Short label for qty columns; expands m³ for clarity in OC views */
function uomQtyLabel(uom: string | null | undefined): string {
  if (isM3Uom(uom)) return 'm³'
  return uom || 'und'
}

/** Longer UoM hint (e.g. volumetric orders) */
function uomDetailLine(uom: string | null | undefined): string | null {
  if (isM3Uom(uom)) return 'Volumen en metros cúbicos (m³)'
  return null
}

/** MXN formatter that preserves fractional precision for unit prices (up to 20 decimals). */
function createMxnPriceFormatter() {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  })
}

/** Mirrors `PoLinePreview` from GET /api/po/batch-summary (client-safe duplicate). */
type PoLinePreview = {
  title: string
  unit_price: number
  uom: string | null
  qty_ordered: number
  is_service: boolean
  material_supplier_name: string | null
  is_m3: boolean
  volumetric_kg_per_m3: number | null
}

function PODetailPanel({
  po, items, summary, batchSummary, linkedAlerts, alertsLoading,
  payablesCount, mxn, mxnPrice, canEdit, onEdit, onDelete, onClose,
}: {
  po: any
  items: any[]
  summary?: { total_ordered_value: number; total_received_value: number; total_credits: number; net_total: number }
  batchSummary?: { total_ordered_value: number; total_received_value: number; net_line_value: number }
  linkedAlerts?: MaterialAlert[]
  alertsLoading: boolean
  payablesCount?: number
  mxn: Intl.NumberFormat
  mxnPrice: Intl.NumberFormat
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const ordered = batchSummary?.total_ordered_value ?? 0
  const received = batchSummary?.total_received_value ?? 0
  const pct = ordered > 1e-6 ? Math.min(100, Math.round((received / ordered) * 1000) / 10) : 0
  const paymentLabel = po.payment_terms_days != null
    ? (PAYMENT_TERMS_LABELS[po.payment_terms_days] ?? `Net ${po.payment_terms_days}`)
    : null
  const raw = (po.po_date || po.created_at || '').toString().slice(0, 10)
  const d0 = new Date(raw + (raw.length <= 10 ? 'T12:00:00' : ''))
  const daysOpen = !Number.isNaN(d0.getTime()) && (po.status === 'open' || po.status === 'partial')
    ? Math.floor((Date.now() - d0.getTime()) / 86400000)
    : null

  return (
    <div className="w-[360px] xl:w-[400px] shrink-0 flex flex-col overflow-hidden border-l border-border/60 bg-card">
      {/* Sticky header */}
      <div className="shrink-0 px-5 py-4 border-b border-border/40 bg-stone-50/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base truncate">
                {po.po_number || `PO #${po.id.slice(0, 8)}`}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[po.status] || 'bg-muted text-muted-foreground border border-border'}`}>
                {STATUS_LABELS[po.status] || po.status}
              </span>
              {daysOpen !== null && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  {daysOpen}d abierta
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1 truncate">
              {po.supplier?.name ?? po.supplier_id?.slice(0, 12) ?? '—'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <Link
            href={procurementEntriesUrl({ plantId: po.plant_id, poId: po.id })}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver entradas
          </Link>
          {payablesCount !== undefined && payablesCount > 0 && (
            <Link
              href={`/finanzas/procurement?tab=cxp&po_id=${po.id}${po.supplier_id ? `&supplier_id=${encodeURIComponent(po.supplier_id)}` : ''}`}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              {payablesCount} factura{payablesCount !== 1 ? 's' : ''}
            </Link>
          )}
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={onEdit}
                title="Editar OC"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                title="Eliminar OC"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Financial summary */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Resumen Financiero
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Valor ordenado</div>
              <div className="font-bold tabular-nums text-sm mt-0.5">{mxn.format(ordered)}</div>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2.5">
              <div className="text-[11px] text-green-600">Valor recibido</div>
              <div className="font-bold tabular-nums text-sm mt-0.5 text-green-700">{mxn.format(received)}</div>
            </div>
            {(summary?.total_credits ?? 0) > 0 && (
              <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5">
                <div className="text-[11px] text-orange-500">Créditos</div>
                <div className="font-bold tabular-nums text-sm mt-0.5 text-orange-700">
                  -{mxn.format(summary!.total_credits)}
                </div>
              </div>
            )}
            {summary && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <div className="text-[11px] text-emerald-600">Neto</div>
                <div className="font-bold tabular-nums text-sm mt-0.5 text-emerald-700">
                  {mxn.format(summary.net_total)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Fulfillment progress */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Avance de recepción
            </h3>
            <span className="text-sm font-bold tabular-nums">{pct}%</span>
          </div>
          <div className="w-full bg-muted/40 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-muted'
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>{mxn.format(received)} recibido</span>
            <span>de {mxn.format(ordered)}</span>
          </div>
        </section>

        {/* PO details */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Detalles
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-[11px] text-muted-foreground">Planta</dt>
              <dd className="text-sm font-medium mt-0.5 truncate">
                {po.plant?.name ?? po.plant?.code ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Fecha OC</dt>
              <dd className="text-sm font-medium mt-0.5">
                {po.po_date
                  ? format(new Date(po.po_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Términos de pago</dt>
              <dd className="text-sm font-medium mt-0.5">{paymentLabel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Líneas</dt>
              <dd className="text-sm font-medium mt-0.5">{items.length > 0 ? items.length : '—'}</dd>
            </div>
            {po.approved_by && (
              <div className="col-span-2">
                <dt className="text-[11px] text-muted-foreground">Aprobado por</dt>
                <dd className="text-sm font-medium mt-0.5">{po.approved_by}</dd>
              </div>
            )}
          </dl>
          {po.notes && (
            <div className="mt-3 rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2.5">
              <div className="text-[11px] font-medium text-amber-700 mb-1">Notas</div>
              <p className="text-xs text-amber-900 leading-relaxed">{po.notes}</p>
            </div>
          )}
          {po.cancellation_reason && (
            <div className="mt-3 rounded-lg bg-red-50/60 border border-red-100 px-3 py-2.5">
              <div className="text-[11px] font-medium text-red-700 mb-1">Motivo de cancelación</div>
              <p className="text-xs text-red-900 leading-relaxed">{po.cancellation_reason}</p>
            </div>
          )}
        </section>

        {/* Lifecycle */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Ciclo de vida
          </h3>
          <POLifecycleView poId={po.id} plantId={po.plant_id} />
        </section>

        {/* Line items */}
        {items.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Líneas ({items.length})
            </h3>
            <div className="space-y-1.5">
              {items.map((item: any) => {
                const orderedQty = Number(item.qty_ordered) || 0
                const receivedQty = Number(item.qty_received ?? item.qty_received_kg ?? item.qty_received_native ?? 0) || 0
                const itemProgress = orderedQty > 0 ? Math.min((receivedQty / orderedQty) * 100, 100) : 0
                const unitPrice = Number(item.unit_price || 0)
                const lineTotal = orderedQty * unitPrice
                const isItemOverdue = item.required_by && new Date(item.required_by + 'T00:00:00') < new Date()
                const matSupplierName = item.material_supplier?.name as string | undefined
                const volKg = item.volumetric_weight_kg_per_m3 != null ? Number(item.volumetric_weight_kg_per_m3) : null
                const title = item.is_service
                  ? (item.service_description || 'Servicio de flota')
                  : (item.material?.material_name || item.material?.material_code || 'Material')
                const uomLong = uomDetailLine(item.uom)
                return (
                  <div key={item.id} className="rounded-lg border border-border/50 px-3 py-2.5 bg-muted/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-2 min-w-0 flex-1">
                        {item.is_service
                          ? <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                          : <Package className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-sm font-semibold text-foreground leading-snug break-words">
                            {title}
                          </div>
                          {item.is_service && matSupplierName && (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-stone-600">Proveedor de material: </span>
                              {matSupplierName}
                            </div>
                          )}
                          {!item.is_service && isM3Uom(item.uom) && (
                            <div className="text-[11px] text-muted-foreground space-y-0.5">
                              <div>{uomLong}</div>
                              {volKg != null && !Number.isNaN(volKg) && (
                                <div>
                                  Referencia pactada: <span className="tabular-nums font-medium text-stone-700">{volKg.toLocaleString('es-MX')} kg/m³</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Precio unit.
                        </div>
                        <div className="text-base font-bold tabular-nums text-foreground leading-tight">
                          {mxnPrice.format(unitPrice)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          por {uomQtyLabel(item.uom)}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums pt-1 border-t border-border/40 mt-1">
                          Subtotal {mxnPrice.format(lineTotal)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span className="tabular-nums">
                        <span className="font-medium text-stone-700">Ordenado:</span>{' '}
                        {orderedQty.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {uomQtyLabel(item.uom)}
                      </span>
                      <span className="tabular-nums">
                        · <span className="font-medium text-stone-700">Recibido:</span>{' '}
                        {receivedQty.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {uomQtyLabel(item.uom)}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 font-semibold text-[10px] ${STATUS_COLORS[item.status] || 'bg-muted text-muted-foreground border border-border'}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      {isItemOverdue && (item.status === 'open' || item.status === 'partial') && (
                        <span className="text-red-600 font-medium">⚠ Vencido</span>
                      )}
                    </div>
                    {!item.is_service && (
                      <div className="mt-1.5">
                        <div className="w-full bg-muted/30 rounded-full h-1">
                          <div
                            className={cn('h-1 rounded-full transition-all', itemProgress >= 100 ? 'bg-green-500' : itemProgress > 0 ? 'bg-amber-400' : 'bg-muted')}
                            style={{ width: `${itemProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Alerts */}
        {alertsLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        )}
        {!alertsLoading && linkedAlerts && linkedAlerts.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Alertas vinculadas ({linkedAlerts.length})
            </h3>
            <div className="space-y-1.5">
              {linkedAlerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-amber-200/70 bg-amber-50/30 px-3 py-2 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-stone-500">{a.alert_number}</span>
                      <span className="text-xs text-stone-800 truncate">{a.material?.material_name ?? 'Material'}</span>
                    </div>
                    {a.scheduled_delivery_date && (
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Entrega: {a.scheduled_delivery_date}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {ALERT_STATUS_PO_LABELS[a.status] ?? a.status}
                    </Badge>
                    <Link href="/production-control/alerts">
                      <ExternalLink className="h-3 w-3 text-primary" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function POKPICards({
  pos,
  loading,
  batchSummaries,
}: {
  pos: any[]
  loading: boolean
  batchSummaries: Record<string, { total_ordered_value: number; total_received_value: number; net_line_value: number }>
}) {
  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const kpis = useMemo(() => {
    const open = pos.filter(p => p.status === 'open' || p.status === 'partial')
    const completed = pos.filter(p => p.status === 'fulfilled' || p.status === 'closed')
    const cancelled = pos.filter(p => p.status === 'cancelled')
    const now = new Date()
    const thisMonth = pos.filter(p => {
      const d = new Date(p.po_date || p.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    let totalOrdered = 0
    let totalReceived = 0
    for (const p of pos) {
      const s = batchSummaries[p.id]
      if (s) {
        totalOrdered += s.total_ordered_value
        totalReceived += s.total_received_value
      }
    }
    const fulfillmentPct =
      totalOrdered > 1e-6 ? Math.round((totalReceived / totalOrdered) * 1000) / 10 : 0
    const openDays: number[] = []
    for (const p of open) {
      const d0 = new Date((p.po_date || p.created_at || '').toString().slice(0, 10) + 'T12:00:00')
      if (!Number.isNaN(d0.getTime())) {
        openDays.push(Math.max(0, Math.floor((now.getTime() - d0.getTime()) / 86400000)))
      }
    }
    const avgDaysOpen =
      openDays.length > 0 ? Math.round(openDays.reduce((a, b) => a + b, 0) / openDays.length) : 0
    return { open, completed, cancelled, thisMonth, totalOrdered, totalReceived, fulfillmentPct, avgDaysOpen }
  }, [pos, batchSummaries])

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-14 w-full" /></CardContent></Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor ordenado (vista)</CardTitle>
          <ShoppingCart className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-blue-600 tabular-nums">{mxn.format(kpis.totalOrdered)}</div>
          <p className="text-xs text-muted-foreground mt-1">página actual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor recibido</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-green-600 tabular-nums">{mxn.format(kpis.totalReceived)}</div>
          <p className="text-xs text-muted-foreground mt-1">fulfillment {kpis.fulfillmentPct}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Órdenes activas</CardTitle>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.open.length}</div>
          <p className="text-xs text-muted-foreground mt-1">
            días prom. abierta: {kpis.avgDaysOpen || '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Este mes / cancel.</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground/50" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums">
            {kpis.thisMonth.length} <span className="text-muted-foreground font-normal text-sm">emitidas</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Canceladas: {kpis.cancelled.length}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PurchaseOrdersPage() {
  const searchParams = useSearchParams()
  const supplierIdFromUrl = searchParams.get('supplier_id') || undefined
  const poIdFromUrl = searchParams.get('po_id') || undefined
  const filterFromUrl = searchParams.get('filter') || undefined
  const { currentPlant, availablePlants } = usePlantContext()
  const { profile } = useAuthSelectors()
  const canCreateOrEditPO = profile?.role === 'EXECUTIVE' || profile?.role === 'ADMIN_OPERATIONS'

  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<any[]>([])
  const [plant, setPlant] = useState<string>('')
  const [supplier, setSupplier] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [status, setStatus] = useState<string>('all')
  const [paymentTerms, setPaymentTerms] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [poSearch, setPoSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'value_desc'>('date_desc')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [expandedPo, setExpandedPo] = useState<string | null>(null)
  const [poItems, setPoItems] = useState<Record<string, any[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [poSummaries, setPoSummaries] = useState<Record<string, { total_ordered_value: number; total_received_value: number; total_credits: number; net_total: number }>>({})
  const [relatedPayablesCount, setRelatedPayablesCount] = useState<Record<string, number>>({})
  const [linkedAlertsByPo, setLinkedAlertsByPo] = useState<Record<string, MaterialAlert[] | undefined>>({})
  const [linkedAlertsLoading, setLinkedAlertsLoading] = useState<Record<string, boolean>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [batchSummaries, setBatchSummaries] = useState<
    Record<string, { total_ordered_value: number; total_received_value: number; net_line_value: number }>
  >({})
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({})
  const [linePreviewsByPo, setLinePreviewsByPo] = useState<Record<string, PoLinePreview[]>>({})
  const [linePreviewOverflowByPo, setLinePreviewOverflowByPo] = useState<Record<string, number>>({})
  const [detailPoId, setDetailPoId] = useState<string | null>(null)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])
  const mxnPrice = useMemo(() => createMxnPriceFormatter(), [])

  const hasActiveFilters = plant || supplier || (status && status !== 'all') || (paymentTerms && paymentTerms !== 'all') || dateFrom || dateTo || poSearch

  const fetchPOs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (plant) params.set('plant_id', plant)
      if (supplier) params.set('supplier_id', supplier)
      if (status && status !== 'all') {
        params.set('status', status)
      }
      if (paymentTerms && paymentTerms !== 'all') params.set('payment_terms_days', paymentTerms)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (poSearch) params.set('po_number', poSearch)
      params.set('limit', String(pageSize))
      params.set('offset', String(page * pageSize))

      const res = await fetch(`/api/po?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg =
          typeof body.error === 'string'
            ? body.error
            : res.status === 403
              ? 'No tiene permiso para ver órdenes de compra en este contexto.'
              : 'Error al cargar órdenes'
        throw new Error(msg)
      }
      const data = await res.json()
      let rows = data.purchase_orders || []
      setTotalCount(typeof data.total_count === 'number' ? data.total_count : rows.length)

      if (poIdFromUrl) {
        rows = rows.filter((po: any) => po.id === poIdFromUrl)
      }

      setPos(rows)

      const ids = rows.map((r: { id: string }) => r.id).filter(Boolean)
      if (ids.length > 0) {
        try {
          const bs = await fetch(`/api/po/batch-summary?ids=${ids}`)
          const bsJson = await bs.json()
          setBatchSummaries(bsJson.summaries || {})
          setAlertCounts(bsJson.alert_counts || {})
          setLinePreviewsByPo(bsJson.line_previews || {})
          setLinePreviewOverflowByPo(bsJson.line_preview_overflow || {})
        } catch {
          setBatchSummaries({})
          setAlertCounts({})
          setLinePreviewsByPo({})
          setLinePreviewOverflowByPo({})
        }
      } else {
        setBatchSummaries({})
        setAlertCounts({})
        setLinePreviewsByPo({})
        setLinePreviewOverflowByPo({})
      }

      if (poIdFromUrl && rows.length > 0) {
        setExpandedPo(rows[0].id)
        fetchPOItems(rows[0].id)
        fetchPOSummary(rows[0].id)
        fetchRelatedPayables(rows[0].id)
        void fetchLinkedAlertsForPo(rows[0].id)
      }
    } catch {
      setError('No se pudieron cargar las órdenes de compra')
    } finally {
      setLoading(false)
    }
  }, [plant, supplier, status, paymentTerms, dateFrom, dateTo, poSearch, poIdFromUrl, page, pageSize])

  const fetchPOItems = async (poId: string) => {
    if (poItems[poId]) return
    try {
      const res = await fetch(`/api/po/${poId}/items`)
      const data = await res.json()
      setPoItems(prev => ({ ...prev, [poId]: data.items || [] }))
    } catch {
      // ignore
    }
  }

  const fetchPOSummary = async (poId: string) => {
    if (poSummaries[poId]) return
    try {
      const res = await fetch(`/api/po/${poId}/summary`)
      const data = await res.json()
      if (data.po_id) {
        setPoSummaries(prev => ({ ...prev, [poId]: data }))
      }
    } catch { /* ignore */ }
  }

  const fetchRelatedPayables = async (poId: string) => {
    if (relatedPayablesCount[poId] !== undefined) return
    try {
      const res = await fetch(`/api/po/${poId}/related-payables`)
      const data = await res.json()
      setRelatedPayablesCount(prev => ({ ...prev, [poId]: (data.payables || []).length }))
    } catch { /* ignore */ }
  }

  const fetchLinkedAlertsForPo = async (poId: string) => {
    if (linkedAlertsByPo[poId] !== undefined) return
    setLinkedAlertsLoading(prev => ({ ...prev, [poId]: true }))
    try {
      const res = await fetch(`/api/alerts/material?existing_po_id=${encodeURIComponent(poId)}`)
      const data = await res.json()
      if (data.success) {
        setLinkedAlertsByPo(prev => ({ ...prev, [poId]: data.data || [] }))
      } else {
        setLinkedAlertsByPo(prev => ({ ...prev, [poId]: [] }))
      }
    } catch {
      setLinkedAlertsByPo(prev => ({ ...prev, [poId]: [] }))
    } finally {
      setLinkedAlertsLoading(prev => ({ ...prev, [poId]: false }))
    }
  }

  const toggleExpanded = (poId: string) => {
    if (expandedPo === poId) {
      setExpandedPo(null)
    } else {
      setExpandedPo(poId)
      fetchPOItems(poId)
      fetchPOSummary(poId)
      fetchRelatedPayables(poId)
      void fetchLinkedAlertsForPo(poId)
    }
  }

  const handleSelectPo = (poId: string) => {
    setDetailPoId(prev => (prev === poId ? null : poId))
    fetchPOItems(poId)
    fetchPOSummary(poId)
    fetchRelatedPayables(poId)
    void fetchLinkedAlertsForPo(poId)
  }

  const clearFilters = () => {
    setPlant('')
    setSupplier('')
    setStatus('all')
    setPaymentTerms('all')
    setDateFrom('')
    setDateTo('')
    setPoSearch('')
  }

  const confirmDeletePo = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/po/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'No se pudo eliminar la orden de compra')
        return
      }
      toast.success('Orden de compra eliminada')
      setDeleteTarget(null)
      setPos((prev) => prev.filter((p) => p.id !== id))
      setTotalCount((c) => Math.max(0, c - 1))
      setBatchSummaries((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setAlertCounts((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setPoSummaries((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setRelatedPayablesCount((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setPoItems((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setLinkedAlertsByPo((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      if (expandedPo === id) setExpandedPo(null)
      if (selectedPoId === id) {
        setSelectedPoId(null)
        setEditOpen(false)
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  const exportExcel = async () => {
    if (pos.length === 0) return
    const XLSX = await import('xlsx')
    const rows = pos.map(po => ({
      PO: po.po_number || po.id.slice(0, 8),
      Proveedor: po.supplier?.name || po.supplier_id,
      Planta: po.plant?.name || po.plant_id,
      Estado: STATUS_LABELS[po.status] || po.status,
      Fecha: po.po_date || po.created_at?.slice(0, 10),
      Terminos_Pago: PAYMENT_TERMS_LABELS[po.payment_terms_days] || `${po.payment_terms_days} días`,
      Notas: po.notes || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Órdenes de Compra')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ordenes_compra_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const sortedPos = useMemo(() => {
    const sorted = [...pos]
    if (sortBy === 'date_desc') {
      sorted.sort((a, b) => new Date(b.po_date || b.created_at).getTime() - new Date(a.po_date || a.created_at).getTime())
    } else if (sortBy === 'date_asc') {
      sorted.sort((a, b) => new Date(a.po_date || a.created_at).getTime() - new Date(b.po_date || b.created_at).getTime())
    } else if (sortBy === 'value_desc') {
      sorted.sort((a, b) => {
        const va = batchSummaries[a.id]?.total_ordered_value ?? 0
        const vb = batchSummaries[b.id]?.total_ordered_value ?? 0
        return vb - va
      })
    }
    if (filterFromUrl === 'ready_close') {
      return sorted.filter((po) => {
        if (po.status !== 'open' && po.status !== 'partial') return false
        const s = batchSummaries[po.id]
        if (!s || s.total_ordered_value < 1e-6) return false
        return s.total_received_value >= s.total_ordered_value * 0.999
      })
    }
    if (filterFromUrl === 'stale_partial') {
      const cutoff = Date.now() - 15 * 86400000
      return sorted.filter((po) => {
        if (po.status !== 'partial') return false
        const raw = (po.po_date || po.created_at || '').toString().slice(0, 10)
        const d0 = new Date(raw + (raw.length <= 10 ? 'T12:00:00' : ''))
        if (Number.isNaN(d0.getTime())) return false
        return d0.getTime() < cutoff
      })
    }
    return sorted
  }, [pos, sortBy, batchSummaries, filterFromUrl])

  useEffect(() => { if (supplierIdFromUrl) setSupplier(supplierIdFromUrl) }, [supplierIdFromUrl])
  useEffect(() => { setPage(0) }, [plant, supplier, status, paymentTerms, dateFrom, dateTo, poSearch])
  useEffect(() => { fetchPOs() }, [fetchPOs])

  useEffect(() => {
    const url = plant ? `/api/suppliers?plant_id=${plant}` : '/api/suppliers'
    fetch(url)
      .then(res => res.ok ? res.json() : { suppliers: [] })
      .then(data => setSuppliers(data.suppliers || []))
      .catch(() => setSuppliers([]))
    if (!plant && !supplierIdFromUrl) setSupplier('')
  }, [plant, supplierIdFromUrl])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Compra</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione pedidos a proveedores, materiales y servicios</p>
          <Collapsible className="group mt-3 max-w-3xl">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-sky-800 hover:text-sky-950">
              <HelpCircle className="h-4 w-4" />
              ¿Qué es esta pantalla?
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-md border border-stone-200 bg-stone-50/80 px-3 py-3 text-sm text-stone-700 space-y-2">
              <p>
                Aquí se emiten y consultan las <strong className="font-medium text-stone-900">órdenes de compra (OC)</strong>.
                Cada OC amarra precio y cantidades con el proveedor; las <strong className="font-medium text-stone-900">entradas de inventario</strong> registran lo recibido;
                las facturas pasan a <strong className="font-medium text-stone-900">cuentas por pagar (CXP)</strong> y el pago se registra allí.
              </p>
              <p className="flex items-start gap-2 text-xs text-stone-600">
                <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Referencia técnica (repositorio):{' '}
                  <code className="rounded bg-stone-200/80 px-1 py-0.5 text-[11px]">docs/ERP_PROCUREMENT_SYSTEM_DATABASE_OVERVIEW.md</code>
                  — incluye flujo de datos, tablas y créditos en líneas de OC.
                </span>
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={pos.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPOs}>Actualizar</Button>
          {canCreateOrEditPO && (
            <Button
              variant="primary"
              size="sm"
              className={cn(qualityHubPrimaryButtonClass, 'gap-0')}
              onClick={() => setCreateOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Nueva Orden
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <POKPICards pos={pos} loading={loading} batchSummaries={batchSummaries} />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>Planta, proveedor, estado, rango de fechas y número de orden</CardDescription>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-8">
                <X className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
            {/* PO search */}
            <div className="xl:col-span-2">
              <label className="text-xs text-muted-foreground">Buscar por No. Orden</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ej. PO-2024-001"
                  value={poSearch}
                  onChange={e => setPoSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Plant */}
            <div>
              <label className="text-xs text-muted-foreground">Planta</label>
              <Select value={plant || '_all'} onValueChange={v => setPlant(v === '_all' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas las plantas</SelectItem>
                  {availablePlants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier */}
            <div>
              <label className="text-xs text-muted-foreground">Proveedor</label>
              <Select value={supplier || '_all'} onValueChange={v => setSupplier(v === '_all' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los proveedores</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas (abiertas + parciales)</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="fulfilled">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment terms */}
            <div>
              <label className="text-xs text-muted-foreground">Términos de pago</label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(PAYMENT_TERMS_LABELS).map(([days, label]) => (
                    <SelectItem key={days} value={days}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div>
              <label className="text-xs text-muted-foreground">Fecha desde</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1" />
            </div>

            {/* Date to */}
            <div>
              <label className="text-xs text-muted-foreground">Fecha hasta</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Sort row */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground shrink-0">Ordenar por:</span>
            <div className="flex gap-2 flex-wrap">
              {([
                ['date_desc', 'Fecha reciente'],
                ['date_asc', 'Fecha antigua'],
                ['value_desc', 'Mayor valor'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSortBy(val)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    sortBy === val
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PO List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Listado de Órdenes</CardTitle>
            {!loading && sortedPos.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {page * pageSize + 1}–{page * pageSize + sortedPos.length} de {totalCount}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn(detailPoId ? 'p-0 overflow-hidden' : undefined)}>
          <div className={cn(detailPoId ? 'flex' : undefined)}>
          <div className={cn(detailPoId ? 'flex-1 min-w-0 overflow-y-auto max-h-[65vh] px-6 pt-6 pb-4' : undefined)}>
          {filterFromUrl === 'ready_close' && (
            <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
              Mostrando OC con recepción completa y estado aún abierto/parcial — listas para cerrar.
            </p>
          )}
          {filterFromUrl === 'stale_partial' && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Mostrando OC en estado parcial con más de 15 días desde la fecha de OC (revise entregas).
            </p>
          )}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 px-1 py-5">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm text-muted-foreground">{error}</span>
              <Button variant="outline" size="sm" onClick={fetchPOs}>Reintentar</Button>
            </div>
          ) : sortedPos.length === 0 ? (
            <div className="flex items-center gap-3 px-1 py-5">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'Sin resultados con estos filtros. Pruebe otra planta, proveedor o rango de fechas.'
                  : totalCount === 0 && !hasActiveFilters
                    ? 'No hay órdenes registradas. Si esperaba ver datos, verifique permisos de planta o que su rol incluya compras (p. ej. Ejecutivo, Operaciones admin).'
                    : 'Sin órdenes de compra en esta página · Cree una nueva orden o avance de página.'}
              </span>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPos.map(po => {
                const items = poItems[po.id] || []
                const isExpanded = expandedPo === po.id
                const materialItems = items.filter((it: any) => !it.is_service)
                const serviceItems = items.filter((it: any) => it.is_service)
                const paymentLabel = po.payment_terms_days != null
                  ? (PAYMENT_TERMS_LABELS[po.payment_terms_days] ?? `Net ${po.payment_terms_days}`)
                  : null

                return (
                  <div
                    key={po.id}
                    className={cn(
                      'border rounded-xl overflow-hidden transition-all hover:shadow-sm',
                      detailPoId === po.id
                        ? 'border-primary/40 ring-1 ring-primary/15 shadow-sm'
                        : 'border-border/60 hover:border-border'
                    )}
                  >
                    <div className="p-4 bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <div className="font-semibold text-base">
                              {po.po_number || `PO #${po.id.slice(0, 8)}`}
                            </div>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[po.status] || 'bg-muted text-muted-foreground border border-border'}`}>
                              {STATUS_LABELS[po.status] || po.status}
                            </span>
                            {paymentLabel && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground border rounded px-2 py-0.5">
                                <Clock className="h-3 w-3" />
                                {paymentLabel}
                              </span>
                            )}
                            {(po.status === 'open' || po.status === 'partial') && (() => {
                              const raw = (po.po_date || po.created_at || '').toString().slice(0, 10)
                              const d0 = new Date(raw + (raw.length <= 10 ? 'T12:00:00' : ''))
                              if (Number.isNaN(d0.getTime())) return null
                              const days = Math.floor((Date.now() - d0.getTime()) / 86400000)
                              return (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                  {days}d abierta
                                </span>
                              )
                            })()}
                            {(alertCounts[po.id] ?? 0) > 0 && (
                              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-900">
                                {alertCounts[po.id]} alerta{(alertCounts[po.id] ?? 0) > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-1 text-sm">
                            <div>
                              <span className="text-xs text-muted-foreground">Proveedor</span>
                              <div className="font-medium truncate">
                                {po.supplier?.name ?? po.supplier_id?.slice(0, 8) ?? '—'}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Planta</span>
                              <div className="font-medium">
                                {po.plant?.name ?? po.plant?.code ?? (po.plant_id?.slice(0, 8) ?? '—')}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Fecha</span>
                              <div className="font-medium">
                                {format(new Date((po.po_date || po.created_at) + (po.po_date ? 'T00:00:00' : '')), 'dd MMM yyyy', { locale: es })}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Total OC (referencia)</span>
                              <div className="font-medium text-sm font-mono tabular-nums text-muted-foreground">
                                {mxn.format(batchSummaries[po.id]?.total_ordered_value ?? 0)}
                              </div>
                            </div>
                            <div className="col-span-2 md:col-span-1 min-w-[100px]">
                              <span className="text-xs text-muted-foreground">Avance recepción</span>
                              {(() => {
                                const ord = batchSummaries[po.id]?.total_ordered_value ?? 0
                                const rec = batchSummaries[po.id]?.total_received_value ?? 0
                                const pct = ord > 1e-6 ? Math.min(100, Math.round((rec / ord) * 1000) / 10) : 0
                                return (
                                  <>
                                    <div className="font-semibold font-mono tabular-nums text-sm">{pct}%</div>
                                    <div className="w-full bg-muted/40 rounded-full h-1.5 mt-1">
                                      <div
                                        className={`h-1.5 rounded-full ${pct >= 99.9 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-muted'}`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      />
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                            {po.notes && (
                              <div className="md:col-span-1">
                                <span className="text-xs text-muted-foreground">Notas</span>
                                <div className="text-xs italic truncate">{po.notes}</div>
                              </div>
                            )}
                          </div>

                          {((linePreviewsByPo[po.id]?.length ?? 0) > 0 || (linePreviewOverflowByPo[po.id] ?? 0) > 0) && (
                            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Vista rápida
                              </div>
                              <div className="space-y-2">
                                {(linePreviewsByPo[po.id] ?? []).map((line, idx) => (
                                  <div
                                    key={`${po.id}-${idx}`}
                                    className="rounded-md bg-muted/20 border border-border/40 px-2.5 py-2 text-xs"
                                  >
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                      <div className="min-w-0 flex-1 flex items-start gap-1.5">
                                        {line.is_service ? (
                                          <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                                        ) : (
                                          <Package className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                                        )}
                                        <div className="min-w-0">
                                          <div className="font-semibold text-stone-900 leading-snug break-words">
                                            {line.title}
                                          </div>
                                          {line.is_service && line.material_supplier_name && (
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                              <span className="font-medium text-stone-600">Proveedor de material:</span>{' '}
                                              {line.material_supplier_name}
                                            </div>
                                          )}
                                          {!line.is_service && line.is_m3 && (
                                            <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                                              <div>{uomDetailLine(line.uom ?? undefined)}</div>
                                              <div className="tabular-nums">
                                                {line.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                                                {uomQtyLabel(line.uom)}
                                                {line.volumetric_kg_per_m3 != null && (
                                                  <span className="text-stone-500">
                                                    {' '}
                                                    · ref. {line.volumetric_kg_per_m3.toLocaleString('es-MX')} kg/m³
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          P. unit.
                                        </div>
                                        <div className="font-bold tabular-nums text-sm text-foreground">
                                          {mxnPrice.format(line.unit_price)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          por {uomQtyLabel(line.uom)}
                                        </div>
                                      </div>
                                    </div>
                                    {line.is_service && (
                                      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums pl-5">
                                        {line.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                                        {uomQtyLabel(line.uom)} ordenados
                                      </div>
                                    )}
                                    {!line.is_service && !line.is_m3 && (
                                      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums pl-5">
                                        {line.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                                        {uomQtyLabel(line.uom)} ordenados
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {(linePreviewOverflowByPo[po.id] ?? 0) > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  + {linePreviewOverflowByPo[po.id]}{' '}
                                  {linePreviewOverflowByPo[po.id] === 1 ? 'línea más' : 'líneas más'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant={detailPoId === po.id ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => {
                              toggleExpanded(po.id)
                              handleSelectPo(po.id)
                            }}
                            className="h-8 px-2"
                          >
                            {(isExpanded || detailPoId === po.id)
                              ? <><ChevronUp className="h-4 w-4 mr-1" />Ocultar</>
                              : <><ChevronDown className="h-4 w-4 mr-1" />Detalle</>}
                          </Button>
                          {canCreateOrEditPO && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => {
                                  setSelectedPoId(po.id)
                                  setEditOpen(true)
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                title="Eliminar solo si no hay entradas ni partidas CXP en las líneas"
                                onClick={() =>
                                  setDeleteTarget({
                                    id: po.id,
                                    label: po.po_number || po.id.slice(0, 8),
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details — inline (mobile only) */}
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 p-4 md:hidden">
                        <POLifecycleView poId={po.id} plantId={po.plant_id} />
                        {linkedAlertsLoading[po.id] && (
                          <p className="text-xs text-muted-foreground mb-3">Cargando alertas vinculadas…</p>
                        )}
                        {linkedAlertsByPo[po.id] && linkedAlertsByPo[po.id]!.length > 0 && (
                          <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-950">
                              Alertas vinculadas
                            </div>
                            <ul className="space-y-2">
                              {linkedAlertsByPo[po.id]!.map((a) => (
                                <li
                                  key={a.id}
                                  className="flex flex-wrap items-center gap-2 justify-between text-sm border border-stone-200/80 rounded-md bg-white/80 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <span className="font-mono text-xs text-stone-600">{a.alert_number}</span>
                                    <span className="mx-2 text-stone-300">·</span>
                                    <span className="text-stone-800">
                                      {a.material?.material_name ?? 'Material'}
                                    </span>
                                    {a.scheduled_delivery_date && (
                                      <span className="block text-xs text-stone-500 mt-0.5">
                                        Entrega: {a.scheduled_delivery_date}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className="text-[10px]">
                                      {ALERT_STATUS_PO_LABELS[a.status] ?? a.status}
                                    </Badge>
                                    <Link
                                      href="/production-control/alerts"
                                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Ver
                                    </Link>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {items.length === 0 ? (
                          <div className="flex items-center gap-3 py-6">
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground">Sin ítems agregados</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Summary row */}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-2 border-b border-border/40">
                              <span>
                                {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                                {materialItems.length > 0 && (
                                  <span className="text-muted-foreground/60 ml-1">
                                    ({materialItems.length} mat.{serviceItems.length > 0 ? `, ${serviceItems.length} serv.` : ''})
                                  </span>
                                )}
                              </span>
                              <span className="tabular-num text-foreground/80 text-xs">
                                Total PO: {mxn.format(items.reduce((s: number, it: any) => s + Number(it.qty_ordered || 0) * Number(it.unit_price || 0), 0))}
                              </span>
                              {poSummaries[po.id] && (
                                <>
                                  <span>Recibido: {mxn.format(poSummaries[po.id].total_received_value)}</span>
                                  {poSummaries[po.id].total_credits > 0 && (
                                    <span className="text-orange-600">Créditos: -{mxn.format(poSummaries[po.id].total_credits)}</span>
                                  )}
                                  <span className="font-semibold text-green-700">
                                    Neto: {mxn.format(poSummaries[po.id].net_total)}
                                  </span>
                                </>
                              )}
                              <Link
                                href={procurementEntriesUrl({ plantId: po.plant_id, poId: po.id })}
                                className="flex items-center gap-1 text-primary hover:underline text-sm ml-auto"
                              >
                                <ExternalLink className="h-4 w-4" />Ver entradas
                              </Link>
                              {relatedPayablesCount[po.id] !== undefined && (
                                <Link
                                  href={`/finanzas/procurement?tab=cxp&po_id=${po.id}${po.supplier_id ? `&supplier_id=${encodeURIComponent(po.supplier_id)}` : ''}`}
                                  className="flex items-center gap-1 text-primary hover:underline text-sm"
                                >
                                  <FileText className="h-4 w-4" />
                                  {relatedPayablesCount[po.id]} factura{relatedPayablesCount[po.id] !== 1 ? 's' : ''}
                                </Link>
                              )}
                            </div>

                            {/* Item list */}
                            {items.map((item: any) => {
                              const orderedQty = Number(item.qty_ordered) || 0
                              const receivedQty = Number(item.qty_received ?? item.qty_received_kg ?? item.qty_received_native ?? 0) || 0
                              const progress = orderedQty > 0 ? Math.min((receivedQty / orderedQty) * 100, 100) : 0
                              const isOverdue = item.required_by && new Date(item.required_by + 'T00:00:00') < new Date()
                              const unitPrice = Number(item.unit_price || 0)
                              const lineTotal = orderedQty * unitPrice
                              const matSupplierName = item.material_supplier?.name as string | undefined
                              const volKg = item.volumetric_weight_kg_per_m3 != null ? Number(item.volumetric_weight_kg_per_m3) : null
                              const title = item.is_service
                                ? (item.service_description || 'Servicio de flota')
                                : (item.material?.material_name || item.material?.material_code || 'Material')

                              return (
                                <div key={item.id} className="bg-card border border-border/60 rounded-xl p-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start gap-2 mb-2 flex-wrap">
                                        {item.is_service
                                          ? <Truck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                          : <Package className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
                                        <div className="min-w-0 flex-1 space-y-1">
                                          <div className="font-semibold text-base text-foreground leading-snug break-words">
                                            {title}
                                          </div>
                                          {item.is_service && matSupplierName && (
                                            <div className="text-xs text-muted-foreground">
                                              <span className="font-medium text-stone-600">Proveedor de material: </span>
                                              {matSupplierName}
                                            </div>
                                          )}
                                          {!item.is_service && isM3Uom(item.uom) && (
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                              <div>{uomDetailLine(item.uom)}</div>
                                              {volKg != null && !Number.isNaN(volKg) && (
                                                <div>
                                                  Referencia pactada:{' '}
                                                  <span className="tabular-nums font-medium text-stone-700">
                                                    {volKg.toLocaleString('es-MX')} kg/m³
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${STATUS_COLORS[item.status] || 'bg-muted text-muted-foreground border border-border'}`}>
                                          {STATUS_LABELS[item.status] || item.status}
                                        </span>
                                        {isOverdue && (item.status === 'open' || item.status === 'partial') && (
                                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium shrink-0">
                                            <AlertTriangle className="h-3 w-3" />
                                            Requerido vencido
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                          <div className="text-xs text-muted-foreground">Ordenado</div>
                                          <div className="font-semibold tabular-nums">
                                            {orderedQty.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {uomQtyLabel(item.uom)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">Recibido</div>
                                          <div className="font-semibold tabular-nums">
                                            {receivedQty.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {uomQtyLabel(item.uom)}
                                          </div>
                                        </div>
                                        {item.required_by && (
                                          <div className="col-span-2">
                                            <div className="text-xs text-muted-foreground">Requerido antes de</div>
                                            <div className={`font-semibold text-sm ${isOverdue ? 'text-red-600' : ''}`}>
                                              {format(new Date(item.required_by + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      {!item.is_service && (
                                        <div className="mt-2">
                                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                            <span>Progreso recepción</span>
                                            <span className="tabular-num">{progress.toFixed(1)}%</span>
                                          </div>
                                          <div className="w-full bg-muted/40 rounded-full h-1.5">
                                            <div
                                              className={`h-1.5 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-amber-400' : 'bg-muted'}`}
                                              style={{ width: `${progress}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0 space-y-1">
                                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Precio unit.
                                      </div>
                                      <div className="text-xl font-bold tabular-nums text-foreground">
                                        {mxnPrice.format(unitPrice)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        por {uomQtyLabel(item.uom)}
                                      </div>
                                      <div className="text-xs text-muted-foreground tabular-nums pt-1 border-t border-border/50">
                                        Subtotal {mxnPrice.format(lineTotal)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!loading && sortedPos.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {Math.max(1, Math.ceil(totalCount / pageSize) || 1)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPage(0)
                    setPageSize(Number(v))
                  }}
                >
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / pág.</SelectItem>
                    <SelectItem value="25">25 / pág.</SelectItem>
                    <SelectItem value="50">50 / pág.</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
          </div>
          {detailPoId && (() => {
            const detailPo = pos.find(p => p.id === detailPoId)
            if (!detailPo) return null
            return (
              <div className="hidden md:block">
                <PODetailPanel
                  po={detailPo}
                  items={poItems[detailPoId] || []}
                  summary={poSummaries[detailPoId]}
                  batchSummary={batchSummaries[detailPoId]}
                  linkedAlerts={linkedAlertsByPo[detailPoId]}
                  alertsLoading={linkedAlertsLoading[detailPoId] ?? false}
                  payablesCount={relatedPayablesCount[detailPoId]}
                  mxn={mxn}
                  mxnPrice={mxnPrice}
                  canEdit={canCreateOrEditPO}
                  onEdit={() => { setSelectedPoId(detailPoId); setEditOpen(true) }}
                  onDelete={() => {
                    const p = pos.find(x => x.id === detailPoId)
                    if (p) setDeleteTarget({ id: detailPoId, label: p.po_number || detailPoId.slice(0, 8) })
                  }}
                  onClose={() => setDetailPoId(null)}
                />
              </div>
            )
          })()}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleteLoading && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden de compra?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Se eliminará la OC <span className="font-mono font-medium text-foreground">{deleteTarget?.label}</span> y sus
                líneas. Solo es posible si no hay entradas de inventario vinculadas y no hay partidas de cuentas por pagar
                asociadas a esas líneas. Las alertas que apuntaban a esta OC quedarán sin vínculo.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
              onClick={(e) => {
                e.preventDefault()
                void confirmDeletePo()
              }}
            >
              {deleteLoading ? 'Eliminando…' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreatePOModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { fetchPOs(); setCreateOpen(false) }}
        defaultPlantId={currentPlant?.id}
      />
      <EditPOModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        poId={selectedPoId || ''}
        plantId={pos.find(p => p.id === selectedPoId)?.plant_id || ''}
        onSuccess={() => { fetchPOs(); setEditOpen(false) }}
      />
    </div>
  )
}
