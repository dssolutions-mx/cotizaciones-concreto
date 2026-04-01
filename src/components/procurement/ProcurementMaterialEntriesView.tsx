'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { AlertCircle, Calendar as CalendarIcon, ClipboardList, DollarSign, ExternalLink, Factory, List, Package } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { buildProcurementUrl, procurementEntriesUrl, productionEntriesUrl } from '@/lib/procurement/navigation'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from '@/components/inventory/ui/DateRangePresets'
import { MaterialEntry } from '@/types/inventory'
import { toast } from 'sonner'
import EntryPricingReviewList from '@/components/inventory/EntryPricingReviewList'
import EntryPricingForm from '@/components/inventory/EntryPricingForm'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

function sortEntriesNewestFirst(list: MaterialEntry[]): MaterialEntry[] {
  return [...list].sort((a, b) => {
    const ka = `${a.entry_date ?? ''}T${a.entry_time ?? '00:00:00'}`
    const kb = `${b.entry_date ?? ''}T${b.entry_time ?? '00:00:00'}`
    return kb.localeCompare(ka)
  })
}

type Props = {
  /** Workspace plant filter (header) — URL plant_id overrides when present */
  workspacePlantId: string
  /** Show Entradas → Revisión de precios (EXECUTIVE / ADMIN_OPERATIONS) */
  canReviewPricing?: boolean
  onPricingSuccess?: () => void
}

export default function ProcurementMaterialEntriesView({
  workspacePlantId,
  canReviewPricing = false,
  onPricingSuccess,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const poIdFromUrl = searchParams.get('po_id') || undefined
  const entryIdFromUrl = searchParams.get('entry_id') || undefined
  const plantIdFromUrl = searchParams.get('plant_id') || undefined
  const entradasView = searchParams.get('entradas_view') === 'precios' ? 'precios' : 'list'

  const effectivePlantId = plantIdFromUrl || workspacePlantId || undefined

  const defaultRange = {
    from: subDays(new Date(), 6),
    to: new Date(),
  }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pricingSheetEntry, setPricingSheetEntry] = useState<MaterialEntry | null>(null)
  const autoPreciosAppliedRef = useRef(false)

  const pendingPricingInPeriod = useMemo(
    () => entries.filter((e) => e.pricing_status !== 'reviewed').length,
    [entries]
  )

  const replaceQuery = useCallback(
    (next: {
      po_id?: string | null
      entry_id?: string | null
      plant_id?: string | null
      entradas_view?: 'list' | 'precios' | null
    }) => {
      const p = new URLSearchParams(searchParams.toString())
      p.set('tab', 'entradas')
      if (next.plant_id !== undefined) {
        if (next.plant_id) p.set('plant_id', next.plant_id)
        else p.delete('plant_id')
      }
      if (next.po_id !== undefined) {
        if (next.po_id) p.set('po_id', next.po_id)
        else p.delete('po_id')
      }
      if (next.entry_id !== undefined) {
        if (next.entry_id) p.set('entry_id', next.entry_id)
        else p.delete('entry_id')
      }
      if (next.entradas_view !== undefined) {
        if (next.entradas_view === 'precios') p.set('entradas_view', 'precios')
        else p.delete('entradas_view')
      }
      router.replace(`?${p.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const setEntradasView = useCallback(
    (v: 'list' | 'precios') => {
      replaceQuery({ entradas_view: v === 'precios' ? 'precios' : null })
    },
    [replaceQuery]
  )

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange?.from && dateRange?.to) {
        params.set('date_from', format(dateRange.from, 'yyyy-MM-dd'))
        params.set('date_to', format(dateRange.to, 'yyyy-MM-dd'))
      } else {
        params.set('date', format(new Date(), 'yyyy-MM-dd'))
      }
      if (poIdFromUrl) params.set('po_id', poIdFromUrl)
      if (effectivePlantId) params.set('plant_id', effectivePlantId)
      params.set('limit', '100')
      params.set('offset', '0')

      const res = await fetch(`/api/inventory/entries?${params.toString()}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al cargar entradas')
      }
      const data = await res.json()
      let list: MaterialEntry[] = data.entries || []

      if (
        entryIdFromUrl &&
        !list.some((e) => e.id === entryIdFromUrl)
      ) {
        const r2 = await fetch(
          `/api/inventory/entries?entry_id=${encodeURIComponent(entryIdFromUrl)}`
        )
        if (r2.ok) {
          const data2 = await r2.json()
          const extra: MaterialEntry[] = data2.entries || []
          const merged = [...extra, ...list]
          const seen = new Set<string>()
          list = merged.filter((e) => {
            if (seen.has(e.id)) return false
            seen.add(e.id)
            return true
          })
          list = sortEntriesNewestFirst(list)
        }
      }

      setEntries(list)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al cargar entradas')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, poIdFromUrl, effectivePlantId, entryIdFromUrl])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  /** Admins land on revisión de precios when hay pendientes y no hay vista explícita en URL */
  useEffect(() => {
    if (!canReviewPricing || loading) return
    if (searchParams.has('entradas_view')) return
    if (poIdFromUrl || entryIdFromUrl) return
    if (autoPreciosAppliedRef.current) return
    const pending = entries.filter((e) => e.pricing_status !== 'reviewed').length
    if (pending > 0) {
      autoPreciosAppliedRef.current = true
      replaceQuery({ entradas_view: 'precios' })
    }
  }, [canReviewPricing, loading, entries, searchParams, replaceQuery, poIdFromUrl, entryIdFromUrl])

  useEffect(() => {
    if (entradasView === 'precios' && !canReviewPricing) {
      replaceQuery({ entradas_view: null })
    }
  }, [entradasView, canReviewPricing, replaceQuery])

  useEffect(() => {
    if (loading || !entryIdFromUrl) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(`proc-entry-row-${entryIdFromUrl}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [loading, entryIdFromUrl, entries])

  const handlePresetSelect = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setSelectedPreset(preset)
    setDateRange(range)
  }

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range)
    if (range.from && range.to) {
      const presets: DateRangePreset[] = ['today', 'yesterday', 'last7days', 'last30days', 'thisWeek', 'thisMonth']
      for (const preset of presets) {
        const pr = getDateRangeForPreset(preset)
        if (
          format(range.from, 'yyyy-MM-dd') === format(pr.from, 'yyyy-MM-dd') &&
          format(range.to, 'yyyy-MM-dd') === format(pr.to, 'yyyy-MM-dd')
        ) {
          setSelectedPreset(preset)
          return
        }
      }
      setSelectedPreset('custom')
    }
  }

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-700" />
            Recepciones de material
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Vista para compras y operaciones: OC, proveedor, precios y remisión. La recepción física y el inventario
            detallado siguen en{' '}
            <Link
              href={productionEntriesUrl({ plantId: effectivePlantId })}
              className="text-sky-800 font-medium hover:underline inline-flex items-center gap-0.5"
            >
              Control de producción
              <ExternalLink className="h-3 w-3" />
            </Link>
            .
            {canReviewPricing && (
              <span className="block mt-2 text-stone-700">
                La <strong className="font-medium text-stone-900">revisión de precios</strong> es el paso principal: la
                cola aparece primero cuando hay pendientes. Use <strong className="font-medium text-stone-900">Todas las
                recepciones</strong> para el listado por fechas y el botón <strong className="font-medium text-stone-900">Revisar precio</strong> en cada fila.
              </span>
            )}
          </p>
        </div>
      </div>

      {canReviewPricing && pendingPricingInPeriod > 0 && (
        <Alert className="border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50/80 text-amber-950 shadow-sm">
          <AlertCircle className="h-5 w-5 text-amber-700" />
          <AlertTitle className="text-base font-semibold text-amber-950">
            {pendingPricingInPeriod} entrada{pendingPricingInPeriod === 1 ? '' : 's'} pendiente
            {pendingPricingInPeriod === 1 ? '' : 's'} de revisión de precios en el período seleccionado
          </AlertTitle>
          <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-950/95">
            <span>Capture precios y facturas contra la OC aquí; es la acción más frecuente del área.</span>
            <div className="flex flex-wrap gap-2 shrink-0">
              {entradasView === 'list' && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-stone-900 text-white hover:bg-stone-800"
                  onClick={() => setEntradasView('precios')}
                >
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Ir a la cola de revisión
                </Button>
              )}
              {entradasView === 'precios' && (
                <Button type="button" size="sm" variant="outline" className="border-amber-800/40 bg-white" asChild>
                  <Link href={procurementEntriesUrl({ plantId: effectivePlantId })}>
                    <List className="h-4 w-4 mr-1.5" />
                    Ver todas las recepciones
                  </Link>
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {entradasView === 'list' && (poIdFromUrl || entryIdFromUrl) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {poIdFromUrl && (
            <Badge variant="secondary" className="font-mono">
              OC filtrada
            </Badge>
          )}
          {entryIdFromUrl && (
            <Badge variant="outline" className="border-sky-300 text-sky-900">
              Entrada resaltada
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => replaceQuery({ po_id: null, entry_id: null })}
          >
            Quitar filtros de enlace
          </Button>
        </div>
      )}

      {canReviewPricing && (
        <Tabs value={entradasView} onValueChange={(v) => setEntradasView(v as 'list' | 'precios')}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="grid w-full sm:w-auto sm:min-w-[380px] max-w-full grid-cols-2 h-auto bg-stone-200/60 p-1 rounded-lg">
              <TabsTrigger value="precios" className="gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
                <DollarSign className="h-4 w-4" />
                Revisión de precios
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
                <List className="h-4 w-4" />
                Todas las recepciones
              </TabsTrigger>
            </TabsList>
            {entradasView === 'list' && pendingPricingInPeriod > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-amber-950">
                <Badge variant="outline" className="border-amber-300 bg-amber-100/90 font-normal">
                  {pendingPricingInPeriod} pendiente{pendingPricingInPeriod === 1 ? '' : 's'} (período)
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  className="bg-stone-900 text-white hover:bg-stone-800"
                  onClick={() => setEntradasView('precios')}
                >
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Ir a la cola
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="precios" className="mt-4">
            <Card className="border-stone-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-700" />
                  Cola de revisión de precios
                </CardTitle>
                <CardDescription>
                  Entradas con precio pendiente de validar respecto a OC y factura (últimos 30 días, filtrado por planta
                  del espacio de trabajo cuando aplica). Toque una fila para capturar costos y factura.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EntryPricingReviewList
                  plantId={effectivePlantId}
                  onSuccess={() => onPricingSuccess?.()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="mt-4 space-y-0">
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription>
                {effectivePlantId
                  ? 'Filtrado por la planta indicada (enlace o selector del espacio de trabajo).'
                  : 'Todas las plantas permitidas para su rol.'}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              <DateRangePresets selectedPreset={selectedPreset} onPresetSelect={handlePresetSelect} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-full lg:w-[280px] justify-start text-left font-normal',
                      !dateRange.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'dd MMM', { locale: es })} -{' '}
                          {format(dateRange.to, 'dd MMM yyyy', { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, 'dd MMM yyyy', { locale: es })
                      )
                    ) : (
                      'Rango de fechas'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-stone-500 text-sm">Cargando entradas…</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-sm">
              No hay entradas en este período
              {poIdFromUrl ? ' para esta OC' : ''}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">Entrada</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="whitespace-nowrap">OC</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Precio unit.</TableHead>
                  <TableHead className="text-right">Total mat.</TableHead>
                  <TableHead className="whitespace-nowrap">Estado precio</TableHead>
                  <TableHead className="whitespace-nowrap">Remisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const poRef = e.po || e.fleet_po
                  const poLabel = poRef?.po_number || (e.po_id || e.fleet_po_id)?.slice(0, 8) || '—'
                  const poLinkId = e.po_id || e.fleet_po_id
                  const supplierLabel =
                    e.supplier?.name ||
                    (e.supplier?.provider_number ? `#${e.supplier.provider_number}` : null) ||
                    '—'
                  const highlight = entryIdFromUrl === e.id
                  const pricingPending = e.pricing_status !== 'reviewed'
                  return (
                    <TableRow
                      key={e.id}
                      id={`proc-entry-row-${e.id}`}
                      className={cn(
                        highlight && 'bg-sky-50 ring-2 ring-sky-400/60',
                        pricingPending &&
                          !highlight &&
                          'border-l-4 border-amber-500 bg-amber-50/35 hover:bg-amber-50/55'
                      )}
                    >
                      <TableCell className="font-mono text-xs text-stone-800">
                        {e.entry_number || e.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(`${e.entry_date}T${e.entry_time || '12:00:00'}`), 'dd MMM yyyy HH:mm', {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="font-medium text-stone-900 truncate">
                          {e.material?.material_name || e.material_id}
                        </div>
                        <div className="text-xs text-stone-500 truncate">{e.material?.category}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{poLabel}</TableCell>
                      <TableCell className="max-w-[160px] text-sm">{supplierLabel}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.quantity_received.toLocaleString('es-MX', { maximumFractionDigits: 4 })}{' '}
                        {e.material?.unit_of_measure || ''}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.unit_price != null ? mxn.format(e.unit_price) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.total_cost != null ? mxn.format(e.total_cost) : '—'}
                      </TableCell>
                      <TableCell>
                        {e.pricing_status === 'reviewed' ? (
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">Revisado</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{e.supplier_invoice || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col gap-1.5 items-end min-w-[140px]">
                          {pricingPending && (
                            <Button
                              type="button"
                              size="default"
                              className="h-10 px-4 text-sm font-semibold w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                              onClick={() => setPricingSheetEntry(e)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Revisar precio
                            </Button>
                          )}
                          {poLinkId && (
                            <Button variant="link" size="sm" className="h-auto p-0 text-sky-800" asChild>
                              <Link
                                href={buildProcurementUrl('/finanzas/procurement', {
                                  plantId: effectivePlantId,
                                  tab: 'po',
                                  poId: poLinkId,
                                })}
                              >
                                Ver OC
                              </Link>
                            </Button>
                          )}
                          <Button variant="link" size="sm" className="h-auto p-0 text-stone-600" asChild>
                            <Link
                              href={productionEntriesUrl({
                                plantId: e.plant_id,
                                poId: poLinkId || undefined,
                                entryId: e.id,
                              })}
                            >
                              <span className="inline-flex items-center gap-1">
                                <Factory className="h-3 w-3" />
                                Ficha planta
                              </span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!canReviewPricing && (
        <Card className="border-stone-200 bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription>
                {effectivePlantId
                  ? 'Filtrado por la planta indicada (enlace o selector del espacio de trabajo).'
                  : 'Todas las plantas permitidas para su rol.'}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              <DateRangePresets selectedPreset={selectedPreset} onPresetSelect={handlePresetSelect} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-full lg:w-[280px] justify-start text-left font-normal',
                      !dateRange.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'dd MMM', { locale: es })} -{' '}
                          {format(dateRange.to, 'dd MMM yyyy', { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, 'dd MMM yyyy', { locale: es })
                      )
                    ) : (
                      'Rango de fechas'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-stone-500 text-sm">Cargando entradas…</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-sm">
              No hay entradas en este período
              {poIdFromUrl ? ' para esta OC' : ''}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">Entrada</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="whitespace-nowrap">OC</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Precio unit.</TableHead>
                  <TableHead className="text-right">Total mat.</TableHead>
                  <TableHead className="whitespace-nowrap">Estado precio</TableHead>
                  <TableHead className="whitespace-nowrap">Remisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const poRef = e.po || e.fleet_po
                  const poLabel = poRef?.po_number || (e.po_id || e.fleet_po_id)?.slice(0, 8) || '—'
                  const poLinkId = e.po_id || e.fleet_po_id
                  const supplierLabel =
                    e.supplier?.name ||
                    (e.supplier?.provider_number ? `#${e.supplier.provider_number}` : null) ||
                    '—'
                  const highlight = entryIdFromUrl === e.id
                  return (
                    <TableRow
                      key={e.id}
                      id={`proc-entry-row-${e.id}`}
                      className={cn(highlight && 'bg-sky-50 ring-2 ring-sky-400/60')}
                    >
                      <TableCell className="font-mono text-xs text-stone-800">
                        {e.entry_number || e.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(`${e.entry_date}T${e.entry_time || '12:00:00'}`), 'dd MMM yyyy HH:mm', {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="font-medium text-stone-900 truncate">
                          {e.material?.material_name || e.material_id}
                        </div>
                        <div className="text-xs text-stone-500 truncate">{e.material?.category}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{poLabel}</TableCell>
                      <TableCell className="max-w-[160px] text-sm">{supplierLabel}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.quantity_received.toLocaleString('es-MX', { maximumFractionDigits: 4 })}{' '}
                        {e.material?.unit_of_measure || ''}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.unit_price != null ? mxn.format(e.unit_price) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.total_cost != null ? mxn.format(e.total_cost) : '—'}
                      </TableCell>
                      <TableCell>
                        {e.pricing_status === 'reviewed' ? (
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">Revisado</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{e.supplier_invoice || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col gap-1 items-end">
                          {poLinkId && (
                            <Button variant="link" size="sm" className="h-auto p-0 text-sky-800" asChild>
                              <Link
                                href={buildProcurementUrl('/finanzas/procurement', {
                                  plantId: effectivePlantId,
                                  tab: 'po',
                                  poId: poLinkId,
                                })}
                              >
                                Ver OC
                              </Link>
                            </Button>
                          )}
                          <Button variant="link" size="sm" className="h-auto p-0 text-stone-600" asChild>
                            <Link
                              href={productionEntriesUrl({
                                plantId: e.plant_id,
                                poId: poLinkId || undefined,
                                entryId: e.id,
                              })}
                            >
                              <span className="inline-flex items-center gap-1">
                                <Factory className="h-3 w-3" />
                                Ficha planta
                              </span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        </Card>
      )}

      {canReviewPricing && (
        <Sheet open={!!pricingSheetEntry} onOpenChange={(open) => !open && setPricingSheetEntry(null)}>
          <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
            <SheetHeader className="text-left pr-8">
              <SheetTitle>Revisión de precios</SheetTitle>
              <SheetDescription>
                Complete precios y facturas conforme a la OC. Al guardar, el estado pasa a revisado y la tabla se
                actualiza.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              {pricingSheetEntry && (
                <EntryPricingForm
                  entry={pricingSheetEntry}
                  onCancel={() => setPricingSheetEntry(null)}
                  onAfterCreatePO={() => void fetchEntries()}
                  onSuccess={() => {
                    setPricingSheetEntry(null)
                    void fetchEntries()
                    onPricingSuccess?.()
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
