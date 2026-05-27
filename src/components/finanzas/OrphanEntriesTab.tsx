'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronRight, AlertTriangle, FileText, Package, Truck, X, Calendar } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import CreateSupplierInvoiceDrawer, { type OrphanEntry } from './CreateSupplierInvoiceDrawer'
import BulkCfdiInvoiceDialog from './BulkCfdiInvoiceDialog'
import { cn } from '@/lib/utils'
import { fetchAllOrphanEntries } from '@/lib/ap/fetchOrphanEntries'
import { formatOrphanEntryRemisionLabel, orphanEntryRemisionTitle } from '@/lib/ap/orphanEntryRemisionNumbers'

function OrphanEntryRemisionInline({ numbers }: { numbers?: string[] }) {
  const label = formatOrphanEntryRemisionLabel(numbers)
  if (!label) return null
  return (
    <span
      className="text-stone-500 font-mono shrink-0"
      title={orphanEntryRemisionTitle(numbers) ?? undefined}
    >
      Rem. {label}
    </span>
  )
}

function supplierGroupDisplayName(
  supplier: OrphanEntry['supplier'] | OrphanEntry['fleet_supplier'],
  fallback = 'Sin proveedor',
): string {
  return supplier?.supplier_group?.name ?? supplier?.name ?? fallback
}

function OrphanLoadProgress({ loaded, total }: { loaded: number; total: number }) {
  if (total <= 0) return null
  const pct = Math.min(100, Math.round((loaded / total) * 100))
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 space-y-1.5">
      <div className="flex justify-between text-xs text-stone-600">
        <span>Cargando recepciones sin factura…</span>
        <span className="tabular-nums font-medium">
          {loaded.toLocaleString('es-MX')} / {total.toLocaleString('es-MX')}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
        <div className="h-full bg-sky-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function OrphanReceptionDateFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onClear: () => void
}) {
  const active = Boolean(dateFrom || dateTo)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2">
      <Calendar className="h-3.5 w-3.5 text-stone-500 shrink-0" />
      <span className="text-xs font-medium text-stone-600 whitespace-nowrap">Recepción</span>
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="h-8 w-[142px] text-xs bg-white border-stone-300"
        aria-label="Fecha de recepción desde"
      />
      <span className="text-xs text-stone-400">a</span>
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="h-8 w-[142px] text-xs bg-white border-stone-300"
        aria-label="Fecha de recepción hasta"
      />
      {active && (
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs gap-1 text-stone-500" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          Quitar fechas
        </Button>
      )}
    </div>
  )
}

interface Props {
  workspacePlantId?: string
  hidePlantFilter?: boolean
}

// ── Fleet-pending sub-tab ─────────────────────────────────────────────────────
function FleetPendingSection({
  workspacePlantId = '',
  hidePlantFilter = false,
  reloadKey,
  onReload,
  dateFrom = '',
  dateTo = '',
}: {
  workspacePlantId?: string
  hidePlantFilter?: boolean
  reloadKey: number
  onReload: () => void
  dateFrom?: string
  dateTo?: string
}) {
  const { availablePlants } = usePlantContext()
  const [localPlantFilter, setLocalPlantFilter] = useState('')
  const plantFilter = hidePlantFilter ? workspacePlantId : (localPlantFilter || workspacePlantId)
  const [entries, setEntries] = useState<OrphanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [orphanFleetDrawerOpen, setOrphanFleetDrawerOpen] = useState(false)
  const [drawerEntries, setDrawerEntries] = useState<OrphanEntry[]>([])
  const [materialSupplierFilter, setMaterialSupplierFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const materialSupplierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const id = e.supplier?.group_id ?? e.supplier?.id ?? e.supplier_id
      if (!map.has(id)) map.set(id, supplierGroupDisplayName(e.supplier))
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [entries])

  const materialOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const id = e.material?.id ?? e.material_id
      if (!map.has(id)) map.set(id, e.material?.material_name ?? id)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const groupKey = e.supplier?.group_id ?? e.supplier?.id ?? e.supplier_id
      if (materialSupplierFilter && groupKey !== materialSupplierFilter) return false
      if (materialFilter && (e.material?.id ?? e.material_id) !== materialFilter) return false
      return true
    })
  }, [entries, materialSupplierFilter, materialFilter])

  const hasActiveFilter = !!materialSupplierFilter || !!materialFilter

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadProgress(null)
      setEntries([])
      setSelected(new Set())
      try {
        const { entries: list } = await fetchAllOrphanEntries(
          {
            mode: 'fleet',
            plantId: plantFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
          {
            signal: controller.signal,
            onProgress: (loaded, total, batch) => {
              if (cancelled) return
              setLoadProgress({ loaded, total })
              setEntries(batch)
            },
          },
        )
        if (cancelled) return
        setEntries(list)
        const keys = new Set<string>(list.map(e => e.fleet_supplier?.group_id ?? e.fleet_supplier_id ?? '__sin_proveedor__'))
        setExpandedSuppliers(keys)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        if (!cancelled) setEntries([])
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadProgress(null)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [plantFilter, reloadKey, dateFrom, dateTo])

  // Group by fleet_supplier.group_id — the supplier_groups entity is cross-plant,
  // so "SAFE" in plant A and "SAFE" in plant B (same group_id) collapse into one card.
  // fleet_supplier_id is plant-scoped and would produce duplicates.
  const grouped = useMemo(() => {
    const map = new Map<string, { fleetSupplier: OrphanEntry['fleet_supplier']; groupKey: string; entries: OrphanEntry[] }>()
    for (const e of filteredEntries) {
      const key = e.fleet_supplier?.group_id ?? e.fleet_supplier_id ?? '__sin_proveedor__'
      if (!map.has(key)) map.set(key, { fleetSupplier: e.fleet_supplier, groupKey: key, entries: [] })
      map.get(key)!.entries.push(e)
    }
    return map
  }, [filteredEntries])

  const toggleEntry = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    return next
  })

  const toggleSupplier = (ids: string[]) => {
    const allSel = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSel) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const openDrawer = (ids: string[]) => {
    setDrawerEntries(entries.filter(e => ids.includes(e.id)))
    setDrawerOpen(true)
  }

  const selectedEntries = entries.filter(e => selected.has(e.id))
  const selectedFleetSuppliers = new Set(selectedEntries.map(e => e.fleet_supplier_id ?? '__sin_proveedor__'))
  // Only allow invoicing entries from the same fleet supplier at once
  const selectionValid = selectedFleetSuppliers.size <= 1 && new Set(selectedEntries.map(e => e.plant_id)).size <= 1

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {loadProgress && <OrphanLoadProgress loaded={loadProgress.loaded} total={loadProgress.total} />}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {!hidePlantFilter && (
        <Select value={plantFilter || '__all__'} onValueChange={v => setLocalPlantFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[200px] bg-white border-stone-300">
            <SelectValue placeholder="Todas las plantas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las plantas</SelectItem>
            {availablePlants.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
          onClick={() => setOrphanFleetDrawerOpen(true)}
        >
          <Truck className="h-3.5 w-3.5" />
          Flete sin entrada
        </Button>

        {materialSupplierOptions.length > 1 && (
          <Select value={materialSupplierFilter || '__all__'} onValueChange={v => setMaterialSupplierFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] bg-white border-stone-300">
              <SelectValue placeholder="Proveedores de material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Proveedores de material</SelectItem>
              {materialSupplierOptions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {materialOptions.length > 1 && (
          <Select value={materialFilter || '__all__'} onValueChange={v => setMaterialFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] bg-white border-stone-300">
              <SelectValue placeholder="Todos los materiales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los materiales</SelectItem>
              {materialOptions.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilter && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1 text-stone-500"
            onClick={() => {
              setMaterialSupplierFilter('')
              setMaterialFilter('')
            }}
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-stone-200">
            <span className="text-xs text-stone-600 font-medium">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
            {!selectionValid && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Proveedor o planta mixtos
              </span>
            )}
            <Button
              size="sm"
              className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white gap-1"
              disabled={!selectionValid}
              onClick={() => openDrawer([...selected])}
            >
              <Truck className="h-3.5 w-3.5" />
              1 factura de flete
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Limpiar
            </Button>
          </div>
        )}

        <div className="ml-auto text-xs text-stone-500">
          {entries.length === 0
            ? 'Sin fletes pendientes de facturar'
            : hasActiveFilter && filteredEntries.length !== entries.length
              ? `${filteredEntries.length} de ${entries.length} entrada${entries.length !== 1 ? 's' : ''} con flete sin facturar`
              : `${entries.length} entrada${entries.length !== 1 ? 's' : ''} con flete sin facturar`}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          <Truck className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-sm font-medium">
            {dateFrom || dateTo ? 'Sin fletes en el rango de fechas' : 'Sin fletes pendientes de facturar'}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {dateFrom || dateTo
              ? 'Prueba ampliar el rango de recepción o quitar el filtro de fechas.'
              : 'Las entradas con flete aparecen aquí una vez que su costo de material ya fue facturado.'}
          </p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          <Truck className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-sm font-medium">Sin fletes con estos filtros</p>
          <p className="text-xs text-stone-400 mt-1">
            Prueba cambiar el proveedor o material, o usa Limpiar filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([supplierId, group]) => {
            const allIds = group.entries.map(e => e.id)
            const allChecked = allIds.every(id => selected.has(id))
            const someChecked = allIds.some(id => selected.has(id))
            const expanded = expandedSuppliers.has(supplierId)
            const totalFleet = group.entries.reduce((s, e) => s + Number(e.fleet_cost ?? 0), 0)

            return (
              <div key={supplierId} className="border border-amber-200 rounded-lg overflow-hidden bg-white">
                {/* Supplier header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => setExpandedSuppliers(prev => {
                    const next = new Set(prev)
                    if (next.has(supplierId)) { next.delete(supplierId) } else { next.add(supplierId) }
                    return next
                  })}
                >
                  <div onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                      onCheckedChange={() => toggleSupplier(allIds)}
                    />
                  </div>
                  {expanded ? <ChevronDown className="h-4 w-4 text-amber-600" /> : <ChevronRight className="h-4 w-4 text-amber-600" />}
                  <Truck className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-sm text-stone-900 flex-1">
                    {supplierGroupDisplayName(group.fleetSupplier)}
                  </span>
                  <span className="text-xs text-stone-500 mr-2">{allIds.length} entrada{allIds.length !== 1 ? 's' : ''}</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-800">{mxn.format(totalFleet)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs gap-1 ml-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={e => { e.stopPropagation(); openDrawer(allIds) }}
                  >
                    <Truck className="h-3 w-3" />
                    Facturar flete
                  </Button>
                </div>

                {expanded && (
                  <div className="divide-y divide-stone-100">
                    {group.entries.map(entry => (
                      <div
                        key={entry.id}
                        className={cn(
                          'flex items-center gap-3 px-8 py-2 text-xs hover:bg-amber-50/50 transition-colors',
                          selected.has(entry.id) && 'bg-amber-50'
                        )}
                      >
                        <Checkbox
                          checked={selected.has(entry.id)}
                          onCheckedChange={() => toggleEntry(entry.id)}
                        />
                        <span className="font-mono text-stone-700">{entry.entry_number}</span>
                        <OrphanEntryRemisionInline numbers={entry.remision_numbers} />
                        <span className="text-stone-500">
                          {format(new Date(entry.entry_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                        </span>
                        <span className="text-stone-600">{entry.material?.material_name ?? entry.material_id}</span>
                        <span className="text-stone-400">{supplierGroupDisplayName(entry.supplier)}</span>
                        <span className="text-stone-400">
                          {entry.received_qty_entered != null
                            ? `${Number(entry.received_qty_entered).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${entry.received_uom ?? 'kg'}`
                            : '—'}
                        </span>
                        {entry.fleet_invoice && (
                          <span className="text-stone-400 italic">ref: {entry.fleet_invoice}</span>
                        )}
                        {entry.ap_due_date_fleet && (
                          <span className="text-amber-700 font-medium">
                            vence {format(new Date(entry.ap_due_date_fleet + 'T00:00:00'), 'dd MMM', { locale: es })}
                          </span>
                        )}
                        <span className="ml-auto tabular-nums font-semibold text-amber-800">
                          {mxn.format(Number(entry.fleet_cost ?? 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <CreateSupplierInvoiceDrawer
        open={drawerOpen}
        onOpenChange={(open) => { if (!open) setDrawerOpen(false) }}
        entries={drawerEntries}
        plantId={drawerEntries[0]?.plant_id}
        fleetOnly
        onSuccess={() => {
          setDrawerOpen(false)
          setSelected(new Set())
          onReload()
        }}
      />
      <CreateSupplierInvoiceDrawer
        open={orphanFleetDrawerOpen}
        onOpenChange={setOrphanFleetDrawerOpen}
        plantId={plantFilter || undefined}
        fleetOnly
        orphanFleetOnly
        onSuccess={() => {
          setOrphanFleetDrawerOpen(false)
          onReload()
        }}
      />
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function OrphanEntriesTab({ workspacePlantId = '', hidePlantFilter = false }: Props) {
  const { availablePlants } = usePlantContext()
  const [activeTab, setActiveTab] = useState<'material' | 'fleet'>('material')
  const [localPlantFilter, setLocalPlantFilter] = useState('')
  const plantFilter = hidePlantFilter ? workspacePlantId : (localPlantFilter || workspacePlantId)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [entries, setEntries] = useState<OrphanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerEntries, setDrawerEntries] = useState<OrphanEntry[]>([])
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkEntries, setBulkEntries] = useState<OrphanEntry[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [receptionDateFrom, setReceptionDateFrom] = useState('')
  const [receptionDateTo, setReceptionDateTo] = useState('')

  const clearReceptionDates = () => {
    setReceptionDateFrom('')
    setReceptionDateTo('')
  }

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])
  const plantMap = useMemo(() => new Map(availablePlants.map(p => [p.id, p.name])), [availablePlants])

  useEffect(() => {
    if (activeTab !== 'material') return

    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadProgress(null)
      setEntries([])
      setSelected(new Set())
      try {
        const { entries: list } = await fetchAllOrphanEntries(
          {
            mode: 'material',
            plantId: plantFilter || undefined,
            dateFrom: receptionDateFrom || undefined,
            dateTo: receptionDateTo || undefined,
          },
          {
            signal: controller.signal,
            onProgress: (loaded, total, batch) => {
              if (cancelled) return
              setLoadProgress({ loaded, total })
              setEntries(batch)
            },
          },
        )
        if (cancelled) return
        setEntries(list)
        const groupKeys = new Set<string>(
          list.map((e: OrphanEntry) => e.supplier?.group_id ?? e.supplier?.id ?? e.supplier_id),
        )
        setExpandedSuppliers(groupKeys)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        if (!cancelled) setEntries([])
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadProgress(null)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [plantFilter, reloadKey, activeTab, receptionDateFrom, receptionDateTo])

  // Derive filter options from loaded entries — key by group_id so CEMEX plant1+plant2 = one option
  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const id = e.supplier?.group_id ?? e.supplier?.id ?? e.supplier_id
      if (!map.has(id)) map.set(id, supplierGroupDisplayName(e.supplier))
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [entries])

  const materialOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const id = e.material?.id ?? e.material_id
      if (!map.has(id)) map.set(id, e.material?.material_name ?? id)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [entries])

  // Apply client-side supplier + material filters
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const groupKey = e.supplier?.group_id ?? e.supplier?.id ?? e.supplier_id
      if (supplierFilter && groupKey !== supplierFilter) return false
      if (materialFilter && (e.material?.id ?? e.material_id) !== materialFilter) return false
      return true
    })
  }, [entries, supplierFilter, materialFilter])

  // Group: supplierGroup → plant → material → entries
  // Using supplier.group_id as the top-level key collapses all plants of the same
  // supplier group into one card, eliminating duplicate rows for CEMEX/SAFE/etc.
  const grouped = useMemo(() => {
    const byGroup = new Map<string, {
      groupKey: string
      supplierName: string
      byPlant: Map<string, {
        plantId: string
        byMaterial: Map<string, { material: OrphanEntry['material']; entries: OrphanEntry[] }>
      }>
    }>()
    for (const e of filteredEntries) {
      const groupKey = e.supplier?.group_id ?? e.supplier?.id ?? e.supplier_id
      const plantId = e.plant_id
      const matId = e.material?.id ?? e.material_id
      if (!byGroup.has(groupKey)) {
        byGroup.set(groupKey, {
          groupKey,
          supplierName: supplierGroupDisplayName(e.supplier),
          byPlant: new Map(),
        })
      }
      const grp = byGroup.get(groupKey)!
      if (!grp.byPlant.has(plantId)) {
        grp.byPlant.set(plantId, { plantId, byMaterial: new Map() })
      }
      const plt = grp.byPlant.get(plantId)!
      if (!plt.byMaterial.has(matId)) {
        plt.byMaterial.set(matId, { material: e.material, entries: [] })
      }
      plt.byMaterial.get(matId)!.entries.push(e)
    }
    return byGroup
  }, [filteredEntries])

  const toggleEntry = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const openDrawerWith = (ids: string[]) => {
    const toInvoice = entries.filter(e => ids.includes(e.id))
    setDrawerEntries(toInvoice)
    setDrawerOpen(true)
  }

  const openBulkDialog = (ids: string[]) => {
    const toInvoice = entries.filter(e => ids.includes(e.id))
    if (toInvoice.length === 0) return
    setBulkEntries(toInvoice)
    setBulkDialogOpen(true)
  }

  const handleDrawerSuccess = () => {
    setDrawerOpen(false)
    setReloadKey(k => k + 1)
  }

  const handleBulkSuccess = () => {
    setBulkDialogOpen(false)
    setBulkEntries([])
    setSelected(new Set())
    setReloadKey(k => k + 1)
  }

  const selectedEntries = entries.filter(e => selected.has(e.id))
  const selectedPlants = new Set(selectedEntries.map(e => e.plant_id))
  const selectionValid = selectedPlants.size <= 1
  const hasActiveFilter = !!supplierFilter || !!materialFilter || !!receptionDateFrom || !!receptionDateTo

  return (
    <div className="space-y-4">
      <OrphanReceptionDateFilter
        dateFrom={receptionDateFrom}
        dateTo={receptionDateTo}
        onDateFromChange={setReceptionDateFrom}
        onDateToChange={setReceptionDateTo}
        onClear={clearReceptionDates}
      />

      {/* Sub-tab switcher: Material vs Fleet */}
      <div className="flex items-center gap-1 border-b border-stone-200 pb-0">
        <button
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'material'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          )}
          onClick={() => setActiveTab('material')}
        >
          <Package className="h-3.5 w-3.5" />
          Material
          {entries.length > 0 && activeTab !== 'material' && (
            <span className="ml-1 rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
              {entries.length}
            </span>
          )}
          {activeTab === 'material' && entries.length > 0 && (
            <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
              {filteredEntries.length}
            </span>
          )}
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'fleet'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          )}
          onClick={() => setActiveTab('fleet')}
        >
          <Truck className="h-3.5 w-3.5" />
          Fletes pendientes
        </button>
      </div>

      {activeTab === 'fleet' ? (
        <FleetPendingSection
          workspacePlantId={workspacePlantId}
          hidePlantFilter={hidePlantFilter}
          reloadKey={reloadKey}
          onReload={() => setReloadKey(k => k + 1)}
          dateFrom={receptionDateFrom}
          dateTo={receptionDateTo}
        />
      ) : (
      <>
      {loadProgress && <OrphanLoadProgress loaded={loadProgress.loaded} total={loadProgress.total} />}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {!hidePlantFilter && (
        <Select value={plantFilter || '__all__'} onValueChange={v => setLocalPlantFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[200px] bg-white border-stone-300">
            <SelectValue placeholder="Todas las plantas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las plantas</SelectItem>
            {availablePlants.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}

        {/* Supplier filter */}
        {supplierOptions.length > 1 && (
          <Select value={supplierFilter || '__all__'} onValueChange={v => setSupplierFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] bg-white border-stone-300">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los proveedores</SelectItem>
              {supplierOptions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Material filter */}
        {materialOptions.length > 1 && (
          <Select value={materialFilter || '__all__'} onValueChange={v => setMaterialFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] bg-white border-stone-300">
              <SelectValue placeholder="Todos los materiales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los materiales</SelectItem>
              {materialOptions.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilter && (
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-stone-500" onClick={() => {
            setSupplierFilter('')
            setMaterialFilter('')
            clearReceptionDates()
          }}>
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}

        {/* Selection actions */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-2 pl-2 border-l border-stone-200">
            <span className="text-xs text-stone-600 font-medium">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
            {!selectionValid && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Plantas mixtas
              </span>
            )}
            <Button
              size="sm"
              className="h-7 text-xs bg-sky-700 hover:bg-sky-800 text-white gap-1"
              disabled={!selectionValid}
              onClick={() => openDrawerWith([...selected])}
            >
              <FileText className="h-3.5 w-3.5" />
              1 factura ({selected.size} recepcion{selected.size !== 1 ? 'es' : ''})
            </Button>
            {selected.size > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                disabled={!selectionValid}
                onClick={() => openBulkDialog([...selected])}
              >
                <FileText className="h-3.5 w-3.5" />
                Facturar en lote (ZIP/XML)
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Limpiar
            </Button>
          </div>
        )}

        <div className="ml-auto text-xs text-stone-500">
          {filteredEntries.length === 0
            ? (hasActiveFilter ? 'Sin resultados para el filtro' : 'No hay recepciones sin factura')
            : `${filteredEntries.length}${hasActiveFilter ? ` de ${entries.length}` : ''} recepción${filteredEntries.length !== 1 ? 'es' : ''} sin factura`}
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-3 py-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          {hasActiveFilter ? (
            <>
              <p className="text-sm font-medium">Sin recepciones para el filtro activo</p>
              <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => { setSupplierFilter(''); setMaterialFilter('') }}>Limpiar filtros</Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Todas las recepciones revisadas tienen factura</p>
              <p className="text-xs text-stone-400 mt-1">Las nuevas recepciones aparecerán aquí cuando sean revisadas y no tengan factura asignada.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([groupKey, grpData]) => {
            const allGroupIds = [...grpData.byPlant.values()]
              .flatMap(p => [...p.byMaterial.values()].flatMap(m => m.entries.map(e => e.id)))
            const allChecked = allGroupIds.every(id => selected.has(id))
            const someChecked = allGroupIds.some(id => selected.has(id))
            const expanded = expandedSuppliers.has(groupKey)
            const totalAmount = allGroupIds.reduce((s, id) => {
              const entry = entries.find(e => e.id === id)
              return s + Number(entry?.total_cost ?? 0) + Number(entry?.fleet_cost ?? 0)
            }, 0)
            const isMultiPlant = grpData.byPlant.size > 1

            return (
              <div key={groupKey} className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                {/* Supplier group header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors"
                  onClick={() => setExpandedSuppliers(prev => {
                    const next = new Set(prev)
                    if (next.has(groupKey)) next.delete(groupKey)
                    else next.add(groupKey)
                    return next
                  })}
                >
                  <div onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                      onCheckedChange={() => toggleAll(allGroupIds)}
                    />
                  </div>
                  {expanded ? <ChevronDown className="h-4 w-4 text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-500" />}
                  <span className="font-semibold text-sm text-stone-900 flex-1">
                    {grpData.supplierName}
                  </span>
                  {isMultiPlant && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 mr-1">
                      {grpData.byPlant.size} plantas
                    </span>
                  )}
                  <span className="text-xs text-stone-500 mr-2">{allGroupIds.length} entrada{allGroupIds.length !== 1 ? 's' : ''}</span>
                  <span className="text-sm font-semibold tabular-nums text-stone-900">{mxn.format(totalAmount)}</span>
                  {/* Only show a single "Crear factura" button at group level when all entries are same-plant */}
                  {!isMultiPlant && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs gap-1 ml-2"
                      onClick={e => { e.stopPropagation(); openDrawerWith(allGroupIds) }}
                    >
                      <FileText className="h-3 w-3" />
                      Crear factura
                    </Button>
                  )}
                </div>

                {expanded && (
                  <div>
                    {[...grpData.byPlant.entries()].map(([plantId, plantData]) => {
                      const allPlantIds = [...plantData.byMaterial.values()].flatMap(m => m.entries.map(e => e.id))
                      const plantTotal = allPlantIds.reduce((s, id) => {
                        const entry = entries.find(e => e.id === id)
                        return s + Number(entry?.total_cost ?? 0) + Number(entry?.fleet_cost ?? 0)
                      }, 0)
                      const plantAllChecked = allPlantIds.every(id => selected.has(id))
                      const plantSomeChecked = allPlantIds.some(id => selected.has(id))
                      const plantName = plantMap.get(plantId) ?? plantId

                      return (
                        <div key={plantId} className="border-t border-stone-100">
                          {/* Plant sub-header — only visible when multi-plant */}
                          {isMultiPlant && (
                            <div className="flex items-center gap-2 px-5 py-2 bg-stone-50/60">
                              <div onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={plantAllChecked ? true : plantSomeChecked ? 'indeterminate' : false}
                                  onCheckedChange={() => toggleAll(allPlantIds)}
                                />
                              </div>
                              <span className="text-xs font-semibold text-stone-600 flex-1">{plantName}</span>
                              <span className="text-xs text-stone-500 mr-2">{allPlantIds.length} entrada{allPlantIds.length !== 1 ? 's' : ''}</span>
                              <span className="text-xs font-semibold tabular-nums text-stone-800 mr-2">{mxn.format(plantTotal)}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                                onClick={e => { e.stopPropagation(); openDrawerWith(allPlantIds) }}
                              >
                                <FileText className="h-3 w-3" />
                                Crear factura
                              </Button>
                            </div>
                          )}

                          {/* Materials within this plant */}
                          <div className="divide-y divide-stone-100">
                            {[...plantData.byMaterial.entries()].map(([matId, matData]) => {
                              const matIds = matData.entries.map(e => e.id)
                              const matExpKey = `${groupKey}:${plantId}:${matId}`
                              const matExpanded = expandedMaterials.has(matExpKey)
                              const matAllChecked = matIds.every(id => selected.has(id))
                              const matSomeChecked = matIds.some(id => selected.has(id))
                              const matTotal = matData.entries.reduce((s, e) => s + Number(e.total_cost ?? 0) + Number(e.fleet_cost ?? 0), 0)
                              const indent = isMultiPlant ? 'px-9' : 'px-6'

                              return (
                                <div key={matId}>
                                  {/* Material row */}
                                  <div
                                    className={`flex items-center gap-3 ${indent} py-2.5 hover:bg-stone-50 cursor-pointer transition-colors`}
                                    onClick={() => setExpandedMaterials(prev => {
                                      const next = new Set(prev)
                                      if (next.has(matExpKey)) next.delete(matExpKey)
                                      else next.add(matExpKey)
                                      return next
                                    })}
                                  >
                                    <div onClick={e => e.stopPropagation()}>
                                      <Checkbox
                                        checked={matAllChecked ? true : matSomeChecked ? 'indeterminate' : false}
                                        onCheckedChange={() => toggleAll(matIds)}
                                      />
                                    </div>
                                    {matExpanded ? <ChevronDown className="h-3.5 w-3.5 text-stone-400" /> : <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
                                    <Package className="h-3.5 w-3.5 text-stone-400" />
                                    <span className="text-sm text-stone-700 flex-1">{matData.material?.material_name ?? matId}</span>
                                    <span className="text-xs text-stone-400 mr-2">{matIds.length}</span>
                                    <span className="text-sm font-medium tabular-nums">{mxn.format(matTotal)}</span>
                                  </div>

                                  {/* Entry rows */}
                                  {matExpanded && matData.entries.map(entry => {
                                    const hasFleet = Number(entry.fleet_cost ?? 0) > 0
                                    const entryTotal = Number(entry.total_cost ?? 0) + Number(entry.fleet_cost ?? 0)
                                    const entryIndent = isMultiPlant ? 'px-14' : 'px-10'
                                    return (
                                      <div
                                        key={entry.id}
                                        className={cn(
                                          `flex items-center gap-3 ${entryIndent} py-2 text-xs hover:bg-sky-50/50 transition-colors`,
                                          selected.has(entry.id) && 'bg-sky-50'
                                        )}
                                      >
                                        <Checkbox
                                          checked={selected.has(entry.id)}
                                          onCheckedChange={() => toggleEntry(entry.id)}
                                        />
                                        <span className="font-mono text-stone-700">{entry.entry_number}</span>
                                        <OrphanEntryRemisionInline numbers={entry.remision_numbers} />
                                        <span className="text-stone-500">
                                          {format(new Date(entry.entry_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                        </span>
                                        <span className="text-stone-500">
                                          {entry.received_qty_entered != null
                                            ? `${Number(entry.received_qty_entered).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${entry.received_uom ?? 'kg'}`
                                            : '—'}
                                        </span>
                                        {hasFleet && (
                                          <span className="flex items-center gap-0.5 text-blue-600">
                                            <Truck className="h-3 w-3" />Flete
                                          </span>
                                        )}
                                        <span className="ml-auto tabular-nums font-medium text-stone-800">{mxn.format(entryTotal)}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <CreateSupplierInvoiceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entries={drawerEntries}
        plantId={drawerEntries[0]?.plant_id}
        onSuccess={handleDrawerSuccess}
      />
      <BulkCfdiInvoiceDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        entries={bulkEntries}
        onSuccess={handleBulkSuccess}
      />
      </>
      )}
    </div>
  )
}
