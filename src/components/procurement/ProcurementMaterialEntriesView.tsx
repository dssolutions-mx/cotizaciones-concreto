'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Calendar as CalendarIcon, ExternalLink, Factory, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildProcurementUrl, productionEntriesUrl } from '@/lib/procurement/navigation'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from '@/components/inventory/ui/DateRangePresets'
import { MaterialEntry } from '@/types/inventory'
import { toast } from 'sonner'

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
}

export default function ProcurementMaterialEntriesView({ workspacePlantId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const poIdFromUrl = searchParams.get('po_id') || undefined
  const entryIdFromUrl = searchParams.get('entry_id') || undefined
  const plantIdFromUrl = searchParams.get('plant_id') || undefined

  const effectivePlantId = plantIdFromUrl || workspacePlantId || undefined

  const defaultRange = {
    from: subDays(new Date(), 6),
    to: new Date(),
  }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [loading, setLoading] = useState(true)

  const replaceQuery = useCallback(
    (next: { po_id?: string | null; entry_id?: string | null; plant_id?: string | null }) => {
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
      router.replace(`?${p.toString()}`, { scroll: false })
    },
    [router, searchParams]
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
          </p>
        </div>
      </div>

      {(poIdFromUrl || entryIdFromUrl) && (
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
                  <TableHead className="text-right whitespace-nowrap">Precio / kg</TableHead>
                  <TableHead className="text-right">Total mat.</TableHead>
                  <TableHead className="whitespace-nowrap">Precio</TableHead>
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
    </div>
  )
}
