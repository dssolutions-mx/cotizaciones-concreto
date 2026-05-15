'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronRight, AlertTriangle, FileText, Package, Truck, X } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import CreateSupplierInvoiceDrawer, { type OrphanEntry } from './CreateSupplierInvoiceDrawer'
import { cn } from '@/lib/utils'

interface Props {
  workspacePlantId?: string
}

export default function OrphanEntriesTab({ workspacePlantId }: Props) {
  const { availablePlants } = usePlantContext()
  const [plantFilter, setPlantFilter] = useState(workspacePlantId ?? '')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [entries, setEntries] = useState<OrphanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerEntries, setDrawerEntries] = useState<OrphanEntry[]>([])
  const [unoAUnoQueue, setUnoAUnoQueue] = useState<OrphanEntry[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (plantFilter) qs.set('plant_id', plantFilter)
      qs.set('limit', '1000')
      const res = await fetch(`/api/ap/orphan-entries?${qs}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
      // Auto-expand all supplier groups
      const supplierKeys = new Set<string>(
        (data.entries ?? []).map((e: OrphanEntry) => e.supplier?.id ?? e.supplier_id)
      )
      setExpandedSuppliers(supplierKeys)
    } finally {
      setLoading(false)
    }
  }, [plantFilter, reloadKey])

  useEffect(() => { void fetchEntries() }, [fetchEntries])

  useEffect(() => {
    if (workspacePlantId !== undefined) setPlantFilter(workspacePlantId)
  }, [workspacePlantId])

  // Derive filter options from loaded entries
  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const id = e.supplier?.id ?? e.supplier_id
      if (!map.has(id)) map.set(id, e.supplier?.name ?? id)
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
      if (supplierFilter && (e.supplier?.id ?? e.supplier_id) !== supplierFilter) return false
      if (materialFilter && (e.material?.id ?? e.material_id) !== materialFilter) return false
      return true
    })
  }, [entries, supplierFilter, materialFilter])

  // Group: supplier → material → entries
  const grouped = useMemo(() => {
    const bySupplier = new Map<string, { supplier: OrphanEntry['supplier']; supplierId: string; byMaterial: Map<string, { material: OrphanEntry['material']; entries: OrphanEntry[] }> }>()
    for (const e of filteredEntries) {
      const supplierId = e.supplier?.id ?? e.supplier_id
      if (!bySupplier.has(supplierId)) {
        bySupplier.set(supplierId, { supplier: e.supplier, supplierId, byMaterial: new Map() })
      }
      const matId = e.material?.id ?? e.material_id
      const s = bySupplier.get(supplierId)!
      if (!s.byMaterial.has(matId)) {
        s.byMaterial.set(matId, { material: e.material, entries: [] })
      }
      s.byMaterial.get(matId)!.entries.push(e)
    }
    return bySupplier
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

  const startUnoAUno = (ids: string[]) => {
    const toInvoice = entries.filter(e => ids.includes(e.id))
    if (toInvoice.length === 0) return
    const [first, ...rest] = toInvoice
    setUnoAUnoQueue(rest)
    setDrawerEntries([first])
    setDrawerOpen(true)
  }

  const handleDrawerSuccess = () => {
    if (unoAUnoQueue.length > 0) {
      const [next, ...rest] = unoAUnoQueue
      setUnoAUnoQueue(rest)
      setDrawerEntries([next])
    } else {
      setDrawerOpen(false)
      setUnoAUnoQueue([])
      setReloadKey(k => k + 1)
    }
  }

  const selectedEntries = entries.filter(e => selected.has(e.id))
  const selectedPlants = new Set(selectedEntries.map(e => e.plant_id))
  const selectionValid = selectedPlants.size <= 1
  const hasActiveFilter = !!supplierFilter || !!materialFilter

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Plant filter */}
        <Select value={plantFilter || '__all__'} onValueChange={v => setPlantFilter(v === '__all__' ? '' : v)}>
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
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-stone-500" onClick={() => { setSupplierFilter(''); setMaterialFilter('') }}>
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
                onClick={() => startUnoAUno([...selected])}
              >
                <FileText className="h-3.5 w-3.5" />
                {selected.size} facturas una a una
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

      {filteredEntries.length === 0 ? (
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
          {[...grouped.entries()].map(([supplierId, supplierData]) => {
            const allIds = [...supplierData.byMaterial.values()].flatMap(m => m.entries.map(e => e.id))
            const allChecked = allIds.every(id => selected.has(id))
            const someChecked = allIds.some(id => selected.has(id))
            const expanded = expandedSuppliers.has(supplierId)
            const totalAmount = [...supplierData.byMaterial.values()]
              .flatMap(m => m.entries)
              .reduce((s, e) => s + Number(e.total_cost ?? 0) + Number(e.fleet_cost ?? 0), 0)

            return (
              <div key={supplierId} className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                {/* Supplier header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors"
                  onClick={() => setExpandedSuppliers(prev => {
                    const next = new Set(prev)
                    if (next.has(supplierId)) next.delete(supplierId)
                    else next.add(supplierId)
                    return next
                  })}
                >
                  <div onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                      onCheckedChange={() => toggleAll(allIds)}
                    />
                  </div>
                  {expanded ? <ChevronDown className="h-4 w-4 text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-500" />}
                  <span className="font-semibold text-sm text-stone-900 flex-1">
                    {supplierData.supplier?.name ?? supplierId}
                  </span>
                  <span className="text-xs text-stone-500 mr-2">{allIds.length} entrada{allIds.length !== 1 ? 's' : ''}</span>
                  <span className="text-sm font-semibold tabular-nums text-stone-900">{mxn.format(totalAmount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs gap-1 ml-2"
                    onClick={e => { e.stopPropagation(); openDrawerWith(allIds) }}
                  >
                    <FileText className="h-3 w-3" />
                    Crear factura
                  </Button>
                </div>

                {expanded && (
                  <div className="divide-y divide-stone-100">
                    {[...supplierData.byMaterial.entries()].map(([matId, matData]) => {
                      const matIds = matData.entries.map(e => e.id)
                      const matExpKey = `${supplierId}:${matId}`
                      const matExpanded = expandedMaterials.has(matExpKey)
                      const matAllChecked = matIds.every(id => selected.has(id))
                      const matSomeChecked = matIds.some(id => selected.has(id))
                      const matTotal = matData.entries.reduce((s, e) => s + Number(e.total_cost ?? 0) + Number(e.fleet_cost ?? 0), 0)

                      return (
                        <div key={matId}>
                          {/* Material row */}
                          <div
                            className="flex items-center gap-3 px-6 py-2.5 hover:bg-stone-50 cursor-pointer transition-colors"
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
                            return (
                              <div
                                key={entry.id}
                                className={cn(
                                  'flex items-center gap-3 px-10 py-2 text-xs hover:bg-sky-50/50 transition-colors',
                                  selected.has(entry.id) && 'bg-sky-50'
                                )}
                              >
                                <Checkbox
                                  checked={selected.has(entry.id)}
                                  onCheckedChange={() => toggleEntry(entry.id)}
                                />
                                <span className="font-mono text-stone-700">{entry.entry_number}</span>
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
                )}
              </div>
            )
          })}
        </div>
      )}

      <CreateSupplierInvoiceDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) { setUnoAUnoQueue([]); setDrawerOpen(false) }
        }}
        entries={drawerEntries}
        plantId={drawerEntries[0]?.plant_id}
        queueInfo={unoAUnoQueue.length > 0 ? { remaining: unoAUnoQueue.length } : undefined}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  )
}
