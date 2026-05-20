'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Edit2, Loader2, Plus, Save, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'

type SupplierGroup = { id: string; name: string; rfc: string | null; is_active: boolean }
type Supplier = {
  id: string
  name: string
  plant_id: string | null
  group_id: string | null
  provider_number: number | null
}

export default function SupplierGroupsPage() {
  const { availablePlants } = usePlantContext()
  const plantMap = useMemo(() => new Map(availablePlants.map(p => [p.id, p.name])), [availablePlants])

  const [groups, setGroups] = useState<SupplierGroup[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Optimistic group assignment per supplier id
  const [pending, setPending] = useState<Map<string, string>>(new Map())

  // Group editing
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRfc, setEditRfc] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)

  // New group form
  const [newName, setNewName] = useState('')
  const [newRfc, setNewRfc] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const newNameRef = useRef<HTMLInputElement>(null)

  // Table filters
  const [search, setSearch] = useState('')
  const [filterPlant, setFilterPlant] = useState<string>('')
  const [filterGroup, setFilterGroup] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [gr, sr] = await Promise.all([fetch('/api/ap/supplier-groups'), fetch('/api/suppliers')])
      if (!gr.ok || !sr.ok) throw new Error('Error al cargar')
      const gd = await gr.json()
      const sd = await sr.json()
      setGroups(gd.groups ?? [])
      setSuppliers(sd.suppliers ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // --- Group CRUD ---

  const startEdit = (g: SupplierGroup) => {
    setEditingGroupId(g.id)
    setEditName(g.name)
    setEditRfc(g.rfc ?? '')
  }

  const saveGroupEdit = async () => {
    if (!editingGroupId || !editName.trim()) return
    setSavingGroup(true)
    try {
      const res = await fetch(`/api/ap/supplier-groups/${editingGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), rfc: editRfc.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setEditingGroupId(null)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingGroup(false)
    }
  }

  const createGroup = async () => {
    if (!newName.trim()) return
    setCreatingGroup(true)
    try {
      const res = await fetch('/api/ap/supplier-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), rfc: newRfc.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setNewName('')
      setNewRfc('')
      setShowNewForm(false)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al crear')
    } finally {
      setCreatingGroup(false)
    }
  }

  // --- Supplier assignment ---

  const assignGroup = async (supplierId: string, groupId: string | null) => {
    setPending(prev => new Map(prev).set(supplierId, groupId ?? '__none__'))
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, group_id: groupId } : s))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al asignar')
    } finally {
      setPending(prev => { const m = new Map(prev); m.delete(supplierId); return m })
    }
  }

  // --- Derived data ---

  const groupCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of suppliers) {
      if (s.group_id) m.set(s.group_id, (m.get(s.group_id) ?? 0) + 1)
    }
    return m
  }, [suppliers])

  const ungroupedCount = useMemo(() => suppliers.filter(s => !s.group_id).length, [suppliers])

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase()
    return suppliers.filter(s => {
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (filterPlant && s.plant_id !== filterPlant) return false
      if (filterGroup === '__none__' && s.group_id) return false
      if (filterGroup && filterGroup !== '__none__' && s.group_id !== filterGroup) return false
      return true
    }).sort((a, b) => {
      // ungrouped first when no group filter, else alphabetical
      if (!filterGroup) {
        if (!a.group_id && b.group_id) return -1
        if (a.group_id && !b.group_id) return 1
      }
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
  }, [suppliers, search, filterPlant, filterGroup])

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
        <Button size="sm" variant="outline" onClick={load}>Reintentar</Button>
      </div>
    )
  }

  const hasFilters = !!search || !!filterPlant || !!filterGroup

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* ── Groups section ─────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grupos</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => { setShowNewForm(true); setTimeout(() => newNameRef.current?.focus(), 50) }}
            disabled={showNewForm}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo grupo
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {groups.map(g => {
            const isEditing = editingGroupId === g.id
            const count = groupCounts.get(g.id) ?? 0
            return (
              <div
                key={g.id}
                className={cn(
                  'flex items-center gap-2 border rounded-lg px-3 py-2 bg-white transition-shadow',
                  isEditing ? 'ring-2 ring-primary/30 shadow-sm' : 'hover:shadow-sm'
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />

                {isEditing ? (
                  <>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-6 text-xs w-36 px-1.5"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveGroupEdit(); if (e.key === 'Escape') setEditingGroupId(null) }}
                    />
                    <Input
                      value={editRfc}
                      onChange={e => setEditRfc(e.target.value.toUpperCase())}
                      placeholder="RFC"
                      className="h-6 text-xs w-28 px-1.5 font-mono"
                      onKeyDown={e => { if (e.key === 'Enter') saveGroupEdit(); if (e.key === 'Escape') setEditingGroupId(null) }}
                    />
                    <button
                      onClick={saveGroupEdit}
                      disabled={savingGroup || !editName.trim()}
                      className="text-primary hover:text-primary/70 disabled:opacity-40"
                    >
                      {savingGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => setEditingGroupId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="text-sm font-medium leading-none hover:underline text-left"
                      onClick={() => { setFilterGroup(g.id === filterGroup ? '' : g.id) }}
                      title="Filtrar tabla por este grupo"
                    >
                      {g.name}
                    </button>
                    {g.rfc && <span className="text-xs text-muted-foreground font-mono">{g.rfc}</span>}
                    <Badge
                      variant={count === 0 ? 'outline' : 'secondary'}
                      className={cn('text-xs tabular-nums shrink-0', count === 0 && 'text-muted-foreground')}
                    >
                      {count}
                    </Badge>
                    <button
                      onClick={() => startEdit(g)}
                      className="text-muted-foreground hover:text-foreground ml-1"
                      title="Editar"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            )
          })}

          {/* Inline new group form */}
          {showNewForm && (
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white ring-2 ring-primary/30 shadow-sm">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <Input
                ref={newNameRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nombre del grupo"
                className="h-6 text-xs w-36 px-1.5"
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setShowNewForm(false); setNewName(''); setNewRfc('') } }}
              />
              <Input
                value={newRfc}
                onChange={e => setNewRfc(e.target.value.toUpperCase())}
                placeholder="RFC"
                className="h-6 text-xs w-28 px-1.5 font-mono"
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setShowNewForm(false); setNewName(''); setNewRfc('') } }}
              />
              <button
                onClick={createGroup}
                disabled={creatingGroup || !newName.trim()}
                className="text-primary hover:text-primary/70 disabled:opacity-40"
              >
                {creatingGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewName(''); setNewRfc('') }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {groups.length === 0 && !showNewForm && (
            <p className="text-sm text-muted-foreground py-1">No hay grupos. Crea el primero con el botón.</p>
          )}
        </div>
      </div>

      {/* ── Supplier table ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
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
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGroup || '__all__'} onValueChange={v => setFilterGroup(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Todos los grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los grupos</SelectItem>
              <SelectItem value="__none__">Sin grupo ({ungroupedCount})</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setFilterPlant(''); setFilterGroup('') }}
            >
              <X className="h-3 w-3" /> Limpiar
            </Button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {filteredSuppliers.length} de {suppliers.length} proveedores
          </span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b">
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground w-[40%]">Proveedor</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground w-[25%]">Planta</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Grupo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-sm text-muted-foreground">
                    {hasFilters ? 'No hay proveedores con ese criterio.' : 'No hay proveedores.'}
                  </td>
                </tr>
              ) : filteredSuppliers.map(s => {
                const isPending = pending.has(s.id)
                const effectiveGroupId = isPending
                  ? (pending.get(s.id) === '__none__' ? null : pending.get(s.id) ?? null)
                  : s.group_id
                return (
                  <tr key={s.id} className={cn('hover:bg-stone-50/60 transition-colors', isPending && 'opacity-60')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {s.provider_number != null && (
                          <span className="text-xs text-muted-foreground font-mono">#{s.provider_number}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {s.plant_id ? (plantMap.get(s.plant_id) ?? s.plant_id) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                        <select
                          value={effectiveGroupId ?? ''}
                          onChange={e => assignGroup(s.id, e.target.value || null)}
                          disabled={isPending || groups.length === 0}
                          className={cn(
                            'h-7 text-xs rounded-md border border-transparent bg-transparent px-2 pr-6 hover:border-border hover:bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors cursor-pointer disabled:opacity-50',
                            !effectiveGroupId && 'text-muted-foreground'
                          )}
                        >
                          <option value="">Sin grupo</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
