'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Building2, Clock, Plus, Search, Settings2 } from 'lucide-react'
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
  provider_letter?: string | null
}

export type SupplierPlantOption = {
  id: string
  code?: string
  name: string
}

type Props = {
  workspacePlantId: string
  plantOptions?: SupplierPlantOption[]
  /** Roles: EXECUTIVE, PLANT_MANAGER, ADMIN_OPERATIONS (must match POST /api/suppliers) */
  canCreateSupplier?: boolean
  /** Roles: EXECUTIVE, ADMIN_OPERATIONS (must match PATCH /api/suppliers/[id]) */
  canEditPaymentTerms?: boolean
}

export default function SupplierManagementPanel({
  workspacePlantId,
  plantOptions = [],
  canCreateSupplier = false,
  canEditPaymentTerms = true,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRow | null>(null)
  const [presetValue, setPresetValue] = useState<string>('unset')
  const [customDays, setCustomDays] = useState('')
  const [saving, setSaving] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createProviderNumber, setCreateProviderNumber] = useState('')
  const [createLetter, setCreateLetter] = useState('')
  const [createInternalCode, setCreateInternalCode] = useState('')
  const [createPlantId, setCreatePlantId] = useState('')
  const [createActive, setCreateActive] = useState(true)
  const [createPresetTerms, setCreatePresetTerms] = useState<string>('30')
  const [createCustomDays, setCreateCustomDays] = useState('')

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

  const plantLabel = useCallback(
    (id: string) => {
      const p = plantOptions.find((x) => x.id === id)
      if (!p) return id
      return p.code ? `${p.code} · ${p.name}` : p.name
    },
    [plantOptions]
  )

  const resetCreateForm = useCallback(() => {
    const defaultPlant =
      workspacePlantId || (plantOptions.length === 1 ? plantOptions[0].id : '')
    setCreateName('')
    setCreateProviderNumber('')
    setCreateLetter('')
    setCreateInternalCode('')
    setCreatePlantId(defaultPlant)
    setCreateActive(true)
    setCreatePresetTerms('30')
    setCreateCustomDays('')
  }, [workspacePlantId, plantOptions])

  const openCreate = () => {
    resetCreateForm()
    setCreateOpen(true)
  }

  const createNumberParseError = useMemo(() => {
    const t = createProviderNumber.trim()
    if (!t) return null
    const n = parseInt(t, 10)
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      return 'Debe ser un entero entre 1 y 99 (restricción de la base de datos).'
    }
    return null
  }, [createProviderNumber])

  const createDuplicateNumberError = useMemo(() => {
    if (!createPlantId || createNumberParseError) return null
    const n = parseInt(createProviderNumber, 10)
    if (!Number.isInteger(n) || n < 1 || n > 99) return null
    if (suppliers.some((s) => s.provider_number === n && s.plant_id === createPlantId)) {
      return `Ya hay un proveedor con el número ${n} en ${plantLabel(createPlantId)}.`
    }
    return null
  }, [createPlantId, createNumberParseError, createProviderNumber, plantLabel, suppliers])

  const normalizedCreateLetter = useMemo(
    () => createLetter.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1),
    [createLetter]
  )

  const createDuplicateLetterError = useMemo(() => {
    if (!normalizedCreateLetter || !createPlantId) return null
    if (
      suppliers.some(
        (s) =>
          s.plant_id === createPlantId &&
          s.provider_letter &&
          String(s.provider_letter).toUpperCase() === normalizedCreateLetter
      )
    ) {
      return 'Esa letra ya está en uso en esta planta. Elija otra o deje el campo vacío.'
    }
    return null
  }, [createPlantId, normalizedCreateLetter, suppliers])

  const createFormHasBlockingErrors = !!(
    createNumberParseError ||
    createDuplicateNumberError ||
    createDuplicateLetterError
  )

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

  const saveCreate = async () => {
    const name = createName.trim()
    if (!name) {
      toast.error('Ingrese el nombre del proveedor')
      return
    }
    const n = parseInt(createProviderNumber, 10)
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error('El número de proveedor debe ser un entero entre 1 y 99')
      return
    }
    if (!createPlantId) {
      toast.error('Seleccione la planta del proveedor')
      return
    }
    if (createNumberParseError || createDuplicateNumberError || createDuplicateLetterError) {
      toast.error('Revise los campos marcados en rojo antes de guardar.')
      return
    }

    let default_payment_terms_days: number | null = 30
    if (createPresetTerms === 'unset') {
      default_payment_terms_days = null
    } else if (createPresetTerms === 'custom') {
      const d = parseInt(createCustomDays, 10)
      if (Number.isNaN(d) || d < 0 || d > 365) {
        toast.error('Plazo: ingrese días entre 0 y 365')
        return
      }
      default_payment_terms_days = d
    } else {
      default_payment_terms_days = parseInt(createPresetTerms, 10)
    }

    const dup = suppliers.some(
      (s) => s.provider_number === n && s.plant_id === createPlantId
    )
    if (dup) {
      toast.error(`Ya hay un proveedor con el número ${n} en ${plantLabel(createPlantId)}`)
      return
    }

    const letter = normalizedCreateLetter

    if (
      letter &&
      suppliers.some(
        (s) =>
          s.plant_id === createPlantId &&
          s.provider_letter &&
          String(s.provider_letter).toUpperCase() === letter
      )
    ) {
      toast.error('Esa letra ya está en uso en esta planta.')
      return
    }

    setCreateSaving(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          provider_number: n,
          plant_id: createPlantId,
          provider_letter: letter || undefined,
          internal_code: createInternalCode.trim() || undefined,
          is_active: createActive,
          default_payment_terms_days,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'No se pudo crear el proveedor')
        return
      }
      toast.success('Proveedor creado')
      setCreateOpen(false)
      await load()
    } catch {
      toast.error('Error al crear el proveedor')
    } finally {
      setCreateSaving(false)
    }
  }

  if (!workspacePlantId) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <p className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            Seleccione una planta en el filtro superior para ver y gestionar proveedores de esa planta.
          </p>
        </div>
        {canCreateSupplier && plantOptions.length > 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-700 mb-3">
              O bien cree un proveedor eligiendo la planta en el formulario (útil cuando el filtro está en{' '}
              <span className="font-medium">Todas las plantas</span>).
            </p>
            <Button
              type="button"
              className="bg-stone-900 text-white hover:bg-stone-800"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo proveedor
            </Button>
          </div>
        ) : null}

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent className="sm:max-w-md border-stone-200 bg-white overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-stone-900">Nuevo proveedor</SheetTitle>
              <SheetDescription>
                Datos base del proveedor. El plazo predeterminado aplica al calcular vencimientos en entradas.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create_plant_all">Planta *</Label>
                <Select value={createPlantId || undefined} onValueChange={setCreatePlantId}>
                  <SelectTrigger id="create_plant_all" className="border-stone-300">
                    <SelectValue placeholder="Seleccione planta…" />
                  </SelectTrigger>
                  <SelectContent>
                    {plantOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code ? `${p.code} — ${p.name}` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_name">Nombre *</Label>
                <Input
                  id="create_name"
                  className="border-stone-300"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Razón social o nombre comercial"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="create_num">No. proveedor *</Label>
                  <Input
                    id="create_num"
                    type="number"
                    min={1}
                    max={99}
                    className={cn(
                      'tabular-nums',
                      createNumberParseError || createDuplicateNumberError
                        ? 'border-red-400 focus-visible:ring-red-200'
                        : 'border-stone-300'
                    )}
                    value={createProviderNumber}
                    onChange={(e) => setCreateProviderNumber(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    aria-invalid={!!(createNumberParseError || createDuplicateNumberError)}
                  />
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Entero del 1 al 99. Debe ser único por planta.
                  </p>
                  {(createNumberParseError || createDuplicateNumberError) && (
                    <p className="text-[11px] text-red-700">{createNumberParseError || createDuplicateNumberError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_letter">Letra</Label>
                  <Input
                    id="create_letter"
                    maxLength={1}
                    className={cn(
                      'uppercase',
                      createDuplicateLetterError
                        ? 'border-red-400 focus-visible:ring-red-200'
                        : 'border-stone-300'
                    )}
                    value={createLetter}
                    onChange={(e) =>
                      setCreateLetter(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
                    }
                    aria-invalid={!!createDuplicateLetterError}
                  />
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Opcional. Una letra A–Z; si la usa, debe ser única por planta.
                  </p>
                  {createDuplicateLetterError && (
                    <p className="text-[11px] text-red-700">{createDuplicateLetterError}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_internal">Código interno</Label>
                <Input
                  id="create_internal"
                  className="border-stone-300"
                  value={createInternalCode}
                  onChange={(e) => setCreateInternalCode(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2">
                <Label htmlFor="create_active" className="text-sm font-normal cursor-pointer">
                  Proveedor activo
                </Label>
                <Switch id="create_active" checked={createActive} onCheckedChange={setCreateActive} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_terms">Plazo de pago predeterminado</Label>
                <Select value={createPresetTerms} onValueChange={setCreatePresetTerms}>
                  <SelectTrigger id="create_terms" className="border-stone-300">
                    <SelectValue />
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
              {createPresetTerms === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="create_custom_days">Días</Label>
                  <Input
                    id="create_custom_days"
                    type="number"
                    min={0}
                    max={365}
                    className="border-stone-300 tabular-nums"
                    value={createCustomDays}
                    onChange={(e) => setCreateCustomDays(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              )}
            </div>
            <SheetFooter className="mt-8 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-stone-300"
                onClick={() => setCreateOpen(false)}
                disabled={createSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-stone-900 text-white hover:bg-stone-800"
                onClick={() => void saveCreate()}
                disabled={createSaving || createFormHasBlockingErrors}
              >
                {createSaving ? 'Guardando…' : 'Crear proveedor'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-stone-600" />
            Gestión de proveedores
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-xl">
            Alta de proveedores y plazo de pago predeterminado. Al revisar entradas, la fecha de vencimiento se calcula
            como fecha de entrada + estos días (ajustable en cada entrada).
          </p>
        </div>
        {canCreateSupplier ? (
          <Button
            type="button"
            className="shrink-0 bg-stone-900 text-white hover:bg-stone-800 shadow-sm"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo proveedor
          </Button>
        ) : null}
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
                      {canEditPaymentTerms ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => openEdit(s)}
                        >
                          Editar plazo
                        </Button>
                      ) : (
                        <span className="text-[11px] text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="px-3 py-10 text-center space-y-3">
              <p className="text-stone-500 text-sm">
                {search ? 'Sin resultados para la búsqueda.' : 'No hay proveedores en esta planta.'}
              </p>
              {canCreateSupplier && !search ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-stone-300"
                  onClick={openCreate}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear el primero
                </Button>
              ) : null}
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md border-stone-200 bg-white overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-stone-900">Nuevo proveedor</SheetTitle>
            <SheetDescription>
              Planta: <span className="font-medium text-stone-800">{plantLabel(workspacePlantId)}</span>. Podrá
              editar el plazo de pago después de crear el registro{canEditPaymentTerms ? '' : ' (solo ejecutivos u operaciones)'}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create_name_ctx">Nombre *</Label>
              <Input
                id="create_name_ctx"
                className="border-stone-300"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Razón social o nombre comercial"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="create_num_ctx">No. proveedor *</Label>
                <Input
                  id="create_num_ctx"
                  type="number"
                  min={1}
                  max={99}
                  className={cn(
                    'tabular-nums',
                    createNumberParseError || createDuplicateNumberError
                      ? 'border-red-400 focus-visible:ring-red-200'
                      : 'border-stone-300'
                  )}
                  value={createProviderNumber}
                  onChange={(e) => setCreateProviderNumber(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  aria-invalid={!!(createNumberParseError || createDuplicateNumberError)}
                />
                <p className="text-[11px] text-stone-500 leading-snug">
                  Entero del 1 al 99. Debe ser único por planta.
                </p>
                {(createNumberParseError || createDuplicateNumberError) && (
                  <p className="text-[11px] text-red-700">{createNumberParseError || createDuplicateNumberError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_letter_ctx">Letra</Label>
                <Input
                  id="create_letter_ctx"
                  maxLength={1}
                  className={cn(
                    'uppercase',
                    createDuplicateLetterError
                      ? 'border-red-400 focus-visible:ring-red-200'
                      : 'border-stone-300'
                  )}
                  value={createLetter}
                  onChange={(e) =>
                    setCreateLetter(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
                  }
                  aria-invalid={!!createDuplicateLetterError}
                />
                <p className="text-[11px] text-stone-500 leading-snug">
                  Opcional. Una letra A–Z; si la usa, debe ser única por planta.
                </p>
                {createDuplicateLetterError && (
                  <p className="text-[11px] text-red-700">{createDuplicateLetterError}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_internal_ctx">Código interno</Label>
              <Input
                id="create_internal_ctx"
                className="border-stone-300"
                value={createInternalCode}
                onChange={(e) => setCreateInternalCode(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2">
              <Label htmlFor="create_active_ctx" className="text-sm font-normal cursor-pointer">
                Proveedor activo
              </Label>
              <Switch id="create_active_ctx" checked={createActive} onCheckedChange={setCreateActive} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_terms_ctx">Plazo de pago predeterminado</Label>
              <Select value={createPresetTerms} onValueChange={setCreatePresetTerms}>
                <SelectTrigger id="create_terms_ctx" className="border-stone-300">
                  <SelectValue />
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
            {createPresetTerms === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="create_custom_days_ctx">Días</Label>
                <Input
                  id="create_custom_days_ctx"
                  type="number"
                  min={0}
                  max={365}
                  className="border-stone-300 tabular-nums"
                  value={createCustomDays}
                  onChange={(e) => setCreateCustomDays(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            )}
          </div>
          <SheetFooter className="mt-8 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-stone-300"
              onClick={() => setCreateOpen(false)}
              disabled={createSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-stone-900 text-white hover:bg-stone-800"
              onClick={() => void saveCreate()}
              disabled={createSaving || createFormHasBlockingErrors}
            >
              {createSaving ? 'Guardando…' : 'Crear proveedor'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
