'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, AlertTriangle, Loader2, ExternalLink, Package, Activity, CheckCircle, XCircle } from 'lucide-react'
import { qualityHubSummaryStatusMap } from '@/components/quality/qualityHubUi'
import { usePlantContext } from '@/contexts/PlantContext'
import MaterialTrendCard from '@/components/quality/materials/MaterialTrendCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatEntry {
  mean: number | null
  stdDev: number | null
  cv: number | null
  count: number
  min: number | null
  max: number | null
}

interface MaterialSummary {
  id: string
  material_name: string
  category: string
  effective_category: string
  subcategory?: string | null
  aggregate_type?: string | null
  plant_id?: string | null
  plants?: { name: string; code: string } | null
  suppliers?: { name: string } | null
  readingCount: number
  lastReadingDate?: string | null
  stats: Record<string, StatEntry>
  sparklines: Record<string, Array<{ date: string; value: number }>>
  hasAlert: boolean
}

const CATEGORY_OPTIONS = [
  { value: 'all',      label: 'Todos' },
  { value: 'cemento',  label: 'Cemento' },
  { value: 'aditivo',  label: 'Aditivo' },
  { value: 'arena',    label: 'Arena (Fino)' },
  { value: 'grava',    label: 'Grava (Grueso)' },
  { value: 'agregado', label: 'Agregado' },
]

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({ materials }: { materials: MaterialSummary[] }) {
  const total = materials.length
  const withReadings = materials.filter((m) => m.readingCount > 0).length
  const withoutReadings = total - withReadings
  const alerts = materials.filter((m) => m.hasAlert).length

  const cards = [
    { label: 'Materiales totales', value: total,         status: 'neutral'  as const, icon: <Package    className="h-3.5 w-3.5" /> },
    { label: 'Con lecturas',       value: withReadings,  status: (withReadings  > 0 ? 'ok'       : 'neutral')  as const, icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { label: 'Sin lecturas',       value: withoutReadings,status: (withoutReadings > 0 ? 'warning' : 'ok')      as const, icon: <XCircle     className="h-3.5 w-3.5" /> },
    { label: 'Alertas activas',    value: alerts,         status: (alerts > 0 ? 'critical' : 'ok')              as const, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => {
        const s = qualityHubSummaryStatusMap[card.status]
        return (
          <div key={card.label} className={cn('rounded-xl border px-4 py-3', s.card)}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={s.label}>{card.icon}</span>
              <p className={cn('text-xs font-medium', s.label)}>{card.label}</p>
            </div>
            <p className={cn('text-2xl font-bold tracking-tight', s.value)}>{card.value}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialControlCenterPage() {
  const { currentPlant } = usePlantContext()
  const [materials, setMaterials] = useState<MaterialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (currentPlant?.id) params.set('plant_id', currentPlant.id)
      const res = await fetch(`/api/quality/materials/summary?${params}`)
      if (!res.ok) throw new Error('Error al cargar materiales')
      const json = await res.json()
      const list: MaterialSummary[] = json.materials ?? []
      setMaterials(
        list.sort((a, b) => {
          if (a.hasAlert && !b.hasAlert) return -1
          if (!a.hasAlert && b.hasAlert) return 1
          return a.material_name.localeCompare(b.material_name, 'es')
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = materials.filter((m) => {
    const matchCat = categoryFilter === 'all' || m.effective_category === categoryFilter
    const matchSearch =
      search === '' ||
      m.material_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.suppliers?.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const alertCount = filtered.filter((m) => m.hasAlert).length

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <QualityBreadcrumb
        hubName="Validaciones"
        hubHref="/quality/validaciones"
        items={[{ label: 'Control de Materiales' }]}
      />

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Centro de Control — Materiales</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Monitoreo estadístico de propiedades
            {currentPlant ? ` · ${currentPlant.name}` : ' · Todas las plantas'}
          </p>
        </div>
        <Link
          href="/admin/materials"
          className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 shrink-0"
        >
          <Activity className="h-3.5 w-3.5" />
          Gestionar catálogo <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* KPI strip */}
      {!loading && !error && <KpiStrip materials={materials} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Buscar material…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm h-9 bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCategoryFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                categoryFilter === opt.value
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-stone-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando materiales…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto text-xs h-7">Reintentar</Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-stone-400">
          <Package className="h-10 w-10 text-stone-200" />
          <p className="text-sm font-medium">
            {materials.length === 0 ? 'No hay materiales en el catálogo' : 'Sin resultados para los filtros actuales'}
          </p>
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && filtered.length > 0 && (
        <>
          {alertCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                {alertCount} material{alertCount > 1 ? 'es' : ''} con lecturas fuera de control estadístico
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((mat) => (
              <MaterialTrendCard
                key={mat.id}
                materialId={mat.id}
                materialName={mat.material_name}
                category={mat.category}
                effectiveCategory={mat.effective_category}
                subcategory={mat.subcategory}
                supplier={mat.suppliers?.name}
                plantName={mat.plants?.name}
                plantId={mat.plant_id ?? undefined}
                readingCount={mat.readingCount}
                lastReadingDate={mat.lastReadingDate ? formatDate(mat.lastReadingDate) : null}
                sparklines={mat.sparklines}
                stats={mat.stats}
                hasAlert={mat.hasAlert}
                onReadingAdded={fetchData}
              />
            ))}
          </div>

          <p className="text-xs text-stone-400 text-center pb-4">
            {filtered.length} material{filtered.length !== 1 ? 'es' : ''}
            {categoryFilter !== 'all' ? ` · ${CATEGORY_OPTIONS.find(c => c.value === categoryFilter)?.label}` : ''}
            {search ? ` · "${search}"` : ''}
          </p>
        </>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}
