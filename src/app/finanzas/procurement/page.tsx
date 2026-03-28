'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package,
  CreditCard,
  BarChart3,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  LayoutDashboard,
  Warehouse,
  TrendingUp,
  Info,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import PurchaseOrdersPage from '@/app/finanzas/po/page'
import CxpPage from '@/app/finanzas/cxp/page'
import SupplierAnalysisPage from '@/app/finanzas/proveedores/analisis/page'
import CreatePOModal, { type PrefillFromAlert } from '@/components/po/CreatePOModal'
import ActionCenter from '@/components/procurement/ActionCenter'
import ProcurementFlowNav from '@/components/procurement/ProcurementFlowNav'
import PricingReviewQueue from '@/components/procurement/PricingReviewQueue'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import ActivityFeed, { type ActivityFeedItem } from '@/components/procurement/ActivityFeed'
import InventoryAlertPanel from '@/components/procurement/InventoryAlertPanel'
import CreditNotesPanel from '@/components/procurement/CreditNotesPanel'
import ReconciliationView from '@/components/procurement/ReconciliationView'

type DashboardData = {
  open_po_count: number
  open_po_value: number
  fulfillment_rate_pct: number
  credits_month: number
  ap_aging: { current: number; d1_30: number; d31_60: number; d60_plus: number }
  alerts_pending: { total: number; pending_po: number; po_linked: number; delivery_scheduled: number }
  materials_below_reorder: number
  top_overdue_payables: Array<{
    supplier: string
    invoice_number: string | null
    amount: number
    days_overdue: number
  }>
  period_month: string
}

const TAB_KEYS = ['resumen', 'inventario', 'po', 'cxp', 'suppliers'] as const
type TabKey = (typeof TAB_KEYS)[number]

export default function ProcurementWorkspacePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { availablePlants, currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()

  const initialTab = useMemo((): TabKey => {
    const tab = searchParams.get('tab')
    if (tab && TAB_KEYS.includes(tab as TabKey)) return tab as TabKey
    return 'resumen'
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [workspacePlantId, setWorkspacePlantId] = useState<string>('')
  const [periodMonth, setPeriodMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityFeedItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [createPOOpen, setCreatePOOpen] = useState(false)
  const [prefillFromAlert, setPrefillFromAlert] = useState<PrefillFromAlert | null>(null)
  const [actionQueueKey, setActionQueueKey] = useState(0)

  const canCreatePO = profile?.role === 'EXECUTIVE' || profile?.role === 'ADMIN_OPERATIONS'

  const plantList = useMemo(
    () => (availablePlants?.length ? availablePlants : currentPlant ? [currentPlant] : []),
    [availablePlants, currentPlant]
  )

  const handleTabChange = (value: string) => {
    const v = value as TabKey
    setActiveTab(v)
    router.replace(`?tab=${v}`, { scroll: false })
  }

  const loadDashboard = useCallback(async () => {
    setDashLoading(true)
    try {
      const params = new URLSearchParams({ month: periodMonth })
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      const res = await fetch(`/api/procurement/dashboard?${params}`)
      const json = await res.json()
      if (json.success && json.data) setDashboard(json.data)
      else setDashboard(null)
    } catch {
      setDashboard(null)
    } finally {
      setDashLoading(false)
    }
  }, [periodMonth, workspacePlantId])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const params = new URLSearchParams({ limit: '12' })
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      const res = await fetch(`/api/procurement/activity?${params}`)
      const json = await res.json()
      setActivity(json.success ? json.data || [] : [])
    } catch {
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [workspacePlantId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadActivity()
  }, [loadActivity])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && TAB_KEYS.includes(t as TabKey)) setActiveTab(t as TabKey)
  }, [searchParams])

  const mxn = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
    []
  )

  const reviewPricing = searchParams.get('review') === 'pricing'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Centro de compras e inventario
          </h1>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Un solo lugar para OC, proveedores, cuentas por pagar y seguimiento de alertas. El filtro de planta
            aplica al resumen; use <strong className="font-medium text-stone-800">Todas las plantas</strong> para
            ver la operación completa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={workspacePlantId === '' ? 'all' : workspacePlantId} onValueChange={(v) => setWorkspacePlantId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[200px] border-stone-300 bg-white">
              <SelectValue placeholder="Planta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plantList.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            className="w-[160px] border-stone-300 bg-white"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
          />
          {canCreatePO && (
            <Button
              type="button"
              className="bg-sky-700 hover:bg-sky-800 text-white shadow-none"
              onClick={() => setCreatePOOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Nueva OC
            </Button>
          )}
          <Button variant="outline" className="border-stone-300 bg-white" asChild>
            <Link href="/finanzas">← Finanzas</Link>
          </Button>
        </div>
      </div>

      <ProcurementFlowNav plantId={workspacePlantId || undefined} />

      <div className="rounded-lg border border-stone-200 bg-[#faf9f7] p-4 md:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-sky-100 p-2 text-sky-800">
            <Info className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2 text-sm text-stone-600">
            <p className="font-medium text-stone-800">Coordinación del flujo de materiales</p>
            <ol className="list-decimal list-inside space-y-1.5 text-stone-600">
              <li>
                <span className="text-stone-700">Dosificador</span> confirma existencia física y pasa a validación.
              </li>
              <li>
                <span className="text-stone-700">Jefe de planta / unidad</span> valida, vincula OC existente o marca
                que hace falta una nueva.
              </li>
              <li>
                <span className="text-stone-700">Usted (operaciones)</span> crea o vincula la OC, programa la entrega y
                da seguimiento hasta el cierre en inventario.
              </li>
              <li>
                La entrada de material puede cerrar la alerta; puede abrirse desde Control de producción o al registrar
                la recepción.
              </li>
            </ol>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
              <Link
                href="/production-control"
                className="inline-flex items-center gap-1 text-sky-800 hover:text-sky-950 font-medium"
              >
                Control de producción <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/production-control/alerts"
                className="inline-flex items-center gap-1 text-sky-800 hover:text-sky-950 font-medium"
              >
                Alertas (detalle) <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1 bg-stone-200/60 p-1 rounded-lg">
          <TabsTrigger value="resumen" className="gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <LayoutDashboard className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <Warehouse className="h-4 w-4" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="po" className="gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <Package className="h-4 w-4" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="cxp" className="gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <CreditCard className="h-4 w-4" />
            Por pagar
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 col-span-2 sm:col-span-1 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4" />
            Proveedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <ActionCenter
            key={`${actionQueueKey}-${workspacePlantId || 'all'}`}
            plantId={workspacePlantId || undefined}
          />

          {reviewPricing ? (
            <PricingReviewQueue
              workspacePlantId={workspacePlantId || undefined}
              onPricingAction={() => setActionQueueKey((k) => k + 1)}
            />
          ) : null}

          <Collapsible className="rounded-lg border border-stone-200 bg-white">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50 rounded-lg">
              Métricas del período
              <span className="text-xs font-normal text-stone-500">(expandir)</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {dashLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : dashboard ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  <KpiCard
                    label="Valor OC abiertas"
                    value={mxn.format(dashboard.open_po_value)}
                    icon={ShoppingCart}
                  />
                  <KpiCard
                    label="CXP vencida (30d)"
                    value={mxn.format(dashboard.ap_aging.d1_30)}
                    icon={AlertTriangle}
                    warn
                  />
                  <KpiCard
                    label="Alertas acción"
                    value={String(dashboard.alerts_pending.total)}
                    icon={AlertTriangle}
                  />
                  <KpiCard
                    label="Fulfillment %"
                    value={`${dashboard.fulfillment_rate_pct}%`}
                    icon={TrendingUp}
                  />
                  <KpiCard
                    label="Bajo reorden"
                    value={String(dashboard.materials_below_reorder)}
                    icon={Package}
                  />
                  <KpiCard
                    label="Créditos mes"
                    value={mxn.format(dashboard.credits_month)}
                    icon={DollarSign}
                  />
                </div>
              ) : (
                <p className="text-sm text-stone-500">No se pudo cargar el resumen.</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3 rounded-lg border border-stone-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                  Actividad reciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityFeed items={activity} loading={activityLoading} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2 rounded-lg border border-stone-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                  Top vencidas CXP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!dashboard || dashboard.top_overdue_payables.length === 0 ? (
                  <p className="text-sm text-stone-500">Sin facturas vencidas en el período.</p>
                ) : (
                  <ul className="space-y-2">
                    {dashboard.top_overdue_payables.map((p, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-stone-900 truncate">{p.supplier}</div>
                          <div className="text-xs text-stone-500 font-mono">{p.invoice_number || '—'}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-red-700">{mxn.format(p.amount)}</div>
                          <div className="text-[11px] text-stone-500">{p.days_overdue} d</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" className="w-full border-stone-300 mt-2" asChild>
                  <Link href="/finanzas/procurement?tab=cxp">Ir a CXP</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Accordion type="single" collapsible className="rounded-lg border border-stone-200 bg-white px-4">
            <AccordionItem value="analisis" className="border-0">
              <AccordionTrigger className="text-sm font-semibold text-stone-700 hover:no-underline py-4">
                Créditos en OC y conciliación recepción vs pedido
                <span className="ml-2 text-xs font-normal text-stone-500 hidden sm:inline">
                  (opcional — abrir solo cuando lo necesite)
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <p className="text-xs text-stone-500 -mt-1 mb-2">
                  Auditoría de notas de crédito en líneas de OC y brechas de cantidad en líneas abiertas. No es necesario
                  revisarlo cada día.
                </p>
                <CreditNotesPanel
                  workspacePlantId={workspacePlantId}
                  plantOptions={plantList.map((p) => ({ id: p.id, name: p.name }))}
                />
                <ReconciliationView workspacePlantId={workspacePlantId} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="inventario">
          <InventoryAlertPanel
            workspacePlantId={workspacePlantId}
            availablePlants={plantList}
            canCreatePO={canCreatePO}
            onCreatePOFromAlert={(a) => {
              const qty =
                Number(a.physical_count_kg || a.triggered_stock_kg || a.reorder_point_kg) || 1000
              setPrefillFromAlert({
                alertId: a.id,
                materialId: a.material_id,
                plantId: a.plant_id,
                suggestedQtyKg: Math.max(qty, 1),
              })
              setCreatePOOpen(true)
            }}
          />
        </TabsContent>

        <TabsContent value="po" className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="p-2 md:p-4">
            <PurchaseOrdersPage />
          </div>
        </TabsContent>

        <TabsContent value="cxp" className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="p-2 md:p-4">
            <CxpPage />
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="p-2 md:p-4">
            <SupplierAnalysisPage />
          </div>
        </TabsContent>
      </Tabs>

      <CreatePOModal
        open={createPOOpen}
        onClose={() => {
          setCreatePOOpen(false)
          setPrefillFromAlert(null)
        }}
        defaultPlantId={workspacePlantId || currentPlant?.id}
        prefillFromAlert={prefillFromAlert}
        onSuccess={() => {
          void loadDashboard()
          void loadActivity()
          setActionQueueKey((k) => k + 1)
          setPrefillFromAlert(null)
        }}
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  warn,
}: {
  label: string
  value: string
  icon: React.ElementType
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        warn ? 'border-red-200 bg-red-50/50' : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 text-stone-600 mb-1">
        <Icon className={`h-4 w-4 ${warn ? 'text-red-600' : 'text-sky-700'}`} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-mono font-semibold tabular-nums ${warn ? 'text-red-800' : 'text-stone-900'}`}>
        {value}
      </div>
    </div>
  )
}
