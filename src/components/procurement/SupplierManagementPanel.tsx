'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Building2, Clock, Search, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PAYMENT_TERMS_PRESET_DAYS,
  formatPaymentTermsLabel,
} from '@/lib/procurement/paymentTermsLabels'

type SupplierRow = {
  id: string
  name: string
  provider_number: number
  plant_id: string
  is_active: boolean
  default_payment_terms_days: number | null
}

type Props = {
  workspacePlantId: string
}

export default function SupplierManagementPanel({ workspacePlantId }: Props) {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRow | null>(null)
  const [presetValue, setPresetValue] = useState<string>('unset')
  const [customDays, setCustomDays] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      const res = await fetch(`/api/suppliers?${params.toString()}`)
      if (!res.ok) throw new Error('Error al cargar')
      const data = await res.json()
      setSuppliers(data.suppliers || [])
    } catch {
      toast.error('No se pudieron cargar los proveedores')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [workspacePlantId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || String(s.provider_number).includes(q)
    )
  }, [suppliers, search])

  const openEdit = (s: SupplierRow) => {
    setEditing(s)
    const d = s.default_payment_terms_days
    if (d === null || d === undefined) {
      setPresetValue('unset')
      setCustomDays('')
    } else if (PAYMENT_TERMS_PRESET_DAYS.includes(d as (typeof PAYMENT_TERMS_PRESET_DAYS)[number])) {
      setPresetValue(String(d))
      setCustomDays('')
    } else {
      setPresetValue('custom')
      setCustomDays(String(d))
    }
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editing) return
    let next: number | null = null
    if (presetValue === 'unset') {
      next = null
    } else if (presetValue === 'custom') {
      const n = parseInt(customDays, 10)
      if (Number.isNaN(n) || n < 0 || n > 365) {
        toast.error('Ingrese días entre 0 y 365')
        return
      }
      next = n
    } else {
      next = parseInt(presetValue, 10)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/suppliers/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_payment_terms_days: next,
          plant_id: workspacePlantId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'No se pudo guardar')
        return
      }
      toast.success('Plazo de pago actualizado')
      setSuppliers((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, default_payment_terms_days: next }
            : r
        )
      )
      setEditOpen(false)
      setEditing(null)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!workspacePlantId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
        <p className="font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" />
          Seleccione una planta en el filtro superior para gestionar plazos de pago por proveedor.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-stone-600" />
            Gestión de proveedores
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-xl">
            Defina el plazo de pago predeterminado por proveedor. Al revisar entradas, la fecha de vencimiento se
            calculará como fecha de entrada + estos días (puede ajustarse en cada entrada).
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" aria-hidden />
        <Input
          className="pl-9 border-stone-300 bg-white"
          placeholder="Buscar por nombre o número…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-stone-500 py-8">Cargando proveedores…</div>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-stone-50/50 overflow-hidden text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200/80 bg-stone-100/60 text-left">
                  <th className="py-2.5 px-3 font-medium text-stone-700 whitespace-nowrap">#</th>
                  <th className="py-2.5 px-3 font-medium text-stone-700">Proveedor</th>
                  <th className="py-2.5 px-3 font-medium text-stone-700 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-stone-500" />
                      Plazo predeterminado
                    </span>
                  </th>
                  <th className="py-2.5 px-3 font-medium text-stone-700 whitespace-nowrap">Estado</th>
                  <th className="py-2.5 px-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100 last:border-0 hover:bg-white/80">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-stone-800">
                      {s.provider_number}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-stone-900 min-w-[12rem] max-w-[20rem] truncate" title={s.name}>
                      {s.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[11px] font-normal border-0',
                          s.default_payment_terms_days != null
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {formatPaymentTermsLabel(s.default_payment_terms_days)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        className={cn(
                          'text-[10px] border-0',
                          s.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-200 text-stone-600'
                        )}
                      >
                        {s.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openEdit(s)}
                      >
                        Editar plazo
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-stone-500 text-sm">
              {search ? 'Sin resultados para la búsqueda.' : 'No hay proveedores en esta planta.'}
            </div>
          )}
        </div>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-md border-stone-200 bg-white">
          <SheetHeader>
            <SheetTitle className="text-stone-900">Plazo de pago predeterminado</SheetTitle>
            <SheetDescription>
              {editing && (
                <>
                  <span className="font-mono text-stone-700">{editing.provider_number}</span>
                  {' · '}
                  {editing.name}
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset_terms">Plazo</Label>
              <Select value={presetValue} onValueChange={setPresetValue}>
                <SelectTrigger id="preset_terms" className="border-stone-300">
                  <SelectValue placeholder="Seleccione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Sin configurar</SelectItem>
                  {PAYMENT_TERMS_PRESET_DAYS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {formatPaymentTermsLabel(d)}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Otro (días personalizado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {presetValue === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom_days">Días</Label>
                <Input
                  id="custom_days"
                  type="number"
                  min={0}
                  max={365}
                  className="border-stone-300 tabular-nums"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0–365"
                />
                <p className="text-xs text-stone-500">Días desde la fecha de la entrada hasta el vencimiento.</p>
              </div>
            )}
          </div>
          <SheetFooter className="mt-8 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-stone-300"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-sky-800 text-white hover:bg-sky-900 shadow-sm"
              onClick={() => void saveEdit()}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
