'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Pencil, AlertCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type PlantOption = { id: string; name: string; code?: string | null }

type MaterialRow = {
  id: string
  material_code: string
  material_name: string
  category: string
  unit_of_measure: string
  accounting_code?: string | null
  plant_id?: string | null
  is_active?: boolean
}

type Props = {
  workspacePlantId: string
  plantOptions: PlantOption[]
  onWorkspacePlantIdChange: (plantId: string) => void
  canView: boolean
  canEdit: boolean
}

export default function MaterialAccountingCodesReview({
  workspacePlantId,
  plantOptions,
  onWorkspacePlantIdChange,
  canView,
  canEdit,
}: Props) {
  const [localPlant, setLocalPlant] = useState<string>('')
  const [rows, setRows] = useState<MaterialRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const effectivePlantId = workspacePlantId || localPlant

  useEffect(() => {
    if (!workspacePlantId && !localPlant && plantOptions[0]) {
      setLocalPlant(plantOptions[0].id)
    }
  }, [workspacePlantId, localPlant, plantOptions])

  const onPlantSelect = useCallback(
    (v: string) => {
      onWorkspacePlantIdChange(v)
      setLocalPlant(v)
    },
    [onWorkspacePlantIdChange]
  )

  const load = useCallback(async () => {
    if (!canView) return
    if (!effectivePlantId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ active: 'true', plant_id: effectivePlantId })
      const res = await fetch(`/api/materials?${params}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al cargar materiales')
      }
      const data = (json.data || json.materials || []) as MaterialRow[]
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el catálogo')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canView, effectivePlantId])

  useEffect(() => {
    void load()
  }, [load])

  const searchNorm = useMemo(() => search.trim().toLowerCase(), [search])

  const displayed = useMemo(() => {
    let list = rows
    if (onlyMissing) {
      list = list.filter((m) => !m.accounting_code?.trim())
    }
    if (!searchNorm) return list
    return list.filter((m) => {
      const name = m.material_name?.toLowerCase() ?? ''
      const code = m.material_code?.toLowerCase() ?? ''
      const acc = m.accounting_code?.toLowerCase() ?? ''
      return name.includes(searchNorm) || code.includes(searchNorm) || acc.includes(searchNorm)
    })
  }, [rows, onlyMissing, searchNorm])

  const missingCount = useMemo(
    () => rows.filter((m) => !m.accounting_code?.trim()).length,
    [rows]
  )

  const beginEdit = (m: MaterialRow) => {
    if (!canEdit) return
    setEditingId(m.id)
    setEditValue(m.accounting_code?.trim() ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = useCallback(
    async (materialId: string) => {
      if (!canEdit) return
      setSavingId(materialId)
      try {
        const res = await fetch(`/api/materials/${materialId}/accounting-code`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounting_code: editValue }),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'No se pudo guardar')
        }
        const updated = (json.material || {}) as MaterialRow
        setRows((prev) =>
          prev.map((r) => (r.id === materialId ? { ...r, accounting_code: updated.accounting_code ?? null } : r))
        )
        toast.success('Clave contable actualizada')
        cancelEdit()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar')
      } finally {
        setSavingId(null)
      }
    },
    [canEdit, editValue]
  )

  if (!canView) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sin acceso al catálogo de materiales</AlertTitle>
        <AlertDescription className="text-sm">
          Su rol no incluye el listado de inventario estándar. Si necesita claves de producto, contacte a operaciones o
          finanzas.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Claves contables (ERP)</h2>
          <p className="text-sm text-stone-600 mt-1">
            Revise y edite la clave de producto (accounting_code) usada en el Excel contable. Los cambios aplican a
            todas las entradas que usen ese material.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
          <div className="space-y-1.5 min-w-[200px]">
            <Label className="text-xs text-stone-600">Planta</Label>
            {plantOptions.length > 0 ? (
              <Select
                value={workspacePlantId || localPlant || plantOptions[0].id}
                onValueChange={onPlantSelect}
              >
                <SelectTrigger className="h-9 bg-white text-sm w-full max-w-sm">
                  <SelectValue placeholder="Elija planta" />
                </SelectTrigger>
                <SelectContent>
                  {plantOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {!workspacePlantId && !localPlant && plantOptions.length === 0 ? (
              <p className="text-[11px] text-amber-800">Necesita al menos una planta en el contexto de trabajo.</p>
            ) : null}
          </div>
          <div className="flex-1 min-w-[200px] space-y-1.5 max-w-md">
            <Label className="text-xs text-stone-600">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, código o clave contable"
                className="h-9 pl-8 text-sm"
                disabled={!effectivePlantId}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              id="only-missing-ac"
              checked={onlyMissing}
              onCheckedChange={setOnlyMissing}
              disabled={!effectivePlantId}
            />
            <Label htmlFor="only-missing-ac" className="text-xs text-stone-600 font-normal cursor-pointer">
              Solo sin clave
              {effectivePlantId ? (
                <span className="ml-1.5 text-stone-500 tabular-nums">({missingCount} pend.)</span>
              ) : null}
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => void load()}
            disabled={loading || !effectivePlantId}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Recargar'}
          </Button>
        </div>
      </div>

      {!effectivePlantId ? null : (
        <div className="rounded-lg border border-stone-200 bg-white flex flex-col min-h-[320px] max-h-[calc(100dvh-18rem)] overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-500 text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando materiales…
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs whitespace-nowrap w-[6rem]">Código</TableHead>
                    <TableHead className="text-xs min-w-[10rem]">Material</TableHead>
                    <TableHead className="text-xs w-[7rem]">Categoría</TableHead>
                    <TableHead className="text-xs w-[4.5rem]">Unidad</TableHead>
                    <TableHead className="text-xs min-w-[12rem]">Clave ERP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-stone-500 py-8">
                        {rows.length === 0 ? 'No hay materiales activos en esta planta.' : 'Sin coincidencias con los filtros.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayed.map((m) => {
                      const miss = !m.accounting_code?.trim()
                      const isEditing = editingId === m.id
                      return (
                        <TableRow key={m.id} className="text-sm">
                          <TableCell className="font-mono text-[11px] text-stone-800 align-top">
                            {m.material_code}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="font-medium text-stone-900 text-xs leading-snug">{m.material_name}</div>
                          </TableCell>
                          <TableCell className="text-xs text-stone-600 align-top whitespace-nowrap">{m.category}</TableCell>
                          <TableCell className="text-xs text-stone-600 align-top">{m.unit_of_measure}</TableCell>
                          <TableCell className="align-top">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-8 text-xs font-mono flex-1 min-w-[8rem]"
                                  disabled={savingId === m.id}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void saveEdit(m.id)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => void saveEdit(m.id)}
                                  disabled={savingId === m.id}
                                >
                                  {savingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={cancelEdit}
                                  disabled={savingId === m.id}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={cn(
                                        'font-mono text-xs tabular-nums',
                                        miss ? 'text-amber-800' : 'text-stone-900'
                                      )}
                                    >
                                      {m.accounting_code?.trim() || '—'}
                                    </span>
                                    {miss && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] font-normal h-5 bg-amber-100 text-amber-900 border-amber-200/80"
                                      >
                                        Sin clave
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {canEdit && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => beginEdit(m)}
                                    title="Editar clave ERP"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-stone-500">
        Mostrando {displayed.length} de {rows.length} materiales
        {effectivePlantId && plantOptions.find((p) => p.id === effectivePlantId)
          ? ` · ${plantOptions.find((p) => p.id === effectivePlantId)?.name ?? ''}`
          : ''}
        . La clave se usa como columna &quot;clave de producto&quot; en el export contable.
      </p>
    </div>
  )
}
