'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Search, FileSpreadsheet, Factory, Package, ExternalLink, Truck, Info, Calendar as CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from '@/components/inventory/ui/DateRangePresets'
import { buildProcurementUrl, procurementEntriesUrl, productionEntriesUrl } from '@/lib/procurement/navigation'
import type { MaterialEntry } from '@/types/inventory'
import { formatReceivedQuantity, formatReceptionAssignedDay } from '@/lib/inventory/entryReceivedDisplay'
import EntryEvidencePanel from '@/components/inventory/EntryEvidencePanel'
import { downloadFleetFreightReconciliationXlsx } from '@/lib/procurement/fleetFreightExcelExport'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { canCompleteEntryPricingReview } from '@/lib/auth/inventoryRoles'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

type FleetReconciliationResponse = {
  success: boolean
  entries: MaterialEntry[]
  summary?: {
    entry_count: number
    total_fleet_cost: number
    entries_with_fleet_invoice: number
    fleet_qty_by_uom: Record<string, number>
    summary_truncated?: boolean
  }
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
}

type CarrierRow = {
  supplier_id: string
  name: string
  entry_count: number
  total_fleet_cost: number
  entries_with_fleet_invoice: number
}

type FleetPoEmb = { po_number?: string | null; supplier?: { name?: string | null } | null } | null

function fleetItem(e: MaterialEntry) {
  return (e as MaterialEntry & { fleet_po_item?: { uom?: string | null; qty_ordered?: number; qty_received?: number } })
    .fleet_po_item
}

function fleetPoEmb(e: MaterialEntry): FleetPoEmb {
  return (e as MaterialEntry & { fleet_po?: FleetPoEmb }).fleet_po as FleetPoEmb
}

const PAGE_SIZE = 100

type Props = {
  workspacePlantId: string
}

export default function FleetFreightReconciliation({ workspacePlantId }: Props) {
  const { profile } = useAuthSelectors()
  const canReviewPricing = canCompleteEntryPricingReview(profile?.role)
  const defaultRange = { from: subDays(new Date(), 6), to: new Date() }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [carriersLoading, setCarriersLoading] = useState(true)
  const [carrierId, setCarrierId] = useState<string>('')
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [summary, setSummary] = useState<FleetReconciliationResponse['summary'] | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [pagination, setPagination] = useState({ total: 0, hasMore: false, limit: PAGE_SIZE })
  const nextOffsetRef = useRef(0)
  const [inspectionEntry, setInspectionEntry] = useState<MaterialEntry | null>(null)
  const [exporting, setExporting] = useState(false)

  const dateFrom = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''
  const dateTo = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''

  const selectedCarrierName = useMemo(
    () => carriers.find((c) => c.supplier_id === carrierId)?.name || '',
    [carriers, carrierId]
  )

  const loadCarriers = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setCarriersLoading(true)
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      const res = await fetch(`/api/procurement/fleet-carriers?${params}`)
      if (!res.ok) throw new Error('No se pudo cargar transportistas')
      const j = await res.json()
      setCarriers(j.carriers || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar transportistas')
      setCarriers([])
    } finally {
      setCarriersLoading(false)
    }
  }, [dateFrom, dateTo, workspacePlantId])

  useEffect(() => {
    void loadCarriers()
  }, [loadCarriers])

  const loadEntries = useCallback(
    async (append: boolean) => {
      if (!carrierId || !dateFrom || !dateTo) return
      const start = append ? nextOffsetRef.current : 0
      if (!append) nextOffsetRef.current = 0
      setListLoading(true)
      try {
        const params = new URLSearchParams({
          carrier_supplier_id: carrierId,
          date_from: dateFrom,
          date_to: dateTo,
          limit: String(PAGE_SIZE),
          offset: String(start),
        })
        if (workspacePlantId) params.set('plant_id', workspacePlantId)
        const res = await fetch(`/api/procurement/fleet-reconciliation?${params}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Error al cargar entradas')
        }
        const j: FleetReconciliationResponse = await res.json()
        const batch = j.entries || []
        setSummary(j.summary || null)
        setPagination({
          total: j.pagination?.total ?? 0,
          hasMore: Boolean(j.pagination?.hasMore),
          limit: j.pagination?.limit ?? PAGE_SIZE,
        })
        if (append) {
          setEntries((prev) => [...prev, ...batch])
          nextOffsetRef.current = start + batch.length
        } else {
          setEntries(batch)
          nextOffsetRef.current = batch.length
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al cargar')
        if (!append) {
          setEntries([])
          setSummary(null)
        }
      } finally {
        setListLoading(false)
      }
    },
    [carrierId, dateFrom, dateTo, workspacePlantId]
  )

  useEffect(() => {
    if (!carrierId) {
      setEntries([])
      setSummary(null)
      nextOffsetRef.current = 0
      return
    }
    void loadEntries(false)
  }, [carrierId, dateFrom, dateTo, workspacePlantId, loadEntries])

  const handlePresetSelect = (p: DateRangePreset, range: { from: Date; to: Date }) => {
    setSelectedPreset(p)
    setDateRange({ from: range.from, to: range.to })
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    const normalised = { from: range?.from, to: range?.to }
    setDateRange(normalised)
    if (normalised.from && normalised.to) {
      const presets: DateRangePreset[] = [
        'today',
        'yesterday',
        'last7days',
        'last30days',
        'thisWeek',
        'thisMonth',
      ]
      for (const preset of presets) {
        const pr = getDateRangeForPreset(preset)
        if (
          format(normalised.from, 'yyyy-MM-dd') === format(pr.from, 'yyyy-MM-dd') &&
          format(normalised.to, 'yyyy-MM-dd') === format(pr.to, 'yyyy-MM-dd')
        ) {
          setSelectedPreset(preset)
          return
        }
      }
      setSelectedPreset('custom')
    }
  }

  const loadMore = () => {
    if (pagination.hasMore && !listLoading) void loadEntries(true)
  }

  const handleExportXlsx = async () => {
    if (!carrierId || !dateFrom || !dateTo) return
    setExporting(true)
    try {
      const all: MaterialEntry[] = []
      let off = 0
      let hasMore = true
      while (hasMore) {
        const params = new URLSearchParams({
          carrier_supplier_id: carrierId,
          date_from: dateFrom,
          date_to: dateTo,
          limit: '200',
          offset: String(off),
        })
        if (workspacePlantId) params.set('plant_id', workspacePlantId)
        const res = await fetch(`/api/procurement/fleet-reconciliation?${params}`)
        if (!res.ok) throw new Error('Error al exportar')
        const j: FleetReconciliationResponse = await res.json()
        all.push(...(j.entries || []))
        hasMore = Boolean(j.pagination?.hasMore)
        off += j.entries?.length || 0
        if (off > 20_000) {
          toast.message('Export limitado: demasiadas filas')
          break
        }
      }
      if (all.length === 0) {
        toast.message('No hay filas que exportar')
        return
      }
      downloadFleetFreightReconciliationXlsx(all, {
        transportistaSeleccionado: selectedCarrierName || carrierId,
        dateFrom,
        dateTo,
      })
      toast.success('Excel generado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const mxn = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
    []
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
          <Truck className="h-5 w-5 text-amber-800" aria-hidden />
          Fletes y conciliación
        </h2>
        <p className="text-sm text-stone-600 mt-1 max-w-3xl">
          Compare entradas de material y órdenes de compra de flota con las facturas del transportista. Se incluyen
          entradas con proveedor de flete explícito o vinculadas a una OC de flota a nombre del transportista.
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#f5f3f0]/95 backdrop-blur border border-stone-200/80 rounded-lg space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="sm:col-span-2">
            <Label className="text-xs text-stone-600">Período</Label>
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
              <DateRangePresets
                selectedPreset={selectedPreset}
                onPresetSelect={handlePresetSelect}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-left font-normal border-stone-300 bg-white"
                    type="button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to
                      ? `${format(dateRange.from, 'dd MMM', { locale: es })} – ${format(
                          dateRange.to,
                          'dd MMM yyyy',
                          { locale: es }
                        )}`
                      : 'Rango personalizado'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
            <p className="text-[11px] text-stone-500 mt-1.5 max-w-md">
              Planta: use el selector del encabezado del módulo (Todas / una planta). Actualmente:{' '}
              <span className="font-medium text-stone-700">
                {workspacePlantId ? 'planta acotada' : 'multiplanta'}
              </span>
              .
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-stone-600">Transportista</Label>
            <Select
              value={carrierId || 'none'}
              onValueChange={(v) => setCarrierId(v === 'none' ? '' : v)}
              disabled={carriersLoading}
            >
              <SelectTrigger className="mt-1 border-stone-300 bg-white" aria-label="Transportista">
                <SelectValue placeholder={carriersLoading ? 'Cargando…' : 'Elija un transportista'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Seleccione —</SelectItem>
                {carriers.map((c) => (
                  <SelectItem key={c.supplier_id} value={c.supplier_id}>
                    {c.name}{' '}
                    <span className="text-stone-500 text-xs">
                      ({c.entry_count} entradas · {mxn.format(c.total_fleet_cost)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {carriers.length === 0 && !carriersLoading && dateFrom && dateTo && (
              <p className="text-xs text-amber-800 mt-1">No hay movimientos de flete en el período.</p>
            )}
          </div>
        </div>
      </div>

      {carrierId && summary && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Entradas (período)"
            value={String(summary.entry_count)}
            sub={summary.summary_truncated ? 'Conteos pueden truncar en rangos masivos' : undefined}
          />
          <Kpi
            label="Costo flete (suma)"
            value={mxn.format(summary.total_fleet_cost || 0)}
            sub="En filas con costo capturado"
          />
          <Kpi
            label="Con factura de flota"
            value={`${summary.entries_with_fleet_invoice} / ${summary.entry_count}`}
            sub="Folio en entrada"
          />
          <Kpi
            label="Servicio (sumas parciales)"
            value={Object.entries(summary.fleet_qty_by_uom || {})
              .map(([u, n]) => `${n.toFixed(2)} ${u}`)
              .join(' · ') || '—'}
            sub="Por UoM registrada en entrada"
          />
        </div>
      )}

      {!carrierId && !carriersLoading && (
        <Card className="border-dashed border-stone-300 bg-[#faf9f7]">
          <CardContent className="py-10 text-center text-sm text-stone-600">
            <Info className="h-8 w-8 text-stone-400 mx-auto mb-2" />
            <p className="font-medium text-stone-800">Seleccione un transportista</p>
            <p className="mt-1 max-w-md mx-auto">
              La lista solo muestra transportistas con entradas u OC de flota en el rango de fechas.
            </p>
          </CardContent>
        </Card>
      )}

      {carrierId && (
        <Card className="border-stone-200">
          <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Detalle de entradas</CardTitle>
              <CardDescription>
                {selectedCarrierName} — {dateFrom} a {dateTo}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-amber-800 hover:bg-amber-900 text-white"
              disabled={listLoading || exporting || entries.length === 0}
              onClick={() => void handleExportXlsx()}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              {exporting ? 'Exportando…' : 'Excel (todas las páginas)'}
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {listLoading && entries.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-stone-500 py-6 text-center">Sin entradas para este transportista en el período.</p>
            ) : (
              <>
                <div className="overflow-x-auto -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Entrada</TableHead>
                        <TableHead>Recepción</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>OC mat. / prov.</TableHead>
                        <TableHead>OC flota / línea</TableHead>
                        <TableHead className="text-right">Cant. material</TableHead>
                        <TableHead className="text-right">Serv. flota</TableHead>
                        <TableHead className="text-right">Costo flete</TableHead>
                        <TableHead>Fact. flete</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => {
                        const fpo = fleetPoEmb(e)
                        const fpi = fleetItem(e)
                        const lineUnit = fpi?.uom || e.fleet_uom
                        return (
                          <TableRow key={e.id} className="text-sm">
                            <TableCell className="font-mono text-xs">
                              {e.entry_number || e.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatReceptionAssignedDay(e)}
                            </TableCell>
                            <TableCell className="max-w-[160px]">
                              <div className="font-medium truncate">{e.material?.material_name}</div>
                              <div className="text-stone-500 text-xs truncate">{e.plant?.name}</div>
                            </TableCell>
                            <TableCell className="max-w-[120px] text-xs">
                              <div className="font-mono">{e.po?.po_number || '—'}</div>
                              <div className="text-stone-500 truncate">{e.supplier?.name || '—'}</div>
                            </TableCell>
                            <TableCell className="max-w-[150px] text-xs">
                              <div className="font-mono">{e.fleet_po?.po_number || '—'}</div>
                              <div className="text-stone-500 truncate" title="Proveedor en encabezado OC flota">
                                {fpo?.supplier?.name || '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {formatReceivedQuantity(e)}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {e.fleet_qty_entered != null ? e.fleet_qty_entered : '—'}
                              {lineUnit && (
                                <span className="text-stone-500 ml-0.5">{lineUnit}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {e.fleet_cost != null ? mxn.format(e.fleet_cost) : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[100px] truncate">
                              {e.fleet_invoice || '—'}
                            </TableCell>
                            <TableCell>
                              {e.pricing_status === 'reviewed' ? (
                                <Badge className="bg-emerald-100 text-emerald-900 text-[10px]">Revisado</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 items-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setInspectionEntry(e)}
                                >
                                  <Search className="h-3.5 w-3.5 mr-1" />
                                  Evidencia
                                </Button>
                                {(e.po_id || e.fleet_po_id) && (
                                  <Link
                                    className="text-xs text-sky-800 hover:underline inline-flex items-center gap-0.5"
                                    href={buildProcurementUrl('/finanzas/procurement', {
                                      plantId: workspacePlantId || undefined,
                                      tab: 'po',
                                      poId: (e.fleet_po_id || e.po_id) as string,
                                    })}
                                  >
                                    <Package className="h-3 w-3" />
                                    OC
                                  </Link>
                                )}
                                <Link
                                  className="text-xs text-stone-600 hover:underline inline-flex items-center gap-0.5"
                                  href={procurementEntriesUrl({
                                    plantId: e.plant_id,
                                    poId: e.po_id || e.fleet_po_id || undefined,
                                    entryId: e.id,
                                  })}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Compras
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {pagination.hasMore && (
                  <div className="pt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={listLoading}
                      onClick={loadMore}
                    >
                      {listLoading ? 'Cargando…' : 'Cargar más'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {summary?.summary_truncated && (
        <Alert>
          <AlertTitle>Resumen de KPIs</AlertTitle>
          <AlertDescription>
            Hay más de 10.000 entradas coincidentes; las tarjetas resumen se calculan con un muestreo. Use fechas o
            planta más acotada si necesita exactitud.
          </AlertDescription>
        </Alert>
      )}

      <Sheet open={!!inspectionEntry} onOpenChange={(open) => !open && setInspectionEntry(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Inspección de recepción</SheetTitle>
            <SheetDescription>Remisión, documentos y cantidades ancladas a esta entrada.</SheetDescription>
          </SheetHeader>
          {inspectionEntry && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-3 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-stone-600">Entrada</span>
                  <span className="font-mono font-medium">{inspectionEntry.entry_number}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-600">OC flota</span>
                  <span className="font-mono text-xs">{inspectionEntry.fleet_po?.po_number || '—'}</span>
                </div>
              </div>
              <EntryEvidencePanel
                key={inspectionEntry.id}
                entryId={inspectionEntry.id}
                pricingStatus={inspectionEntry.pricing_status}
                warnWhenPendingAndEmpty
              />
              <div className="flex flex-col gap-2">
                {canReviewPricing && (
                  <Button className="bg-amber-600 hover:bg-amber-700" asChild>
                    <Link
                      href={procurementEntriesUrl({
                        plantId: inspectionEntry.plant_id,
                        poId: inspectionEntry.po_id || inspectionEntry.fleet_po_id || undefined,
                        entryId: inspectionEntry.id,
                        entradasPrecios: true,
                      })}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir en revisión de precios
                    </Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link
                    href={productionEntriesUrl({
                      plantId: inspectionEntry.plant_id,
                      poId: inspectionEntry.po_id || inspectionEntry.fleet_po_id || undefined,
                      entryId: inspectionEntry.id,
                    })}
                  >
                    <Factory className="h-4 w-4 mr-2" />
                    Ficha en planta
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-lg font-semibold text-stone-900 tabular-nums mt-0.5 break-words">{value}</p>
      {sub && <p className="text-[10px] text-stone-500 mt-1">{sub}</p>}
    </div>
  )
}
