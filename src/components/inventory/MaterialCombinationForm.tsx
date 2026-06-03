'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePlantContext } from '@/contexts/PlantContext'
import MaterialSelect from './MaterialSelect'
import { toast } from 'sonner'
import { Combine, Plus, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MaterialCombinationInputSpec } from '@/types/materialCombination'

type InputRow = {
  key: number
  material_id: string
  quantity_kg_str: string
}

type CombinationResult = {
  combination_id: string
  output_unit_cost: number
  output_total_cost: number
  input_costs: Array<{ material_id: string; quantity_kg: number; total_cost: number }>
}

let keySeq = 0

function freshRow(): InputRow {
  return { key: ++keySeq, material_id: '', quantity_kg_str: '' }
}

function formatMxn(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n)
}

function formatKg(n: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n) + ' kg'
}

export default function MaterialCombinationForm() {
  const { currentPlant } = usePlantContext()
  const plantId = currentPlant?.id ?? ''

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [inputRows, setInputRows] = useState<InputRow[]>([freshRow()])
  const [outputMaterialId, setOutputMaterialId] = useState('')
  const [outputQtyStr, setOutputQtyStr] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CombinationResult | null>(null)

  const addRow = () => setInputRows((r) => [...r, freshRow()])
  const removeRow = (key: number) =>
    setInputRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r))
  const updateRow = (key: number, patch: Partial<Omit<InputRow, 'key'>>) =>
    setInputRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const totalInputKg = inputRows.reduce((s, r) => {
    const q = parseFloat(r.quantity_kg_str.replace(',', '.'))
    return s + (Number.isFinite(q) && q > 0 ? q : 0)
  }, 0)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)

    const outputQty = parseFloat(outputQtyStr.replace(',', '.'))
    if (!plantId) {
      toast.error('No hay planta seleccionada')
      return
    }
    if (!outputMaterialId) {
      toast.error('Seleccione el material de salida')
      return
    }
    if (!Number.isFinite(outputQty) || outputQty <= 0) {
      toast.error('Ingrese una cantidad de salida válida')
      return
    }

    const inputs: MaterialCombinationInputSpec[] = []
    for (const row of inputRows) {
      const q = parseFloat(row.quantity_kg_str.replace(',', '.'))
      if (!row.material_id) {
        toast.error('Seleccione el material para todas las entradas')
        return
      }
      if (!Number.isFinite(q) || q <= 0) {
        toast.error('Ingrese una cantidad válida para todas las entradas')
        return
      }
      inputs.push({ material_id: row.material_id, quantity_kg: q })
    }

    if (inputs.some((i) => i.material_id === outputMaterialId)) {
      toast.error('El material de salida debe ser distinto a los materiales de entrada')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/inventory/combinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plantId,
          combination_date: date,
          output_material_id: outputMaterialId,
          output_quantity_kg: outputQty,
          inputs,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al registrar')
      }
      setResult(json.data as CombinationResult)
      toast.success('Combinación registrada con costo FIFO correcto.')
      // Reset form
      setInputRows([freshRow()])
      setOutputMaterialId('')
      setOutputQtyStr('')
      setNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-stone-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-stone-900">
            <Combine className="h-5 w-5 text-violet-700" />
            Combinación de materiales
          </CardTitle>
          <CardDescription>
            Combina uno o más materiales en un nuevo material. El costo FIFO (incluyendo flete) de
            los insumos se transfiere al material resultante. La cantidad de salida puede diferir de
            la suma de entradas para reflejar mermas o rendimiento real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="comb-date">Fecha de combinación</Label>
              <Input
                id="comb-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="max-w-[180px]"
              />
              <p className="text-xs text-stone-500">
                Puede ser una fecha pasada — el sistema toma las capas FIFO disponibles a esa fecha.
              </p>
            </div>

            {/* Input materials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Materiales de entrada</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Agregar
                </Button>
              </div>

              {inputRows.map((row, idx) => (
                <div key={row.key} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    {idx === 0 && <Label className="text-xs text-stone-600">Material</Label>}
                    <MaterialSelect
                      value={row.material_id}
                      onChange={(v) => updateRow(row.key, { material_id: v })}
                      plantId={plantId}
                      disabled={!plantId}
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    {idx === 0 && <Label className="text-xs text-stone-600">Cantidad (kg)</Label>}
                    <Input
                      inputMode="decimal"
                      value={row.quantity_kg_str}
                      onChange={(e) => updateRow(row.key, { quantity_kg_str: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('shrink-0', idx === 0 && 'mt-5')}
                    onClick={() => removeRow(row.key)}
                    disabled={inputRows.length === 1}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-stone-400" />
                  </Button>
                </div>
              ))}

              {totalInputKg > 0 && (
                <p className="text-xs text-stone-500">
                  Total de entradas: <strong>{formatKg(totalInputKg)}</strong>
                </p>
              )}
            </div>

            {/* Arrow divider */}
            <div className="flex items-center gap-3 text-stone-400">
              <div className="flex-1 border-t border-dashed border-stone-300" />
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div className="flex-1 border-t border-dashed border-stone-300" />
            </div>

            {/* Output material */}
            <div className="space-y-4">
              <Label className="text-base">Material de salida</Label>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-stone-600">Material resultante</Label>
                  <MaterialSelect
                    value={outputMaterialId}
                    onChange={setOutputMaterialId}
                    plantId={plantId}
                    disabled={!plantId}
                  />
                </div>
                <div className="w-36 space-y-1">
                  <Label className="text-xs text-stone-600">Cantidad (kg)</Label>
                  <Input
                    inputMode="decimal"
                    value={outputQtyStr}
                    onChange={(e) => setOutputQtyStr(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="w-8 shrink-0" />
              </div>
              {totalInputKg > 0 && outputQtyStr && (() => {
                const outQ = parseFloat(outputQtyStr.replace(',', '.'))
                if (!Number.isFinite(outQ) || outQ <= 0) return null
                const diff = outQ - totalInputKg
                const pct = (diff / totalInputKg) * 100
                if (Math.abs(diff) < 0.01) return null
                return (
                  <p className={cn('text-xs', diff < 0 ? 'text-amber-700' : 'text-emerald-700')}>
                    {diff < 0
                      ? `Merma: ${formatKg(Math.abs(diff))} (${Math.abs(pct).toFixed(1)}%) — el costo unitario del resultado será mayor`
                      : `Rendimiento extra: ${formatKg(diff)} (${pct.toFixed(1)}%) — el costo unitario del resultado será menor`}
                  </p>
                )
              })()}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <Button
              type="submit"
              disabled={loading || !plantId}
              className="w-full sm:w-auto"
            >
              {loading ? 'Procesando…' : 'Registrar combinación'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result panel */}
      {result && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Combinación registrada
            </div>
            <div className="text-sm text-emerald-900 space-y-1">
              <div>
                <span className="font-medium">Costo unitario resultante:</span>{' '}
                {formatMxn(result.output_unit_cost)}/kg (costo total:{' '}
                {formatMxn(result.output_total_cost)})
              </div>
              <div className="pt-1 text-xs text-emerald-800 space-y-0.5">
                {result.input_costs.map((ic, i) => (
                  <div key={i}>
                    Entrada {i + 1}: {formatKg(ic.quantity_kg)} → costo FIFO{' '}
                    {formatMxn(ic.total_cost)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
