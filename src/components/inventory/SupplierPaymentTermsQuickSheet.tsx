'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, Clock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PAYMENT_TERMS_PRESET_DAYS,
  formatPaymentTermsLabel,
} from '@/lib/procurement/paymentTermsLabels'

type SupplierRow = {
  id: string
  name: string
  provider_number: number
  default_payment_terms_days: number | null
  is_active: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantId: string | null
  /** When true, user can change plazos (EXECUTIVE / ADMIN_OPERATIONS). */
  canEdit: boolean
  /** Called after a successful save so the parent can refresh supplier data. */
  onTermsUpdated?: () => void
}

export default function SupplierPaymentTermsQuickSheet({
  open,
  onOpenChange,
  plantId,
  canEdit,
  onTermsUpdated,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [customForId, setCustomForId] = useState<string | null>(null)
  const [customDraft, setCustomDraft] = useState('')

  const load = useCallback(async () => {
    if (!plantId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/suppliers?plant_id=${plantId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch')
      const data = await res.json()
      setSuppliers(data.suppliers || [])
    } catch {
      toast.error('No se pudieron cargar los proveedores')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    if (open && plantId) void load()
  }, [open, plantId, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || String(s.provider_number).includes(q)
    )
  }, [suppliers, search])

  /** Valor controlado del Select: presets como "30", personalizado como "custom:34" para que el trigger muestre "Net 34", no "Otro…". */
  const selectValueFor = (s: SupplierRow) => {
    const raw = s.default_payment_terms_days
    if (raw === null || raw === undefined) return 'unset'
    const d = Number(raw)
    if (Number.isNaN(d)) return 'unset'
    if (PAYMENT_TERMS_PRESET_DAYS.includes(d as (typeof PAYMENT_TERMS_PRESET_DAYS)[number])) {
      return String(d)
    }
    return `custom:${d}`
  }

  /** Valor mostrado mientras el usuario edita días personalizados (evita que quede solo "Otro…"). */
  const selectControlledValue = (s: SupplierRow) => {
    if (customForId === s.id) return 'custom'
    return selectValueFor(s)
  }

  const applyPatch = async (supplierId: string, days: number | null) => {
    setSavingId(supplierId)
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_payment_terms_days: days,
          ...(plantId ? { plant_id: plantId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'No se pudo guardar')
        return
      }
      toast.success('Plazo actualizado')
      setSuppliers((prev) =>
        prev.map((r) =>
          r.id === supplierId ? { ...r, default_payment_terms_days: days } : r
        )
      )
      onTermsUpdated?.()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingId(null)
      setCustomForId(null)
      setCustomDraft('')
    }
  }

  const onSelectChange = (supplier: SupplierRow, value: string) => {
    if (!canEdit) return
    if (value === 'unset') {
      void applyPatch(supplier.id, null)
      return
    }
    if (value === 'custom') {
      setCustomForId(supplier.id)
      setCustomDraft(
        supplier.default_payment_terms_days != null
          ? String(supplier.default_payment_terms_days)
          : '30'
      )
      return
    }
    if (value.startsWith('custom:')) {
      const n = parseInt(value.slice('custom:'.length), 10)
      if (!Number.isNaN(n) && n === supplier.default_payment_terms_days) {
        return
      }
      if (!Number.isNaN(n)) void applyPatch(supplier.id, n)
      return
    }
    const n = parseInt(value, 10)
    if (!Number.isNaN(n)) void applyPatch(supplier.id, n)
  }

  const saveCustom = (supplier: SupplierRow) => {
    const n = parseInt(customDraft, 10)
    if (Number.isNaN(n) || n < 0 || n > 365) {
      toast.error('Ingrese días entre 0 y 365')
      return
    }
    void applyPatch(supplier.id, n)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-stone-200 bg-white">
        <SheetHeader>
          <SheetTitle className="text-stone-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-stone-600" />
            Plazos de pago por proveedor
          </SheetTitle>
          <SheetDescription>
            Planta actual: ajuste el plazo predeterminado (días desde la fecha de entrada). Al guardar, la revisión de
            precios abierta actualiza la lista y el vencimiento sugerido.
          </SheetDescription>
        </SheetHeader>

        {!plantId ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            No hay planta asociada a esta entrada.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {!canEdit && (
              <p className="text-xs text-stone-600 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                Solo lectura. Para editar plazos necesita rol Ejecutivo u Operaciones admin.; también puede usar{' '}
                <span className="font-medium text-stone-800">Centro de compras → Proveedores → Gestión</span>.
              </p>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" aria-hidden />
              <Input
                className="pl-9 border-stone-300 bg-white text-sm"
                placeholder="Buscar proveedor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="text-sm text-stone-500 py-6">Cargando…</p>
            ) : (
              <div className="rounded-lg border border-stone-200 bg-stone-50/50 overflow-hidden">
                <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100/60 text-left sticky top-0 z-[1]">
                        <th className="py-2 px-2 font-medium text-stone-700">#</th>
                        <th className="py-2 px-2 font-medium text-stone-700">Proveedor</th>
                        <th className="py-2 px-2 font-medium text-stone-700 whitespace-nowrap">Plazo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <React.Fragment key={s.id}>
                          <tr className="border-b border-stone-100 last:border-0 hover:bg-white/80">
                            <td className="py-2 px-2 font-mono tabular-nums text-stone-800 align-top">
                              {s.provider_number}
                            </td>
                            <td className="py-2 px-2 font-medium text-stone-900 min-w-0 max-w-[10rem]">
                              <span className="truncate block" title={s.name}>
                                {s.name}
                              </span>
                            </td>
                            <td className="py-2 px-2 align-top min-w-[9rem]">
                              {canEdit ? (
                                <Select
                                  value={selectControlledValue(s)}
                                  onValueChange={(v) => onSelectChange(s, v)}
                                  disabled={savingId === s.id}
                                >
                                  <SelectTrigger className="h-9 text-xs border-stone-300 min-w-[10.5rem]">
                                    {customForId === s.id ? (
                                      <SelectValue>
                                        {formatPaymentTermsLabel(
                                          s.default_payment_terms_days != null
                                            ? Number(s.default_payment_terms_days)
                                            : (() => {
                                                const n = parseInt(customDraft, 10)
                                                return Number.isNaN(n) ? 30 : n
                                              })()
                                        )}
                                      </SelectValue>
                                    ) : (
                                      <SelectValue placeholder="Plazo" />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unset">Sin configurar</SelectItem>
                                    {PAYMENT_TERMS_PRESET_DAYS.map((d) => (
                                      <SelectItem key={d} value={String(d)}>
                                        {formatPaymentTermsLabel(d)}
                                      </SelectItem>
                                    ))}
                                    {s.default_payment_terms_days != null &&
                                      !Number.isNaN(Number(s.default_payment_terms_days)) &&
                                      !PAYMENT_TERMS_PRESET_DAYS.includes(
                                        Number(s.default_payment_terms_days) as (typeof PAYMENT_TERMS_PRESET_DAYS)[number]
                                      ) && (
                                        <SelectItem value={`custom:${Number(s.default_payment_terms_days)}`}>
                                          {formatPaymentTermsLabel(Number(s.default_payment_terms_days))}
                                        </SelectItem>
                                      )}
                                    <SelectItem value="custom">Cambiar a otro plazo (días)…</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-[11px] font-normal border-0',
                                    s.default_payment_terms_days != null
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-stone-200 text-stone-600'
                                  )}
                                >
                                  {formatPaymentTermsLabel(s.default_payment_terms_days)}
                                </Badge>
                              )}
                            </td>
                          </tr>
                          {canEdit && customForId === s.id && (
                            <tr className="border-b border-stone-100 bg-stone-50/80">
                              <td colSpan={3} className="py-2 px-2">
                                <div className="flex flex-wrap items-end gap-2">
                                  <div className="flex-1 min-w-[120px]">
                                    <Label htmlFor={`custom-${s.id}`} className="text-xs text-stone-600">
                                      Días personalizado
                                    </Label>
                                    <Input
                                      id={`custom-${s.id}`}
                                      type="number"
                                      min={0}
                                      max={365}
                                      className="h-9 border-stone-300 tabular-nums"
                                      value={customDraft}
                                      onChange={(e) => setCustomDraft(e.target.value)}
                                      onWheel={(e) => e.currentTarget.blur()}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-sky-800 text-white hover:bg-sky-900"
                                    onClick={() => saveCustom(s)}
                                    disabled={savingId === s.id}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setCustomForId(null)
                                      setCustomDraft('')
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="px-3 py-8 text-center text-stone-500 text-sm">
                    {search ? 'Sin resultados.' : 'Sin proveedores en esta planta.'}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-stone-500">
              <Building2 className="h-4 w-4 shrink-0 mt-0.5 text-stone-400" aria-hidden />
              <span>
                El valor predeterminado al crear un proveedor es <strong className="font-medium text-stone-700">30 días</strong>{' '}
                (Net 30), salvo que indique otro plazo aquí o en Gestión de proveedores.
              </span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
