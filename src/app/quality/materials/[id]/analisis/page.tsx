'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Loader2,
  Plus,
  Download,
  FileText,
  Trash2,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { qualityHubPrimaryButtonClass, qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi'
import PropertyControlChart from '@/components/quality/materials/PropertyControlChart'
import MaterialKPICards from '@/components/quality/materials/MaterialKPICards'
import GranulometryOverlay from '@/components/quality/materials/GranulometryOverlay'
import AddReadingModal from '@/components/quality/materials/AddReadingModal'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatEntry {
  mean: number | null
  stdDev: number | null
  cv: number | null
  count: number
  min: number | null
  max: number | null
}

interface PropertyReading {
  id: string
  reading_date: string
  source: string
  tecnico?: string | null
  lote?: string | null
  notes?: string | null
  alta_estudio?: { id: string; nombre_material?: string; mina_procedencia?: string } | null
  certificate?: { id: string; original_name: string; file_path: string } | null
  [key: string]: unknown
}

interface GranulometryEvent {
  alta_estudio: {
    id: string
    fecha_muestreo?: string | null
    fecha_elaboracion?: string | null
    nombre_material?: string | null
    mina_procedencia?: string | null
  } | null
  mallas: { abertura_mm: number; numero_malla: string; porcentaje_pasa: number; porcentaje_acumulado: number }[]
  modulo_finura?: number | null
}

interface TrendData {
  material: {
    id: string
    material_name: string
    category: string
    subcategory?: string | null
    aggregate_type?: string | null
    plant_id?: string | null
    plants?: { name: string } | null
    suppliers?: { name: string } | null
  }
  propertyTimeline: PropertyReading[]
  granulometryHistory: GranulometryEvent[]
  stats: Record<string, StatEntry>
}

// ─── Property configuration ───────────────────────────────────────────────────

const PROPERTY_CONFIG: Record<string, { label: string; unit: string }> = {
  resistencia_compresion:      { label: 'Resistencia a la compresión', unit: 'kg/cm²' },
  tiempo_fraguado_inicial:     { label: 'Tiempo de fraguado inicial',  unit: 'min' },
  tiempo_fraguado_final:       { label: 'Tiempo de fraguado final',    unit: 'min' },
  ph:                          { label: 'pH',                          unit: '' },
  densidad_aditivo:            { label: 'Densidad',                    unit: 'g/cm³' },
  peso_volumetrico_suelto:     { label: 'Peso volumétrico suelto',     unit: 'kg/m³' },
  peso_volumetrico_compactado: { label: 'Peso volumétrico compactado', unit: 'kg/m³' },
  densidad_agregado:           { label: 'Densidad (masa específica)',  unit: 'g/cm³' },
  absorcion:                   { label: 'Absorción',                   unit: '%' },
  modulo_finura:               { label: 'Módulo de finura',            unit: '' },
  perdida_lavado:              { label: 'Pérdida por lavado',          unit: '%' },
}

const PROPERTIES_BY_CATEGORY: Record<string, string[]> = {
  cemento:  ['resistencia_compresion', 'tiempo_fraguado_inicial', 'tiempo_fraguado_final'],
  aditivo:  ['ph', 'densidad_aditivo'],
  arena:    ['absorcion', 'modulo_finura', 'perdida_lavado', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado', 'densidad_agregado'],
  grava:    ['absorcion', 'densidad_agregado', 'modulo_finura', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado'],
  agregado: ['absorcion', 'modulo_finura', 'densidad_agregado', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado', 'perdida_lavado'],
}

const CATEGORY_BADGE: Record<string, string> = {
  cemento: 'border-amber-200 text-amber-700 bg-amber-50',
  aditivo: 'border-violet-200 text-violet-700 bg-violet-50',
  arena:   'border-yellow-200 text-yellow-700 bg-yellow-50',
  grava:   'border-stone-300 text-stone-600 bg-stone-50',
  agregado:'border-yellow-200 text-yellow-700 bg-yellow-50',
}

// ─── History table ────────────────────────────────────────────────────────────

function HistoryTable({
  readings,
  category,
  onDelete,
}: {
  readings: PropertyReading[]
  category: string
  onDelete: (id: string) => Promise<void>
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const props = PROPERTIES_BY_CATEGORY[category] ?? PROPERTIES_BY_CATEGORY.agregado

  if (readings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-stone-400 text-sm">
        Sin lecturas registradas para este material
      </div>
    )
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta lectura? Esta acción no se puede deshacer.')) return
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="px-3 py-2 text-left font-medium text-stone-500">Fecha</th>
            <th className="px-3 py-2 text-left font-medium text-stone-500">Técnico</th>
            <th className="px-3 py-2 text-left font-medium text-stone-500">Lote / Origen</th>
            {props.map((p) => (
              <th key={p} className="px-3 py-2 text-right font-medium text-stone-500 whitespace-nowrap">
                {PROPERTY_CONFIG[p]?.label ?? p}
                {PROPERTY_CONFIG[p]?.unit ? ` (${PROPERTY_CONFIG[p].unit})` : ''}
              </th>
            ))}
            <th className="px-3 py-2 text-left font-medium text-stone-500">Fuente</th>
            <th className="px-3 py-2 text-left font-medium text-stone-500">Docs</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {[...readings].reverse().map((r) => (
            <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
              <td className="px-3 py-2 text-stone-700 whitespace-nowrap">
                {format(parseISO(r.reading_date), 'd MMM yyyy', { locale: es })}
              </td>
              <td className="px-3 py-2 text-stone-600">{r.tecnico ?? '—'}</td>
              <td className="px-3 py-2 text-stone-600">
                {r.lote ?? r.alta_estudio?.mina_procedencia ?? '—'}
              </td>
              {props.map((p) => {
                const val = r[p] as number | null | undefined
                return (
                  <td key={p} className="px-3 py-2 text-right text-stone-700 font-mono">
                    {val != null ? val.toFixed(PROPERTY_CONFIG[p]?.unit === 'min' ? 0 : 3) : '—'}
                  </td>
                )
              })}
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] py-0 h-4',
                    r.source === 'manual'
                      ? 'text-sky-700 border-sky-200 bg-sky-50'
                      : 'text-stone-600 border-stone-200'
                  )}
                >
                  {r.source === 'manual' ? 'Manual' : 'Caracterización'}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  {r.certificate && (
                    <a
                      href={`/api/materials/certificates/download?path=${encodeURIComponent(r.certificate.file_path)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-400 hover:text-sky-600 transition-colors"
                      title="Ver certificado PDF"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {r.alta_estudio && (
                    <a
                      href={`/quality/caracterizacion-materiales?estudio=${r.alta_estudio.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-400 hover:text-sky-600 transition-colors"
                      title="Ver estudio de caracterización"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                {r.source === 'manual' && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-stone-300 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Eliminar lectura"
                  >
                    {deletingId === r.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialAnalysisPage() {
  const params = useParams()
  const materialId = params.id as string

  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReadingModal, setShowReadingModal] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const res = await fetch(`/api/quality/materials/${materialId}/trend?${params}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Error al cargar datos')
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [materialId, dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDeleteReading(readingId: string) {
    try {
      const res = await fetch(
        `/api/quality/materials/${materialId}/readings?reading_id=${readingId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Error al eliminar')
      }
      toast.success('Lectura eliminada')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar lectura')
      throw err
    }
  }

  async function handleExportExcel() {
    try {
      const { exportMaterialTrendExcel } = await import('@/lib/quality/materialTrendExcelExport')
      if (!data) return
      await exportMaterialTrendExcel(data)
    } catch {
      toast.error('Error al generar Excel')
    }
  }

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center py-20 gap-2 text-stone-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando análisis…</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <QualityBreadcrumb
          hubName="Validaciones"
          hubHref="/quality/validaciones"
          items={[{ label: 'Control de Materiales', href: '/quality/materials' }, { label: 'Análisis' }]}
        />
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error ?? 'No se pudo cargar el material'}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto text-xs h-7">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const { material, propertyTimeline, granulometryHistory, stats } = data

  function deriveEffectiveCategory(cat: string, aggType?: string | null, sub?: string | null): string {
    if (cat !== 'agregado') return cat
    if (aggType === 'AR') return 'arena'
    if (aggType === 'GR') return 'grava'
    const s = (sub ?? '').toLowerCase()
    if (s.includes('fino') || s.includes('arena')) return 'arena'
    if (s.includes('grueso') || s.includes('grava')) return 'grava'
    return 'agregado'
  }

  const effectiveCat = deriveEffectiveCategory(material.category, material.aggregate_type, material.subcategory)
  const properties = PROPERTIES_BY_CATEGORY[effectiveCat] ?? PROPERTIES_BY_CATEGORY.agregado
  const isAgregado = !['cemento', 'aditivo'].includes(material.category)
  const badgeClass = CATEGORY_BADGE[effectiveCat] ?? CATEGORY_BADGE.agregado

  const lastReadingDate = propertyTimeline.length > 0
    ? format(parseISO(propertyTimeline[propertyTimeline.length - 1].reading_date), 'd MMM yyyy', { locale: es })
    : null

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <QualityBreadcrumb
        hubName="Validaciones"
        hubHref="/quality/validaciones"
        items={[
          { label: 'Control de Materiales', href: '/quality/materials' },
          { label: material.material_name },
        ]}
      />

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link
              href="/quality/materials"
              className="text-stone-400 hover:text-stone-600 transition-colors"
              title="Volver"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold text-stone-900">{material.material_name}</h1>
            <Badge variant="outline" className={cn('text-xs', badgeClass)}>
              {material.category}
            </Badge>
            {material.subcategory && (
              <Badge variant="outline" className="text-xs text-stone-500">
                {material.subcategory}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500 pl-6 flex-wrap">
            {material.suppliers?.name && (
              <span>{material.suppliers.name}</span>
            )}
            {material.plants?.name && (
              <span>· {material.plants.name}</span>
            )}
            {lastReadingDate && (
              <span>· Última lectura: {lastReadingDate}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Date range filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-stone-200 rounded px-2 py-1 text-xs text-stone-700 h-8"
              title="Desde"
            />
            <span className="text-stone-400">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-stone-200 rounded px-2 py-1 text-xs text-stone-700 h-8"
              title="Hasta"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className={cn('h-8 text-xs', qualityHubOutlineNeutralClass)}
            disabled={propertyTimeline.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar
          </Button>

          <Button
            size="sm"
            onClick={() => setShowReadingModal(true)}
            className={cn('h-8 text-xs', qualityHubPrimaryButtonClass)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Agregar lectura
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <MaterialKPICards
        category={material.category}
        stats={stats}
        readingCount={propertyTimeline.length}
        lastReadingDate={lastReadingDate}
      />

      {/* Tabs */}
      <Tabs defaultValue="spc" className="space-y-4">
        <TabsList className="bg-stone-100 border-0 h-9">
          <TabsTrigger value="spc" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Control Estadístico
          </TabsTrigger>
          {isAgregado && (
            <TabsTrigger value="granulometry" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Granulometría
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Historial
            {propertyTimeline.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">
                {propertyTimeline.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Statistical Control tab */}
        <TabsContent value="spc" className="space-y-6">
          {propertyTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <div className="text-4xl">📊</div>
              <p className="text-sm font-medium">Sin lecturas para mostrar gráficos de control</p>
              <Button
                size="sm"
                onClick={() => setShowReadingModal(true)}
                className={cn('text-xs', qualityHubPrimaryButtonClass)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Registrar primera lectura
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {properties.map((prop) => {
                const stat = stats[prop]
                if (!stat || stat.count === 0) return null
                const config = PROPERTY_CONFIG[prop]
                return (
                  <div
                    key={prop}
                    className="rounded-lg border border-stone-200 bg-white p-4"
                  >
                    <h3 className="text-sm font-semibold text-stone-800 mb-3">
                      {config?.label ?? prop}
                      {config?.unit && (
                        <span className="text-xs font-normal text-stone-400 ml-1.5">({config.unit})</span>
                      )}
                    </h3>
                    <PropertyControlChart
                      readings={propertyTimeline}
                      property={prop}
                      label={config?.label ?? prop}
                      unit={config?.unit ?? ''}
                      stats={stat}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Granulometry tab */}
        {isAgregado && (
          <TabsContent value="granulometry">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-stone-800 mb-1">
                Curvas granulométricas históricas
              </h3>
              <p className="text-xs text-stone-400 mb-4">
                Cada curva corresponde a un estudio de Análisis Granulométrico vinculado a este material.
                La más reciente aparece con mayor opacidad.
              </p>
              <GranulometryOverlay
                history={granulometryHistory}
                tipoMaterial={
                  material.category === 'arena' || material.subcategory?.toLowerCase().includes('arena')
                    ? 'Arena'
                    : 'Grava'
                }
              />
            </div>
          </TabsContent>
        )}

        {/* History tab */}
        <TabsContent value="history">
          <HistoryTable
            readings={propertyTimeline}
            category={material.category}
            onDelete={handleDeleteReading}
          />
        </TabsContent>
      </Tabs>

      {/* Add Reading Modal */}
      <AddReadingModal
        open={showReadingModal}
        onClose={() => setShowReadingModal(false)}
        materialId={materialId}
        materialName={material.material_name}
        category={material.category}
        plantId={material.plant_id ?? undefined}
        onSuccess={() => {
          setShowReadingModal(false)
          fetchData()
        }}
      />
    </div>
  )
}
