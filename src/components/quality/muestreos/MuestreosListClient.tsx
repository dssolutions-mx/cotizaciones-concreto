'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange } from 'react-day-picker'
import {
  Loader2,
  AlertTriangle,
  Plus,
  FileText,
  ChevronDown,
  Factory,
  Clock,
  RefreshCw,
  ChevronUp,
  CalendarDays,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { fetchMuestreos } from '@/services/qualityMuestreoService'
import type { MuestreoWithRelations } from '@/types/quality'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { formatDate, cn } from '@/lib/utils'
import { usePlantContext } from '@/contexts/PlantContext'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import MuestreoKpiStrip from '@/components/quality/muestreos/MuestreoKpiStrip'
import MuestreoExpandedRow from '@/components/quality/muestreos/MuestreoExpandedRow'
import {
  calcularResistencia,
  computeResistanceCompliance,
  computeSpecimenDots,
  getConstructionSite,
  parseSortOption,
  resistanceComplianceClass,
  type SortOption,
  type SpecimenDotKind,
} from '@/components/quality/muestreos/muestreosListHelpers'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const PAGE_SIZE = 50
const COL_SPAN = 8

const PLANTAS = ['P001', 'P002', 'P003', 'P004']
const CLASIFICACIONES = ['FC', 'MR']

/** Match finanzas procurement / redesigned workspace controls */
const filterSelectClass =
  'h-9 min-h-9 text-sm border-stone-300 bg-white text-stone-900 shadow-none'

function dotClass(kind: SpecimenDotKind): string {
  switch (kind) {
    case 'tested':
      return 'bg-emerald-500'
    case 'next':
      return 'bg-amber-500'
    case 'pending':
      return 'bg-stone-300'
    case 'discarded':
      return 'bg-stone-200 border border-dashed border-stone-400'
    default:
      return 'bg-stone-200'
  }
}

export default function MuestreosListClient() {
  const router = useRouter()
  const { profile } = useAuthBridge()
  const { currentPlant } = usePlantContext()
  const [muestreos, setMuestreos] = useState<MuestreoWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [planta, setPlanta] = useState<string>('todas')
  const [clasificacion, setClasificacion] = useState<string>('todas')
  const [estadoMuestreo, setEstadoMuestreo] = useState<string>('todos')
  const [sortOption, setSortOption] = useState<SortOption>('fecha_desc')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const rowClickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingToggleIdRef = React.useRef<string | null>(null)

  const loadMuestreos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setCurrentPage(0)
      const result = await fetchMuestreos(
        {
          fechaDesde: dateRange?.from,
          fechaHasta: dateRange?.to,
          plant_id: currentPlant?.id,
        },
        PAGE_SIZE,
        0
      )
      setMuestreos(result.data)
      setTotalCount(result.count)
    } catch (err) {
      console.error('Error loading muestreos:', err)
      setError('Error al cargar los muestreos')
    } finally {
      setLoading(false)
    }
  }, [dateRange, currentPlant?.id])

  useEffect(() => {
    loadMuestreos()
  }, [loadMuestreos])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      setError(null)
      setCurrentPage(0)
      const result = await fetchMuestreos(
        {
          fechaDesde: dateRange?.from,
          fechaHasta: dateRange?.to,
          plant_id: currentPlant?.id,
        },
        PAGE_SIZE,
        0
      )
      setMuestreos(result.data)
      setTotalCount(result.count)
    } catch (err) {
      console.error('Error refreshing muestreos:', err)
      setError('Error al cargar los muestreos')
    } finally {
      setRefreshing(false)
    }
  }

  const loadMoreMuestreos = async () => {
    if (loadingMore || (totalCount !== null && muestreos.length >= totalCount)) return
    try {
      setLoadingMore(true)
      const nextPage = currentPage + 1
      const offset = nextPage * PAGE_SIZE
      const result = await fetchMuestreos(
        {
          fechaDesde: dateRange?.from,
          fechaHasta: dateRange?.to,
          plant_id: currentPlant?.id,
        },
        PAGE_SIZE,
        offset
      )
      setMuestreos((prev) => [...prev, ...result.data])
      setCurrentPage(nextPage)
    } catch (err) {
      console.error('Error loading more muestreos:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const { sortBy, sortDirection } = parseSortOption(sortOption)

  const filteredMuestreos = useMemo(() => {
    let filtered = [...muestreos]

    if (searchQuery) {
      const search = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.remision?.remision_number?.toString().toLowerCase().includes(search) ||
          m.remision?.orders?.clients?.business_name?.toLowerCase().includes(search) ||
          m.remision?.order?.clients?.business_name?.toLowerCase().includes(search) ||
          m.remision?.recipe?.recipe_code?.toLowerCase().includes(search) ||
          getConstructionSite(m).toLowerCase().includes(search) ||
          m.manual_reference?.toLowerCase().includes(search)
      )
    }

    if (planta && planta !== 'todas') {
      filtered = filtered.filter((m) => m.planta === planta)
    }

    if (clasificacion && clasificacion !== 'todas') {
      filtered = filtered.filter((m) => {
        const recipeNotes = m.remision?.recipe?.recipe_versions?.[0]?.notes || ''
        return recipeNotes.includes(clasificacion)
      })
    }

    if (estadoMuestreo && estadoMuestreo !== 'todos') {
      filtered = filtered.filter((m) => {
        if (!m.muestras || m.muestras.length === 0) return false
        switch (estadoMuestreo) {
          case 'completado':
            return m.muestras.every((muestra) => muestra.estado === 'ENSAYADO')
          case 'en-proceso':
            return (
              m.muestras.some((muestra) => muestra.estado === 'ENSAYADO') &&
              !m.muestras.every((muestra) => muestra.estado === 'ENSAYADO')
            )
          case 'pendiente':
            return m.muestras.every((muestra) => muestra.estado === 'PENDIENTE')
          default:
            return true
        }
      })
    }

    filtered.sort((a, b) => {
      let valA: number
      let valB: number
      switch (sortBy) {
        case 'fecha':
          valA = new Date(a.fecha_muestreo || 0).getTime()
          valB = new Date(b.fecha_muestreo || 0).getTime()
          break
        case 'remision':
          valA = Number(a.remision?.remision_number) || 0
          valB = Number(b.remision?.remision_number) || 0
          break
        case 'f_c':
          valA = a.remision?.recipe?.strength_fc || 0
          valB = b.remision?.recipe?.strength_fc || 0
          break
        default:
          valA = new Date(a.fecha_muestreo || 0).getTime()
          valB = new Date(b.fecha_muestreo || 0).getTime()
      }
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1
    })

    return filtered
  }, [muestreos, searchQuery, planta, clasificacion, estadoMuestreo, sortBy, sortDirection])

  const clearFilters = () => {
    setSearchQuery('')
    setPlanta('todas')
    setClasificacion('todas')
    setEstadoMuestreo('todos')
    setDateRange(undefined)
  }

  const hasActiveFilters =
    !!searchQuery ||
    planta !== 'todas' ||
    clasificacion !== 'todas' ||
    estadoMuestreo !== 'todos' ||
    !!dateRange

  const handleRowNavigate = (id: string) => {
    if (rowClickTimerRef.current) {
      clearTimeout(rowClickTimerRef.current)
      rowClickTimerRef.current = null
    }
    pendingToggleIdRef.current = null
    router.push(`/quality/muestreos/${id}`)
  }

  /** Single click: expand/collapse after short delay so double-click can mean “open detail”. */
  const handleRowToggle = (id: string) => {
    pendingToggleIdRef.current = id
    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current)
    rowClickTimerRef.current = setTimeout(() => {
      if (pendingToggleIdRef.current === id) {
        setExpandedId((prev) => (prev === id ? null : id))
      }
      rowClickTimerRef.current = null
      pendingToggleIdRef.current = null
    }, 220)
  }

  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE']
  const hasAccess = profile && allowedRoles.includes(profile.role)

  const estadosMuestreoOpts = [
    { id: 'completado', label: 'Completado' },
    { id: 'en-proceso', label: 'En Proceso' },
    { id: 'pendiente', label: 'Pendiente' },
  ]

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-lg p-8">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
          <h2 className="text-2xl font-semibold text-amber-900">Acceso restringido</h2>
        </div>
        <p className="text-amber-800">No tienes permiso para acceder a la lista de muestreos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <QualityBreadcrumb
        hubName="Operaciones"
        hubHref="/quality/operaciones"
        items={[{ label: 'Muestreos' }]}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0" />
          <p className="text-sm text-red-900 flex-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="border border-red-300 text-red-700 hover:bg-red-100 bg-white"
            onClick={handleRefresh}
          >
            Reintentar
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Muestreos de concreto
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Historial de muestreos realizados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            className="h-9 bg-sky-700 px-3 text-sm text-white shadow-none hover:bg-sky-800"
            onClick={() => router.push('/quality/muestreos/new')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo muestreo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-stone-300 bg-white px-3 shadow-none hover:bg-stone-50"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Actualizar lista"
          >
            <RefreshCw className={cn('h-4 w-4 text-stone-700', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <div className="h-3 w-16 bg-stone-100 rounded animate-pulse" />
              <div className="h-7 w-20 bg-stone-100 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <MuestreoKpiStrip muestreos={filteredMuestreos} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          id="muestreos-search"
          placeholder="Buscar: remisión, cliente, obra, receta…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'h-9 min-h-9 flex-1 min-w-[min(100%,220px)] sm:max-w-md',
            'border-stone-300 bg-white text-stone-900 shadow-none'
          )}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[160px] max-w-[240px] justify-start gap-2 border-stone-300 bg-white px-3 font-normal text-stone-900 shadow-none hover:bg-stone-50"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-stone-600" />
              <span className="truncate">
                {dateRange?.from
                  ? `${formatDate(dateRange.from, 'dd/MM/yy')}${dateRange.to ? ` – ${formatDate(dateRange.to, 'dd/MM/yy')}` : ''}`
                  : 'Todas las fechas'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-stone-200" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Select value={planta} onValueChange={setPlanta}>
          <SelectTrigger className={cn(filterSelectClass, 'w-[200px]')}>
            <SelectValue placeholder="Planta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las plantas</SelectItem>
            {PLANTAS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={clasificacion} onValueChange={setClasificacion}>
          <SelectTrigger className={cn(filterSelectClass, 'w-[118px]')}>
            <SelectValue placeholder="Clasif." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">FC / MR</SelectItem>
            {CLASIFICACIONES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={estadoMuestreo} onValueChange={setEstadoMuestreo}>
          <SelectTrigger className={cn(filterSelectClass, 'w-[148px]')}>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos estados</SelectItem>
            {estadosMuestreoOpts.map((estado) => (
              <SelectItem key={estado.id} value={estado.id}>
                {estado.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className={cn(filterSelectClass, 'w-[min(100%,200px)] sm:w-[200px]')}>
            <SelectValue placeholder="Orden" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fecha_desc">Fecha (reciente)</SelectItem>
            <SelectItem value="fecha_asc">Fecha (antigua)</SelectItem>
            <SelectItem value="remision_desc">Remisión (mayor)</SelectItem>
            <SelectItem value="remision_asc">Remisión (menor)</SelectItem>
            <SelectItem value="f_c_desc">f′c (mayor)</SelectItem>
            <SelectItem value="f_c_asc">f′c (menor)</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 border-stone-300 bg-white px-3 text-stone-800 shadow-none hover:bg-stone-50"
            onClick={clearFilters}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 rounded-lg border border-stone-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <span className="ml-2 text-stone-600">Cargando muestreos…</span>
        </div>
      ) : filteredMuestreos.length === 0 ? (
        <Card className="border-stone-200">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <FileText className="h-12 w-12 text-stone-300 mb-2" />
            <h3 className="text-lg font-medium text-stone-900 mb-1">No se encontraron muestreos</h3>
            <p className="text-stone-500 mb-4 text-sm max-w-md">
              {hasActiveFilters
                ? 'No hay muestreos que coincidan con los filtros.'
                : 'No hay muestreos registrados.'}
            </p>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                className="border-stone-300 bg-white shadow-none hover:bg-stone-50"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow className="bg-stone-50/80 hover:bg-stone-50/80 border-b border-stone-200">
                  <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600 w-[88px]">
                    Fecha
                  </TableHead>
                  <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                    Remisión
                  </TableHead>
                  <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600 min-w-[140px]">
                    Cliente / obra
                  </TableHead>
                  <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                    Receta
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-stone-600 w-[120px]">
                    Especímenes
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-stone-600 w-[130px]">
                    Resistencia
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-stone-600 w-[110px]">
                    Estado
                  </TableHead>
                  <TableHead className="w-10 p-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMuestreos.map((muestreo) => {
                  const id = muestreo.id as string
                  const isOpen = expandedId === id
                  const { valorNum, edadDias } = calcularResistencia(muestreo)
                  const fc = muestreo.remision?.recipe?.strength_fc ?? null
                  const compliance = computeResistanceCompliance(valorNum, fc)
                  const { dots, nextPendingFecha } = computeSpecimenDots(muestreo)
                  const clientName =
                    muestreo.remision?.orders?.clients?.business_name ||
                    muestreo.remision?.order?.clients?.business_name ||
                    'N/A'
                  const obra = getConstructionSite(muestreo)

                  let estadoLabel: 'Completado' | 'En proceso' | 'Pendiente' = 'Pendiente'
                  if (muestreo.muestras?.length) {
                    if (muestreo.muestras.every((m) => m.estado === 'ENSAYADO'))
                      estadoLabel = 'Completado'
                    else if (muestreo.muestras.some((m) => m.estado === 'ENSAYADO'))
                      estadoLabel = 'En proceso'
                  }

                  return (
                    <React.Fragment key={id}>
                      <TableRow
                        className={cn(
                          'cursor-pointer border-b border-stone-100 transition-colors',
                          isOpen ? 'bg-stone-50' : 'hover:bg-stone-50'
                        )}
                        onClick={() => handleRowToggle(id)}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          handleRowNavigate(id)
                        }}
                      >
                        <TableCell className="font-mono tabular-nums text-xs text-stone-600 align-middle">
                          {muestreo.fecha_muestreo
                            ? formatDate(muestreo.fecha_muestreo, 'dd/MM/yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="font-semibold text-stone-900 flex items-center gap-1.5 flex-wrap">
                            <span>
                              {muestreo.remision?.remision_number ?? muestreo.manual_reference ?? '—'}
                            </span>
                            {muestreo.remision?.is_production_record && (
                              <span title="Producción cruzada">
                                <Factory className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0 rounded bg-stone-100 text-stone-600 border border-stone-200">
                              {muestreo.planta || '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle max-w-[200px]">
                          <div className="font-medium text-stone-900 truncate" title={clientName}>
                            {clientName}
                          </div>
                          <div className="text-xs text-stone-500 truncate" title={obra}>
                            {obra}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="font-semibold text-stone-900">
                            {fc != null ? `${fc} kg/cm²` : '—'}
                          </div>
                          <div className="text-xs text-stone-500 truncate max-w-[120px]">
                            {muestreo.remision?.recipe?.recipe_code ?? '—'}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-center">
                          <div className="flex justify-center gap-1 flex-wrap">
                            {dots.map((d, i) => (
                              <span
                                key={i}
                                className={cn('inline-block h-2 w-2 rounded-full shrink-0', dotClass(d))}
                                title={
                                  d === 'tested'
                                    ? 'Ensayado'
                                    : d === 'next'
                                      ? 'Próximo ensayo'
                                      : d === 'discarded'
                                        ? 'Descartado'
                                        : 'Pendiente'
                                }
                              />
                            ))}
                          </div>
                          {nextPendingFecha && (
                            <div className="text-[10px] text-stone-500 mt-1 flex items-center justify-center gap-0.5">
                              <Clock className="h-3 w-3 shrink-0" />
                              Prox: {formatDate(nextPendingFecha, 'dd/MM')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center align-middle">
                          {valorNum == null ? (
                            <span className="text-stone-400">—</span>
                          ) : (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono tabular-nums',
                                  resistanceComplianceClass(compliance)
                                )}
                              >
                                {valorNum}/{fc ?? '—'}
                              </span>
                              <span className="text-[10px] text-stone-500">kg/cm²</span>
                              {edadDias != null && (
                                <span className="text-[10px] text-stone-400">{edadDias}d</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center align-middle">
                          {estadoLabel === 'Completado' ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px] px-2"
                            >
                              Completado
                            </Badge>
                          ) : estadoLabel === 'En proceso' ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-800 text-[10px] px-2"
                            >
                              En proceso
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-stone-200 bg-stone-100 text-stone-700 text-[10px] px-2"
                            >
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="p-2 text-center align-middle text-stone-400">
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 mx-auto" />
                          ) : (
                            <ChevronDown className="h-4 w-4 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && <MuestreoExpandedRow muestreo={muestreo} colSpan={COL_SPAN} />}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-stone-100 bg-stone-50/50 gap-2">
            <p className="text-sm text-stone-500">
              Mostrando {filteredMuestreos.length} de {totalCount ?? '…'} muestreos
            </p>
            {totalCount !== null && muestreos.length < totalCount && (
              <Button
                type="button"
                variant="outline"
                className="border-stone-300 bg-white text-stone-800 shadow-none hover:bg-stone-50"
                onClick={loadMoreMuestreos}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando…
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Cargar más
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
