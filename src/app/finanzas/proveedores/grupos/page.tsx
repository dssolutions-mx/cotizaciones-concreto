'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import SupplierGroupDialog from '@/components/finanzas/SupplierGroupDialog'
import SupplierGroupCleanupDialog from '@/components/finanzas/SupplierGroupCleanupDialog'
import {
  buildDuplicateClusters,
  normalizeGroupName,
  type EnrichedSupplierGroup,
  type MaintenancePreview,
} from '@/lib/ap/supplierGroupMaintenance'

type Supplier = {
  id: string
  name: string
  plant_id: string | null
  group_id: string | null
  provider_number: number | null
}

type GroupFilter = 'all' | 'no_rfc' | 'duplicates' | 'empty' | 'has_activity'

export default function SupplierGroupsPage() {
  const { availablePlants } = usePlantContext()
  const plantMap = useMemo(
    () => new Map(availablePlants.map(p => [p.id, p.name])),
    [availablePlants],
  )

  const [groups, setGroups] = useState<EnrichedSupplierGroup[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [maintenance, setMaintenance] = useState<MaintenancePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groupSearch, setGroupSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all')

  const [supplierSearch, setSupplierSearch] = useState('')
  const [filterPlant, setFilterPlant] = useState('')
  const [filterGroup, setFilterGroup] = useState('')

  const [pending, setPending] = useState<Map<string, string>>(new Map())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup] = useState<EnrichedSupplierGroup | null>(null)

  const [cleanupOpen, setCleanupOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [previewRes, sr] = await Promise.all([
        fetch('/api/ap/supplier-groups/maintenance'),
        fetch('/api/suppliers'),
      ])
      if (!previewRes.ok || !sr.ok) throw new Error('Error al cargar')
      const preview = (await previewRes.json()) as MaintenancePreview
      const sd = await sr.json()
      setMaintenance(preview)
      setGroups(preview.groups)
      setSuppliers(sd.suppliers ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const duplicateNameKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of buildDuplicateClusters(groups)) {
      if (c.groups.length > 1) keys.add(c.normalized_name)
    }
    return keys
  }, [groups])

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase()
    return groups.filter(g => {
      if (q) {
        const hay = `${g.name} ${g.rfc ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      switch (groupFilter) {
        case 'no_rfc':
          return !g.rfc
        case 'duplicates':
          return duplicateNameKeys.has(normalizeGroupName(g.name))
        case 'empty':
          return g.supplier_count === 0 && g.invoice_count === 0 && g.credit_note_count === 0
        case 'has_activity':
          return g.invoice_count > 0 || g.supplier_count > 0
        default:
          return true
      }
    })
  }, [groups, groupSearch, groupFilter, duplicateNameKeys])

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase()
    return suppliers
      .filter(s => {
        if (q && !s.name.toLowerCase().includes(q)) return false
        if (filterPlant && s.plant_id !== filterPlant) return false
        if (filterGroup === '__none__' && s.group_id) return false
        if (filterGroup && filterGroup !== '__none__' && s.group_id !== filterGroup) return false
        return true
      })
      .sort((a, b) => {
        if (!filterGroup) {
          if (!a.group_id && b.group_id) return -1
          if (a.group_id && !b.group_id) return 1
        }
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
  }, [suppliers, supplierSearch, filterPlant, filterGroup])

  const ungroupedCount = useMemo(() => suppliers.filter(s => !s.group_id).length, [suppliers])

  const assignGroup = async (supplierId: string, groupId: string | null) => {
    setPending(prev => new Map(prev).set(supplierId, groupId ?? '__none__'))
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setSuppliers(prev =>
        prev.map(s => (s.id === supplierId ? { ...s, group_id: groupId } : s)),
      )
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al asignar')
    } finally {
      setPending(prev => {
        const m = new Map(prev)
        m.delete(supplierId)
        return m
      })
    }
  }

  const openCreate = () => {
    setEditGroup(null)
    setDialogMode('create')
    setDialogOpen(true)
  }

  const openEdit = (g: EnrichedSupplierGroup) => {
    setEditGroup(g)
    setDialogMode('edit')
    setDialogOpen(true)
  }

  const applySuggestedRfc = async (g: EnrichedSupplierGroup) => {
    if (!g.suggested_rfc) return
    const res = await fetch(`/api/ap/supplier-groups/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: g.name, rfc: g.suggested_rfc }),
    })
    if (!res.ok) {
      toast.error('No se pudo aplicar el RFC')
      return
    }
    toast.success(`RFC ${g.suggested_rfc} asignado a ${g.name}`)
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const stats = maintenance?.stats
  const plan = maintenance?.plan
  const needsCleanup = plan?.has_actions ?? false

  return (
    <div className="min-w-0 space-y-6">
      {needsCleanup && stats ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-2 min-w-0 flex-1">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-950">
              <p className="font-medium">Datos de grupos por ordenar</p>
              <p className="text-amber-900/90 mt-0.5">
                {plan ? (
                  <>
                    {plan.totals.groups_merged_away > 0 && (
                      <span>{plan.totals.groups_merged_away} grupos a fusionar · </span>
                    )}
                    {plan.totals.suppliers_relinked > 0 && (
                      <span>{plan.totals.suppliers_relinked} proveedores a reasignar · </span>
                    )}
                    {plan.totals.rfc_updates > 0 && (
                      <span>{plan.totals.rfc_updates} RFC a completar · </span>
                    )}
                    {plan.totals.groups_deactivated > 0 && (
                      <span>{plan.totals.groups_deactivated} a desactivar</span>
                    )}
                  </>
                ) : null}
                {' '}
                <span className="text-amber-800">Abra el plan para ver el detalle.</span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-1.5 bg-amber-900 hover:bg-amber-800 text-white"
            onClick={() => setCleanupOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ver plan de limpieza
          </Button>
        </div>
      ) : null}

      {/* Groups table */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Catálogo de grupos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {groups.length} activos · identidad fiscal para CxP y CFDI
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Nuevo grupo
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              placeholder="Buscar por nombre o RFC…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Select value={groupFilter} onValueChange={v => setGroupFilter(v as GroupFilter)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="no_rfc">Sin RFC</SelectItem>
              <SelectItem value="duplicates">Nombres duplicados</SelectItem>
              <SelectItem value="empty">Sin proveedores ni facturas</SelectItem>
              <SelectItem value="has_activity">Con actividad</SelectItem>
            </SelectContent>
          </Select>
          {(groupSearch || groupFilter !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setGroupSearch('')
                setGroupFilter('all')
              }}
            >
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b">
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">
                  Grupo
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground w-[140px]">
                  RFC
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground w-20">
                  Prov.
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground w-20">
                  Fact.
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground w-28">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    No hay grupos con ese criterio.
                  </td>
                </tr>
              ) : (
                filteredGroups.map(g => {
                  const isDup = duplicateNameKeys.has(normalizeGroupName(g.name))
                  return (
                    <tr
                      key={g.id}
                      className={cn(
                        'hover:bg-stone-50/60',
                        isDup && 'bg-amber-50/40',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <button
                            type="button"
                            className="font-medium text-left hover:underline truncate"
                            onClick={() => setFilterGroup(g.id === filterGroup ? '' : g.id)}
                            title="Filtrar proveedores de este grupo"
                          >
                            {g.name}
                          </button>
                          {isDup ? (
                            <Badge variant="outline" className="text-[10px] shrink-0 text-amber-800 border-amber-300">
                              duplicado
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {g.rfc ? (
                          <span className="font-mono text-xs">{g.rfc}</span>
                        ) : g.suggested_rfc && !g.rfc_conflict ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Sin RFC</span>
                            <button
                              type="button"
                              className="text-[11px] text-left text-sky-700 hover:underline font-mono"
                              onClick={() => void applySuggestedRfc(g)}
                            >
                              Usar {g.suggested_rfc}
                            </button>
                          </div>
                        ) : g.rfc_conflict ? (
                          <span className="text-xs text-amber-700">RFC conflictivo en facturas</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                        {g.supplier_count}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                        {g.invoice_count}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(g)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suppliers assignment */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">Asignación por planta</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)}
              placeholder="Buscar proveedor…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Select value={filterPlant || '__all__'} onValueChange={v => setFilterPlant(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Todas las plantas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las plantas</SelectItem>
              {availablePlants.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterGroup || '__all__'} onValueChange={v => setFilterGroup(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Todos los grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los grupos</SelectItem>
              <SelectItem value="__none__">Sin grupo ({ungroupedCount})</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  {g.rfc ? ` · ${g.rfc}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredSuppliers.length} de {suppliers.length}
          </span>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b">
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground w-[40%]">
                  Proveedor
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground w-[25%]">
                  Planta
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">
                  Grupo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-sm text-muted-foreground">
                    No hay proveedores con ese criterio.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(s => {
                  const isPending = pending.has(s.id)
                  const effectiveGroupId = isPending
                    ? pending.get(s.id) === '__none__'
                      ? null
                      : (pending.get(s.id) ?? null)
                    : s.group_id
                  return (
                    <tr
                      key={s.id}
                      className={cn('hover:bg-stone-50/60', isPending && 'opacity-60')}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{s.name}</span>
                        {s.provider_number != null && (
                          <span className="text-xs text-muted-foreground font-mono ml-2">
                            #{s.provider_number}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.plant_id ? (plantMap.get(s.plant_id) ?? s.plant_id) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {isPending && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                          )}
                          <select
                            value={effectiveGroupId ?? ''}
                            onChange={e => void assignGroup(s.id, e.target.value || null)}
                            disabled={isPending || groups.length === 0}
                            className={cn(
                              'h-7 text-xs rounded-md border border-transparent bg-transparent px-2 pr-6 hover:border-border hover:bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer disabled:opacity-50 max-w-[280px]',
                              !effectiveGroupId && 'text-muted-foreground',
                            )}
                          >
                            <option value="">Sin grupo</option>
                            {groups.map(gr => (
                              <option key={gr.id} value={gr.id}>
                                {gr.name}
                                {gr.rfc ? ` · ${gr.rfc}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SupplierGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        groupId={editGroup?.id}
        initialName={editGroup?.name ?? ''}
        initialRfc={editGroup?.rfc ?? ''}
        onSaved={() => void load()}
      />

      <SupplierGroupCleanupDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        plantMap={plantMap}
        onCompleted={() => {
          toast.success('Limpieza aplicada')
          void load()
        }}
      />
    </div>
  )
}
