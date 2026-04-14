'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpecimenTypeSpec } from '@/types/quality'
import { qualityHubPrimaryButtonClass, qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export default function SpecimenSpecsConfigSheet({ open, onOpenChange, onSaved }: Props) {
  const [specs, setSpecs] = useState<SpecimenTypeSpec[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftFactors, setDraftFactors] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({
    tipo_muestra: 'CUBO' as SpecimenTypeSpec['tipo_muestra'],
    dimension_key: '',
    dimension_label: '',
    correction_factor: '1.0000',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quality/specimen-type-specs', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al cargar')
      const list = (j.specs || []) as SpecimenTypeSpec[]
      setSpecs(list)
      const drafts: Record<string, string> = {}
      list.forEach((s) => {
        drafts[s.id] = String(s.correction_factor)
      })
      setDraftFactors(drafts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function saveSpec(id: string) {
    const raw = draftFactors[id]
    const correction_factor = parseFloat(raw)
    if (!Number.isFinite(correction_factor) || correction_factor <= 0 || correction_factor > 2) {
      setError('Factor inválido')
      return
    }
    setSavingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/quality/specimen-type-specs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correction_factor }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      await load()
      onSaved?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingId(null)
    }
  }

  async function addSpec() {
    const dimension_key = newRow.dimension_key.trim()
    const dimension_label = newRow.dimension_label.trim()
    const correction_factor = parseFloat(newRow.correction_factor)
    if (!dimension_key || !dimension_label) {
      setError('Dimensión y etiqueta son obligatorios')
      return
    }
    if (!Number.isFinite(correction_factor) || correction_factor <= 0 || correction_factor > 2) {
      setError('Factor inválido')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/quality/specimen-type-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_muestra: newRow.tipo_muestra,
          dimension_key,
          dimension_label,
          correction_factor,
          is_default: false,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al crear')
      setNewRow({
        tipo_muestra: 'CUBO',
        dimension_key: '',
        dimension_label: '',
        correction_factor: '1.0000',
      })
      await load()
      onSaved?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Especificaciones de Probetas</SheetTitle>
          <SheetDescription>
            Factores de corrección por tipo y dimensión de probeta. Los cambios en esta tabla aplican a ensayos
            futuros salvo que se reasigne una fila a un ensayo existente.
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-900 mt-4">{error}</div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : (
            <div className="rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200">
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600 px-3 py-2">
                      Tipo
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600 px-3 py-2">
                      Dimensión
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600 px-3 py-2">
                      Factor
                    </th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wide text-stone-600 px-2 py-2 w-10">
                      Def.
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wide text-stone-600 px-3 py-2">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {specs.map((s) => (
                    <tr key={s.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 align-middle">
                        <Badge
                          variant="outline"
                          className="bg-stone-50 text-stone-700 border-stone-300 text-[10px]"
                        >
                          {s.tipo_muestra}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle font-semibold text-stone-900">{s.dimension_label}</td>
                      <td className="px-3 py-2 align-middle">
                        <Input
                          className="h-8 w-20 text-center font-mono tabular-nums text-xs"
                          value={draftFactors[s.id] ?? String(s.correction_factor)}
                          onChange={(e) => setDraftFactors((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2 align-middle text-center">
                        <Star
                          className={cn(
                            'h-4 w-4 mx-auto',
                            s.is_default ? 'text-amber-500 fill-amber-200' : 'text-stone-300'
                          )}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <Button
                          type="button"
                          size="sm"
                          className={cn(qualityHubPrimaryButtonClass, 'h-7 text-xs')}
                          disabled={savingId === s.id}
                          onClick={() => saveSpec(s.id)}
                        >
                          {savingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-stone-200 bg-stone-50/50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Agregar especificación</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border border-stone-200 bg-white text-sm px-2"
              value={newRow.tipo_muestra}
              onChange={(e) =>
                setNewRow((r) => ({ ...r, tipo_muestra: e.target.value as SpecimenTypeSpec['tipo_muestra'] }))
              }
            >
              <option value="CUBO">CUBO</option>
              <option value="CILINDRO">CILINDRO</option>
              <option value="VIGA">VIGA</option>
            </select>
            <Input
              placeholder="Clave (ej. 10)"
              className="h-9 text-sm"
              value={newRow.dimension_key}
              onChange={(e) => setNewRow((r) => ({ ...r, dimension_key: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Etiqueta (ej. Cubo 12x12 cm)"
            className="h-9 text-sm"
            value={newRow.dimension_label}
            onChange={(e) => setNewRow((r) => ({ ...r, dimension_label: e.target.value }))}
          />
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              step="0.0001"
              className="h-9 w-28 text-center font-mono text-sm"
              value={newRow.correction_factor}
              onChange={(e) => setNewRow((r) => ({ ...r, correction_factor: e.target.value }))}
            />
            <Button
              type="button"
              variant="outline"
              className={cn(qualityHubOutlineNeutralClass, 'h-9')}
              disabled={adding}
              onClick={addSpec}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar'}
            </Button>
          </div>
        </div>

        <SheetFooter className="mt-6 flex-col items-stretch gap-2 sm:flex-col">
          <p className="text-[11px] text-stone-500">
            Los ensayos ya registrados conservan su factor guardado hasta que se edite el ensayo o se vuelva a
            aplicar una especificación.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
