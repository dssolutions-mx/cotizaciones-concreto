'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar as CalendarIcon,
  DollarSign,
  Factory,
  List,
  MoreHorizontal,
  Package,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildProcurementUrl, productionEntriesUrl } from '@/lib/procurement/navigation'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from '@/components/inventory/ui/DateRangePresets'
import { MaterialEntry } from '@/types/inventory'
import { toast } from 'sonner'
import EntryPricingReviewList from '@/components/inventory/EntryPricingReviewList'
import EntryPricingForm from '@/components/inventory/EntryPricingForm'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import EntryEvidencePanel from '@/components/inventory/EntryEvidencePanel'
import { usePlantContext } from '@/contexts/PlantContext'
import { formatReceivedQuantity } from '@/lib/inventory/entryReceivedDisplay'

function sortEntriesNewestFirst(list: MaterialEntry[]): MaterialEntry[] {
  return [...list].sort((a, b) => {
    const ka = `${a.entry_date ?? ''}T${a.entry_time ?? '00:00:00'}`
    const kb = `${b.entry_date ?? ''}T${b.entry_time ?? '00:00:00'}`
    return kb.localeCompare(ka)
  })
}

type Props = {
  workspacePlantId: string
  canReviewPricing?: boolean
  onPricingSuccess?: () => void
}

/* ─── Shared table for both canReviewPricing and !canReviewPricing ─── */
function EntriesTable({
  entries,
  canReviewPricing,
  entryIdFromUrl,
  onInspect,
  onReviewPricing,
  effectivePlantId,
  mxn,
}: {
  entries: MaterialEntry[]
  canReviewPricing: boolean
  entryIdFromUrl?: string
  onInspect: (e: MaterialEntry) => void
  onReviewPricing: (e: MaterialEntry) => void
  effectivePlantId?: string
  mxn: Intl.NumberFormat
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="whitespace-nowrap">Entrada</TableHead>
          <TableHead className="whitespace-nowrap">Fecha</TableHead>
          <TableHead>Material</TableHead>
          <TableHead>OC / Proveedor</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead className="whitespace-nowrap">Estado</TableHead>
          <TableHead className="text-right w-[120px]" />
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
                canReviewPricing && pricingPending && !highlight &&
                  'border-l-4 border-amber-500 bg-amber-50/35 hover:bg-amber-50/55'
              )}
            >
              <TableCell className="font-mono text-xs text-stone-800">
                {e.entry_number || e.id.slice(0, 8)}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {format(new Date(`${e.entry_date}T${e.entry_time || '12:00:00'}`), 'dd MMM', {
                  locale: es,
                })}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <div className="font-medium text-stone-900 truncate text-sm">
                  {e.material?.material_name || e.material_id}
                </div>
                <div className="text-xs text-stone-500 truncate">{e.material?.category}</div>
              </TableCell>
              <TableCell className="max-w-[180px]">
                <div className="font-mono text-xs text-stone-800">{poLabel}</div>
                <div className="text-xs text-stone-500 truncate">{supplierLabel}</div>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatReceivedQuantity(e)}
              </TableCell>
              <TableCell className="text-right">
                <div className="text-sm tabular-nums">
                  {e.unit_price != null ? mxn.format(e.unit_price) : '—'}
                </div>
                {e.total_cost != null && (
                  <div className="text-xs text-stone-500 tabular-nums">
                    {mxn.format(e.total_cost)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {e.pricing_status === 'reviewed' ? (
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[11px]">Revisado</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900 text-[11px]">Pendiente</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {canReviewPricing && pricingPending && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => onReviewPricing(e)}
                    >
                      Revisar
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onInspect(e)}>
                        <Search className="h-3.5 w-3.5 mr-2" />
                        Inspeccionar
                      </DropdownMenuItem>
                      {poLinkId && (
                        <DropdownMenuItem asChild>
                          <Link
                            href={buildProcurementUrl('/finanzas/procurement', {
                              plantId: effectivePlantId,
                              tab: 'po',
                              poId: poLinkId,
                            })}
                          >
                            <Package className="h-3.5 w-3.5 mr-2" />
                            Ver OC
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link
                          href={productionEntriesUrl({
                            plantId: e.plant_id,
                            poId: poLinkId || undefined,
                            entryId: e.id,
                          })}
                        >
                          <Factory className="h-3.5 w-3.5 mr-2" />
                          Ficha planta
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/* ─── Main component ─── */
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

  const defaultRange = { from: subDays(new Date(), 6), to: new Date() }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pricingSheetEntry, setPricingSheetEntry] = useState<MaterialEntry | null>(null)
  const [inspectionEntry, setInspectionEntry] = useState<MaterialEntry | null>(null)
  const autoPreciosAppliedRef = useRef(false)
  const inspectionAutoOpenedForEntryRef = useRef<string | null>(null)
  const { availablePlants } = usePlantContext()

  // ── Pending entries (queue) ──
  const [pendingEntries, setPendingEntries] = useState<MaterialEntry[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [selectedQueueEntryId, setSelectedQueueEntryId] = useState<string | null>(null)

  const selectedQueueEntry = useMemo(
    () => pendingEntries.find((e) => e.id === selectedQueueEntryId) || null,
    [pendingEntries, selectedQueueEntryId]
  )

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

  // ── Fetch entries for history table ──
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
      params.set('include', 'document_counts')

      const res = await fetch(`/api/inventory/entries?${params.toString()}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al cargar entradas')
      }
      const data = await res.json()
      let list: MaterialEntry[] = data.entries || []

      if (entryIdFromUrl && !list.some((e) => e.id === entryIdFromUrl)) {
        const r2 = await fetch(
          `/api/inventory/entries?entry_id=${encodeURIComponent(entryIdFromUrl)}&include=document_counts`
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

  // ── Fetch pending entries for pricing queue ──
  const fetchPendingEntries = useCallback(async () => {
    setPendingLoading(true)
    try {
      const from = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      const to = format(new Date(), 'yyyy-MM-dd')
      const params = new URLSearchParams({
        date_from: from,
        date_to: to,
        pricing_status: 'pending',
        limit: '100',
        include: 'document_counts',
      })
      if (effectivePlantId) params.set('plant_id', effectivePlantId)
      const res = await fetch(`/api/inventory/entries?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPendingEntries(data.entries || [])
      }
    } catch (error) {
      console.error('Error fetching pending entries:', error)
      toast.error('Error al cargar entradas pendientes')
    } finally {
      setPendingLoading(false)
    }
  }, [effectivePlantId])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    if (canReviewPricing) void fetchPendingEntries()
  }, [canReviewPricing, fetchPendingEntries])

  // Auto-select first pending entry
  useEffect(() => {
    if (pendingLoading || pendingEntries.length === 0) return
    if (selectedQueueEntryId && pendingEntries.some((e) => e.id === selectedQueueEntryId)) return
    setSelectedQueueEntryId(pendingEntries[0].id)
  }, [pendingLoading, pendingEntries, selectedQueueEntryId])

  // Auto-switch to pricing queue when pending entries exist
  useEffect(() => {
    if (!canReviewPricing || pendingLoading) return
    if (searchParams.has('entradas_view')) return
    if (poIdFromUrl || entryIdFromUrl) return
    if (autoPreciosAppliedRef.current) return
    if (pendingEntries.length > 0) {
      autoPreciosAppliedRef.current = true
      replaceQuery({ entradas_view: 'precios' })
    }
  }, [canReviewPricing, pendingLoading, pendingEntries, searchParams, replaceQuery, poIdFromUrl, entryIdFromUrl])

  useEffect(() => {
    if (entradasView === 'precios' && !canReviewPricing) {
      replaceQuery({ entradas_view: null })
    }
  }, [entradasView, canReviewPricing, replaceQuery])

  // Deep-link: scroll to entry + auto-open inspection
  useEffect(() => {
    if (loading || !entryIdFromUrl) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(`proc-entry-row-${entryIdFromUrl}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [loading, entryIdFromUrl, entries])

  useEffect(() => {
    if (!entryIdFromUrl) inspectionAutoOpenedForEntryRef.current = null
  }, [entryIdFromUrl])

  useEffect(() => {
    if (loading || !entryIdFromUrl) return
    if (inspectionAutoOpenedForEntryRef.current === entryIdFromUrl) return
    const row = entries.find((x) => x.id === entryIdFromUrl)
    if (row) {
      setInspectionEntry(row)
      inspectionAutoOpenedForEntryRef.current = entryIdFromUrl
    }
  }, [loading, entryIdFromUrl, entries])

  useEffect(() => {
    if (!inspectionEntry) return
    const updated = entries.find((x) => x.id === inspectionEntry.id)
    if (updated) setInspectionEntry(updated)
  }, [entries, inspectionEntry?.id])

  // ── Auto-advance after pricing success ──
  const handleQueuePricingSuccess = useCallback(() => {
    const currentIdx = pendingEntries.findIndex((e) => e.id === selectedQueueEntryId)
    const remaining = pendingEntries.length - 1
    const nextEntry = pendingEntries[currentIdx + 1] || pendingEntries[currentIdx - 1] || null

    toast.success(`Revisada. ${remaining} pendiente${remaining !== 1 ? 's' : ''}.`)

    void fetchPendingEntries()
    void fetchEntries()
    onPricingSuccess?.()

    if (nextEntry) {
      setSelectedQueueEntryId(nextEntry.id)
    } else {
      setSelectedQueueEntryId(null)
    }
  }, [selectedQueueEntryId, pendingEntries, fetchPendingEntries, fetchEntries, onPricingSuccess])

  const handlePresetSelect = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setSelectedPreset(preset)
    setDateRange(range)
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    const normalised = { from: range?.from, to: range?.to }
    setDateRange(normalised)
    if (normalised.from && normalised.to) {
      const presets: DateRangePreset[] = ['today', 'yesterday', 'last7days', 'last30days', 'thisWeek', 'thisMonth']
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

  const mxn = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
    []
  )

  return (
    <div className="h-full flex flex-col">
      {/* ─── Compact header: title + sub-tabs ─── */}
      {canReviewPricing ? (
        <Tabs value={entradasView} onValueChange={(v) => setEntradasView(v as 'list' | 'precios')} className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white rounded-t-lg border border-stone-200">
            <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
              <Package className="h-4.5 w-4.5 text-amber-700" />
              Recepciones de material
            </h2>
            <TabsList className="h-auto bg-stone-200/60 p-0.5 rounded-lg">
              <TabsTrigger
                value="precios"
                className="gap-1.5 text-xs data-[state=active]:bg-stone-900 data-[state=active]:text-white px-3 py-1.5"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Cola de precios
                {pendingEntries.length > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] bg-amber-100 text-amber-900 text-[10px] px-1.5 border-0">
                    {pendingEntries.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="gap-1.5 text-xs data-[state=active]:bg-stone-900 data-[state=active]:text-white px-3 py-1.5"
              >
                <List className="h-3.5 w-3.5" />
                Historial
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Pricing Queue: Master-Detail ─── */}
          <TabsContent value="precios" className="mt-0 flex-1 min-h-0 flex flex-col">
            {/* Desktop: side-by-side */}
            <div className="hidden md:flex border border-t-0 border-stone-200 bg-white rounded-b-lg flex-1 min-h-0">
              {/* Left: compact queue */}
              <div className="w-[360px] shrink-0 border-r border-stone-200 overflow-y-auto bg-stone-50/40">
                <EntryPricingReviewList
                  entries={pendingEntries}
                  selectedId={selectedQueueEntryId}
                  onSelect={setSelectedQueueEntryId}
                  loading={pendingLoading}
                />
              </div>
              {/* Right: pricing form */}
              <div className="flex-1 overflow-y-auto relative">
                {selectedQueueEntry ? (
                  <EntryPricingForm
                    key={selectedQueueEntry.id}
                    entry={selectedQueueEntry}
                    embedded
                    onSuccess={handleQueuePricingSuccess}
                    onCancel={() => setSelectedQueueEntryId(null)}
                    onAfterCreatePO={() => void fetchPendingEntries()}
                  />
                ) : pendingEntries.length === 0 && !pendingLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="rounded-full bg-emerald-100 p-4 mb-4">
                      <Package className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-800">Cola despejada</h3>
                    <p className="text-sm text-stone-500 mt-1">
                      Todas las entradas han sido revisadas
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-stone-400 text-sm">
                    Seleccione una entrada de la cola
                  </div>
                )}
              </div>
            </div>
            {/* Mobile: full-width queue, tap opens Sheet */}
            <div className="md:hidden border border-t-0 border-stone-200 bg-white rounded-b-lg">
              <EntryPricingReviewList
                entries={pendingEntries}
                selectedId={null}
                onSelect={(id) => {
                  const e = pendingEntries.find((x) => x.id === id)
                  if (e) setPricingSheetEntry(e)
                }}
                loading={pendingLoading}
              />
            </div>
          </TabsContent>

          {/* ─── History Table ─── */}
          <TabsContent value="list" className="mt-0">
            <div className="border border-t-0 border-stone-200 bg-white rounded-b-lg">
              {/* Date controls toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 px-4 py-2.5 border-b border-stone-100">
                <DateRangePresets selectedPreset={selectedPreset} onPresetSelect={handlePresetSelect} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full lg:w-[260px] justify-start text-left font-normal',
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
              {/* Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="py-12 text-center text-stone-500 text-sm">Cargando entradas…</div>
                ) : entries.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-sm">
                    No hay entradas en este período{poIdFromUrl ? ' para esta OC' : ''}.
                  </div>
                ) : (
                  <EntriesTable
                    entries={entries}
                    canReviewPricing={canReviewPricing}
                    entryIdFromUrl={entryIdFromUrl}
                    onInspect={setInspectionEntry}
                    onReviewPricing={setPricingSheetEntry}
                    effectivePlantId={effectivePlantId}
                    mxn={mxn}
                  />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        /* ─── Non-admin: table only ─── */
        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
              <Package className="h-4.5 w-4.5 text-amber-700" />
              Recepciones de material
            </h2>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 px-4 py-2.5 border-b border-stone-100">
            <DateRangePresets selectedPreset={selectedPreset} onPresetSelect={handlePresetSelect} />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full lg:w-[260px] justify-start text-left font-normal',
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
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-stone-500 text-sm">Cargando entradas…</div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-sm">
                No hay entradas en este período{poIdFromUrl ? ' para esta OC' : ''}.
              </div>
            ) : (
              <EntriesTable
                entries={entries}
                canReviewPricing={false}
                entryIdFromUrl={entryIdFromUrl}
                onInspect={setInspectionEntry}
                onReviewPricing={() => {}}
                effectivePlantId={effectivePlantId}
                mxn={mxn}
              />
            )}
          </div>
        </div>
      )}

      {/* ─── Pricing Sheet (for history table + mobile queue) ─── */}
      {canReviewPricing && (
        <Sheet open={!!pricingSheetEntry} onOpenChange={(open) => !open && setPricingSheetEntry(null)}>
          <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
            <SheetHeader className="text-left pr-8">
              <SheetTitle>Revisión de precios</SheetTitle>
              <SheetDescription>
                Complete precios y facturas conforme a la OC. Al guardar, el estado pasa a revisado.
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
                    void fetchPendingEntries()
                    onPricingSuccess?.()
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ─── Inspection Sheet ─── */}
      <Sheet open={!!inspectionEntry} onOpenChange={(open) => !open && setInspectionEntry(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
          <SheetHeader className="text-left pr-8">
            <SheetTitle>Inspección de recepción</SheetTitle>
            <SheetDescription>
              Revise remisión, cantidades y evidencia adjunta.
            </SheetDescription>
          </SheetHeader>
          {inspectionEntry && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-stone-200 bg-stone-50/90 p-4 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-stone-600">Entrada</span>
                  <span className="font-mono font-semibold text-stone-900">
                    {inspectionEntry.entry_number || inspectionEntry.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-stone-600">Material</span>
                  <span className="font-medium text-right">
                    {inspectionEntry.material?.material_name || inspectionEntry.material_id}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-stone-600">Remisión / factura</span>
                  <span className="font-mono text-xs">{inspectionEntry.supplier_invoice || '—'}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-stone-600">Estado precio</span>
                  {inspectionEntry.pricing_status === 'reviewed' ? (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">Revisado</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900">Pendiente</Badge>
                  )}
                </div>
              </div>

              <EntryEvidencePanel
                key={inspectionEntry.id}
                entryId={inspectionEntry.id}
                pricingStatus={inspectionEntry.pricing_status}
                warnWhenPendingAndEmpty
              />

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {canReviewPricing && inspectionEntry.pricing_status !== 'reviewed' && (
                  <Button
                    type="button"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      const e = inspectionEntry
                      setInspectionEntry(null)
                      setPricingSheetEntry(e)
                    }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Revisar precio
                  </Button>
                )}
                <Button variant="outline" className="border-stone-300" asChild>
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
