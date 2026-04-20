'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Package,
  TrendingDown,
  FileText,
  Upload,
  BarChart3,
  Calendar,
  Clock as ClockIcon,
  Inbox,
  Settings,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  Building2,
  RefreshCw,
  ArrowLeftRight,
  ClipboardPlus,
  ChevronRight,
  FileStack,
  ShieldAlert,
} from 'lucide-react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import MaterialDetailSheet from './MaterialDetailSheet'
import type { DashboardMaterialSummary, DashboardSummaryResponse } from '@/types/inventoryDashboard'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function fmtKg(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function dashboardCategoryLabel(m: DashboardMaterialSummary) {
  return m.category?.trim() || 'Sin categoría'
}

export default function DosificadorDashboard() {
  const { profile } = useAuthSelectors()
  const { currentPlant } = usePlantContext()
  const [mounted, setMounted] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [crossPlantPending, setCrossPlantPending] = useState({ billing: 0, production: 0 })
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [detailMaterial, setDetailMaterial] = useState<DashboardMaterialSummary | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const stripScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchSummary = useCallback(async () => {
    if (!currentPlant?.id) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const res = await fetch(`/api/inventory/dashboard-summary?plant_id=${currentPlant.id}`)
      const json = (await res.json()) as DashboardSummaryResponse & { error?: string }
      if (!res.ok) {
        setSummaryError(json.error || 'No se pudo cargar el inventario')
        setSummary(null)
        return
      }
      if (json.success) {
        setSummary(json)
        setLastUpdated(new Date())
      }
    } catch {
      setSummaryError('Error de red')
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [currentPlant?.id])

  useEffect(() => {
    if (mounted && currentPlant?.id) {
      fetchSummary()
    }
  }, [mounted, currentPlant?.id, fetchSummary])

  const fetchActivitiesAndCrossPlant = useCallback(async () => {
    if (!mounted) return
    setLoadingActivities(true)
    try {
      const query = new URLSearchParams({ limit: '8' })
      if (currentPlant?.id) query.set('plant_id', currentPlant.id)
      const activitiesResponse = await fetch(`/api/production-control/activities?${query.toString()}`)
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json()
        setActivities(activitiesData.activities || [])
      }
      try {
        const cpQuery = new URLSearchParams()
        if (currentPlant?.id) cpQuery.set('plant_id', currentPlant.id)
        const cpRes = await fetch(`/api/production-control/cross-plant-status?${cpQuery.toString()}`)
        if (cpRes.ok) {
          const cpData = await cpRes.json()
          setCrossPlantPending({
            billing: cpData.summary?.pending_billing ?? 0,
            production: cpData.summary?.pending_production ?? 0,
          })
        }
      } catch {
        /* non-critical */
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingActivities(false)
    }
  }, [mounted, currentPlant?.id])

  useEffect(() => {
    fetchActivitiesAndCrossPlant()
  }, [fetchActivitiesAndCrossPlant])

  const refreshAll = () => {
    fetchSummary()
    fetchActivitiesAndCrossPlant()
  }

  const urgentItems = useMemo(() => {
    if (!summary?.materials) return []
    const out: { material: DashboardMaterialSummary; alert: DashboardMaterialSummary['active_alerts'][0] }[] = []
    for (const m of summary.materials) {
      for (const a of m.active_alerts) {
        if (a.status === 'pending_confirmation') {
          out.push({ material: m, alert: a })
        }
      }
    }
    return out
  }, [summary])

  const getActivityIcon = (activity: any) => {
    switch (activity.type) {
      case 'inventory':
        return activity.action.includes('Entrada') ? (
          <Package className="h-4 w-4 text-sky-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-amber-600" />
        )
      case 'pumping':
        return <Truck className="h-4 w-4 text-sky-700" />
      case 'arkik':
        return <Upload className="h-4 w-4 text-violet-600" />
      case 'order':
        return <FileText className="h-4 w-4 text-emerald-600" />
      default:
        return <Activity className="h-4 w-4 text-stone-500" />
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60))
    if (diffInMinutes < 1) return 'Hace un momento'
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)} horas`
    return `Hace ${Math.floor(diffInMinutes / 1440)} días`
  }

  const deadlineRemaining = (deadline: string | null) => {
    if (!deadline) return null
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return 'Vencida'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${mins}m`
  }

  const openDetail = (m: DashboardMaterialSummary) => {
    setDetailMaterial(m)
    setSheetOpen(true)
  }

  const barWidth = (m: DashboardMaterialSummary) => {
    if (m.reorder_point_kg && m.reorder_point_kg > 0) {
      return Math.min(100, (m.current_stock_kg / m.reorder_point_kg) * 100)
    }
    return 40
  }

  const barColor = (m: DashboardMaterialSummary) => {
    if (m.health === 'healthy') return 'bg-emerald-500'
    if (m.health === 'warning') return 'bg-amber-500'
    if (m.health === 'critical') return 'bg-red-500'
    return 'bg-stone-400'
  }

  const categoryPills = useMemo(() => {
    if (!summary?.materials?.length) return []
    const s = new Set<string>()
    for (const m of summary.materials) s.add(dashboardCategoryLabel(m))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }, [summary?.materials])

  const materialsGrouped = useMemo(() => {
    if (!summary?.materials?.length) return [] as readonly (readonly [string, DashboardMaterialSummary[]])[]
    const map = new Map<string, DashboardMaterialSummary[]>()
    for (const m of summary.materials) {
      const k = dashboardCategoryLabel(m)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(
        ([k, arr]) =>
          [k, arr.slice().sort((a, b) => a.material_name.localeCompare(b.material_name, 'es'))] as const
      )
  }, [summary?.materials])

  const filteredForCategory = useMemo(() => {
    if (!summary?.materials || selectedCategory === null) return null
    return summary.materials
      .filter((m) => dashboardCategoryLabel(m) === selectedCategory)
      .slice()
      .sort((a, b) => a.material_name.localeCompare(b.material_name, 'es'))
  }, [summary?.materials, selectedCategory])

  useEffect(() => {
    if (selectedCategory !== null) {
      stripScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
    }
  }, [selectedCategory])

  const renderMaterialTile = (m: DashboardMaterialSummary) => (
    <Tooltip key={m.material_id}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => openDetail(m)}
          className={cn(
            'snap-start shrink-0 w-[148px] md:w-[160px] text-left rounded-lg border p-3 transition-colors',
            'border-stone-200 bg-[#faf9f7] hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2',
            m.health === 'critical' && 'border-red-300 ring-1 ring-red-200',
            m.health === 'warning' && 'border-amber-300'
          )}
        >
          <div className="text-xs font-medium text-stone-800 line-clamp-2 min-h-[2.25rem] leading-tight">
            {m.material_name}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-stone-200 overflow-hidden border border-stone-200/80">
            <div
              className={cn('h-full rounded-full transition-all', barColor(m))}
              style={{ width: `${barWidth(m)}%` }}
            />
          </div>
          <div className="mt-2 font-mono text-sm font-semibold tabular-nums text-stone-900">
            {fmtKg(m.current_stock_kg)} kg
          </div>
          {m.reorder_point_kg != null && (
            <div className="text-[10px] text-stone-500 font-mono tabular-nums">
              Reorden {fmtKg(m.reorder_point_kg)}
            </div>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[280px] border border-stone-200 bg-[#faf9f7] text-stone-900"
      >
        <p className="font-semibold leading-snug">{m.material_name}</p>
        {m.category && <p className="text-stone-600 mt-1.5 text-xs">Categoría: {m.category}</p>}
        {m.unit_of_measure && (
          <p className="font-mono text-xs text-stone-700 mt-1">UoM: {m.unit_of_measure}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )

  return (
    <>
      <div className="space-y-6">
        <InventoryBreadcrumb />

        {/* Shift context */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border border-stone-200 rounded-lg bg-white p-4 md:p-5">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
              Centro de materiales
            </h1>
            <p className="text-sm text-stone-600 mt-1">
              Bienvenido, {profile?.first_name} {profile?.last_name}
            </p>
            {currentPlant && (
              <div className="flex items-center gap-2 mt-2 text-sm text-stone-600">
                <Building2 className="h-4 w-4 text-stone-500" />
                <span>
                  Planta {currentPlant.name}{' '}
                  <span className="font-mono text-stone-500">({currentPlant.code})</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-stone-300 text-stone-700 font-normal">
              <Clock className="h-3 w-3 mr-1" />
              {mounted
                ? new Date().toLocaleDateString('es-MX', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '…'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300"
              onClick={refreshAll}
              disabled={summaryLoading && !summary}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', summaryLoading && 'animate-spin')} />
              Actualizar
            </Button>
            {lastUpdated && (
              <span className="text-xs text-stone-500 w-full sm:w-auto sm:text-right font-mono">
                Inventario: {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </header>

        {/* Cross-plant banner */}
        {(crossPlantPending.billing > 0 || crossPlantPending.production > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-950">
                <div className="font-semibold">Producción cruzada pendiente</div>
                <div className="mt-1 space-y-0.5 text-amber-900/90">
                  {crossPlantPending.billing > 0 && (
                    <div>
                      {crossPlantPending.billing} remisión(es) facturada(s) aquí esperan registro en otra planta
                    </div>
                  )}
                  {crossPlantPending.production > 0 && (
                    <div>
                      {crossPlantPending.production} registro(s) de producción sin vínculo de facturación
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-amber-300 shrink-0" asChild>
              <Link href="/production-control/cross-plant">Abrir</Link>
            </Button>
          </div>
        )}

        {/* Material health strip */}
        <section className="border border-stone-200 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/80">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
              Inventario por material
            </h2>
            {summary && (
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                {summary.summary.critical_count > 0 && (
                  <span className="text-red-700 mr-2">{summary.summary.critical_count} crítico(s)</span>
                )}
                {summary.summary.warning_count > 0 && (
                  <span className="text-amber-700">{summary.summary.warning_count} atención</span>
                )}
              </span>
            )}
          </div>
          <div className="p-3 md:p-4">
            {!currentPlant?.id ? (
              <p className="text-sm text-stone-500">Seleccione una planta para ver inventario.</p>
            ) : summaryLoading && !summary ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="min-w-[140px] h-24 rounded-lg bg-stone-100 border border-stone-200 animate-pulse"
                  />
                ))}
              </div>
            ) : summaryError ? (
              <p className="text-sm text-red-700">{summaryError}</p>
            ) : !summary?.materials.length ? (
              <p className="text-sm text-stone-500">No hay registros de inventario para esta planta.</p>
            ) : (
              <>
                {categoryPills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-3 mb-3 border-b border-stone-100">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        selectedCategory === null
                          ? 'border-stone-800 bg-stone-900 text-white'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      )}
                    >
                      Todos
                    </button>
                    {categoryPills.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          selectedCategory === cat
                            ? 'border-stone-800 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
                <div
                  ref={stripScrollRef}
                  className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin"
                >
                  {selectedCategory === null
                    ? materialsGrouped.map(([label, mats]) => (
                        <div key={label} className="flex flex-col gap-2 shrink-0 snap-start">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 px-1 max-w-[200px] truncate">
                            {label}
                          </div>
                          <div className="flex gap-3">{mats.map((m) => renderMaterialTile(m))}</div>
                        </div>
                      ))
                    : (filteredForCategory ?? []).map((m) => renderMaterialTile(m))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Urgent zone */}
        {urgentItems.length > 0 && (
          <section className="rounded-lg border-2 border-red-300 bg-red-50/60 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-700" />
              <h2 className="text-base font-semibold text-red-950">Acción urgente — conteo físico</h2>
            </div>
            <p className="text-sm text-red-900/90 mb-4">
              Tienes alertas con plazo de confirmación. Verifica en silo y registra el conteo.
            </p>
            <div className="space-y-3">
              {urgentItems.map(({ material: m, alert: a }) => {
                const left = deadlineRemaining(a.confirmation_deadline)
                return (
                  <div
                    key={a.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-red-200 bg-white p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-red-800/80">{a.alert_number}</div>
                      <div className="font-semibold text-stone-900">{m.material_name}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-stone-600">
                        <span>
                          Stock sistema:{' '}
                          <span className="font-mono text-red-700">{fmtKg(m.current_stock_kg)} kg</span>
                        </span>
                        {left && (
                          <Badge variant="outline" className="border-red-300 text-red-800 font-mono text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {left}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="lg"
                      variant="danger"
                      className="w-full sm:w-auto min-h-12 shrink-0"
                      asChild
                    >
                      <Link href="/production-control/alerts">Confirmar conteo</Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Action stream */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-3">
            Acciones principales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/production-control/entries?tab=new"
              className="group flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem] hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <div className="h-12 w-12 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0">
                <Inbox className="h-6 w-6 text-sky-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900 group-hover:text-sky-900">Registrar entrada</div>
                <div className="text-xs text-stone-600">Recepción de material en planta</div>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-sky-700 shrink-0" />
            </Link>
            <Link
              href="/production-control/material-request"
              className="group flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem] hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <div className="h-12 w-12 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                <ClipboardPlus className="h-6 w-6 text-emerald-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900 group-hover:text-emerald-900">Solicitar material</div>
                <div className="text-xs text-stone-600">Inicia pedido (Jefe de Planta valida)</div>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-emerald-700 shrink-0" />
            </Link>
            <Link
              href="/production-control/arkik-upload"
              className="group flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem] hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <div className="h-12 w-12 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
                <Upload className="h-6 w-6 text-violet-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900 group-hover:text-violet-900">Procesar Arkik</div>
                <div className="text-xs text-stone-600">Carga de producción</div>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-violet-700 shrink-0" />
            </Link>
            <Link
              href="/production-control/pumping-service"
              className="group flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem] hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <div className="h-12 w-12 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0">
                <Truck className="h-6 w-6 text-sky-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900 group-hover:text-sky-900">Servicio de bombeo</div>
                <div className="text-xs text-stone-600">Remisiones de bombeo</div>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-sky-700 shrink-0" />
            </Link>
          </div>
        </section>

        {/* Secondary */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-3">
            Más herramientas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { href: '/production-control/alerts', label: 'Alertas de material', Icon: AlertTriangle },
              { href: '/production-control/lots', label: 'Lotes', Icon: Package },
              { href: '/production-control/adjustments', label: 'Ajustes', Icon: Settings },
              { href: '/production-control/reorder-config', label: 'Puntos de reorden', Icon: TrendingDown },
              { href: '/production-control/advanced-dashboard', label: 'Reportes', Icon: BarChart3 },
              { href: '/production-control/daily-log', label: 'Bitácora diaria', Icon: Calendar },
              { href: '/production-control/cross-plant', label: 'Producción cruzada', Icon: ArrowLeftRight },
              { href: '/production-control/reloj-checador', label: 'Reloj checador', Icon: ClockIcon },
              { href: '/production-control/remisiones', label: 'Remisiones', Icon: FileText },
              {
                href: '/production-control/daily-compliance',
                label: 'Compliance diario',
                Icon: ShieldAlert,
              },
              {
                href: '/production-control/evidencia-concreto',
                label: 'Evidencia remisiones (concreto)',
                Icon: FileStack,
              },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                <Icon className="h-4 w-4 text-stone-500 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </section>

        <Separator className="bg-stone-200" />

        {/* Activity */}
        <section className="border border-stone-200 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Actividad reciente
              </h2>
              <p className="text-xs text-stone-500">Últimas acciones en la planta</p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchActivitiesAndCrossPlant} disabled={loadingActivities}>
              <RefreshCw className={cn('h-4 w-4', loadingActivities && 'animate-spin')} />
            </Button>
          </div>
          <div className="p-4">
            {loadingActivities ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-stone-100 rounded animate-pulse" />
                ))}
              </div>
            ) : activities.length > 0 ? (
              <ul className="space-y-3">
                {activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start gap-3 py-2 border-b border-stone-100 last:border-0"
                  >
                    <div className="mt-0.5">{getActivityIcon(activity)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{activity.action}</p>
                      <p className="text-xs text-stone-500">{activity.details}</p>
                      <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-1" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500 text-center py-6">Sin actividad reciente</p>
            )}
          </div>
        </section>
      </div>

      <MaterialDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        plantId={currentPlant?.id ?? null}
        material={detailMaterial}
      />
    </>
  )
}
