'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePlantContext } from '@/contexts/PlantContext'
import MaterialSelect, { type MaterialSelectChangeMeta } from './MaterialSelect'
import { toast } from 'sonner'
import {
  Combine,
  Plus,
  Trash2,
  ArrowDown,
  Loader2,
  AlertTriangle,
  History,
  Undo2,
  PackageCheck,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type InputRow = {
  key: number
  material_id: string
  material_name: string
  quantity_kg_str: string
}

type PreviewInput = {
  material_id: string
  quantity_kg: number
  available_kg: number
  estimated_cost: number
  sufficient: boolean
  using_current_layers: boolean
}

type PreviewResult = {
  inputs: PreviewInput[]
  total_input_cost: number
  output_quantity_kg: number
  blended_unit_cost: number
  blended_total_cost: number
  all_sufficient: boolean
  any_using_current_layers: boolean
}

type RecentCombination = {
  id: string
  combination_date: string
  output_quantity_kg: number
  output_unit_cost: number
  output_total_cost: number
  output_material?: { material_name: string } | null
  inputs?: Array<{ material?: { material_name: string } | null; quantity_kg: number }>
}

let keySeq = 0
const freshRow = (): InputRow => ({ key: ++keySeq, material_id: '', material_name: '', quantity_kg_str: '' })

const parseQty = (s: string): number => {
  const q = parseFloat(s.replace(',', '.'))
  return Number.isFinite(q) && q > 0 ? q : 0
}

const fmtMxn = (n: number, digits = 2) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
const fmtKg = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n) + ' kg'

export default function MaterialCombinationForm() {
  const { currentPlant } = usePlantContext()
  const plantId = currentPlant?.id ?? ''

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [inputRows, setInputRows] = useState<InputRow[]>([freshRow(), freshRow()])
  const [outputMaterialId, setOutputMaterialId] = useState('')
  const [outputMaterialName, setOutputMaterialName] = useState('')
  const [outputQtyStr, setOutputQtyStr] = useState('')
  const [outputQtyTouched, setOutputQtyTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const [recent, setRecent] = useState<RecentCombination[]>([])
  const [undoingId, setUndoingId] = useState<string | null>(null)

  const totalInputKg = inputRows.reduce((s, r) => s + parseQty(r.quantity_kg_str), 0)

  // Output qty defaults to the sum of inputs until the user edits it explicitly.
  useEffect(() => {
    if (!outputQtyTouched) {
      setOutputQtyStr(totalInputKg > 0 ? String(totalInputKg) : '')
    }
  }, [totalInputKg, outputQtyTouched])

  const addRow = () => setInputRows((r) => [...r, freshRow()])
  const removeRow = (key: number) =>
    setInputRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r))
  const updateRow = (key: number, patch: Partial<Omit<InputRow, 'key'>>) =>
    setInputRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  // ── Recent combinations ─────────────────────────────────────────────────────
  const loadRecent = useCallback(async () => {
    if (!plantId) return
    try {
      const res = await fetch(`/api/inventory/combinations?plant_id=${plantId}&limit=5`)
      const json = await res.json()
      if (res.ok) setRecent((json.data as RecentCombination[]) ?? [])
    } catch {
      /* non-blocking */
    }
  }, [plantId])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  // ── Live preview (debounced) ────────────────────────────────────────────────
  const previewSeq = useRef(0)
  useEffect(() => {
    const validInputs = inputRows
      .filter((r) => r.material_id && parseQty(r.quantity_kg_str) > 0)
      .map((r) => ({ material_id: r.material_id, quantity_kg: parseQty(r.quantity_kg_str) }))
    const outQty = parseQty(outputQtyStr)

    if (!plantId || validInputs.length === 0) {
      setPreview(null)
      return
    }

    const seq = ++previewSeq.current
    setPreviewing(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/inventory/combinations/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plant_id: plantId,
            combination_date: date,
            output_quantity_kg: outQty,
            inputs: validInputs,
          }),
        })
        const json = await res.json()
        if (seq === previewSeq.current) {
          setPreview(res.ok ? (json.data as PreviewResult) : null)
        }
      } catch {
        if (seq === previewSeq.current) setPreview(null)
      } finally {
        if (seq === previewSeq.current) setPreviewing(false)
      }
    }, 450)

    return () => clearTimeout(t)
  }, [inputRows, outputQtyStr, date, plantId])

  // Map preview results back to input rows by material_id (preserves order)
  const previewByMaterial = new Map((preview?.inputs ?? []).map((p) => [p.material_id, p]))

  const outputQty = parseQty(outputQtyStr)
  const diffKg = outputQty - totalInputKg
  // Only block submission if truly insufficient — not when we're using current layers as fallback
  const hasInsufficient = preview
    ? preview.inputs.some((p) => !p.sufficient && !p.using_current_layers)
    : false

  const canSubmit =
    !!plantId &&
    !!outputMaterialId &&
    outputQty > 0 &&
    inputRows.every((r) => r.material_id && parseQty(r.quantity_kg_str) > 0) &&
    !inputRows.some((r) => r.material_id === outputMaterialId) &&
    !hasInsufficient

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      if (inputRows.some((r) => r.material_id === outputMaterialId)) {
        toast.error('El material de salida debe ser distinto a los insumos')
      } else if (hasInsufficient) {
        toast.error('Inventario insuficiente en uno o más insumos')
      } else {
        toast.error('Complete todos los campos (insumos, material de salida y cantidad)')
      }
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
          inputs: inputRows.map((r) => ({ material_id: r.material_id, quantity_kg: parseQty(r.quantity_kg_str) })),
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al registrar')

      toast.success(
        `Combinación registrada — ${outputMaterialName || 'material'} a ${fmtMxn(json.data.output_unit_cost, 4)}/kg`,
      )
      // Reset
      setInputRows([freshRow(), freshRow()])
      setOutputMaterialId('')
      setOutputMaterialName('')
      setOutputQtyStr('')
      setOutputQtyTouched(false)
      setNotes('')
      setPreview(null)
      void loadRecent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onUndo = async (id: string) => {
    if (!confirm('¿Deshacer esta combinación? Se revertirán los insumos y el material resultante.')) return
    setUndoingId(id)
    try {
      const res = await fetch(`/api/inventory/combinations/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo deshacer')
      toast.success('Combinación revertida')
      void loadRecent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al deshacer')
    } finally {
      setUndoingId(null)
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
            Mezcla insumos en un material resultante. El costo FIFO (incluido el flete) se transfiere
            automáticamente al material combinado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Date */}
            <div className="flex items-center gap-3">
              <Label htmlFor="comb-date" className="shrink-0">Fecha</Label>
              <Input
                id="comb-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="max-w-[170px]"
              />
              <span className="text-xs text-stone-500">Puede ser una fecha pasada.</span>
            </div>

            {/* ── Insumos ── */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                  Insumos (se consumen)
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Insumo
                </Button>
              </div>

              {inputRows.map((row) => {
                const p = previewByMaterial.get(row.material_id)
                const qty = parseQty(row.quantity_kg_str)
                const insufficient = !!p && qty > 0 && !p.sufficient
                return (
                  <div key={row.key} className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <MaterialSelect
                          value={row.material_id}
                          onChange={(v, meta?: MaterialSelectChangeMeta) =>
                            updateRow(row.key, { material_id: v, material_name: meta?.material_name ?? '' })
                          }
                          plantId={plantId}
                          disabled={!plantId}
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <Input
                          inputMode="decimal"
                          value={row.quantity_kg_str}
                          onChange={(e) => updateRow(row.key, { quantity_kg_str: e.target.value })}
                          placeholder="kg"
                          className={cn(insufficient && 'border-red-400 focus-visible:ring-red-400')}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-9 w-9"
                        onClick={() => removeRow(row.key)}
                        disabled={inputRows.length === 1}
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4 text-stone-400" />
                      </Button>
                    </div>

                    {/* Per-input live feedback */}
                    {row.material_id && (
                      <div className="space-y-1 pl-0.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={cn('flex items-center gap-1', insufficient ? 'text-red-600' : 'text-stone-500')}>
                            {insufficient && <AlertTriangle className="h-3 w-3" />}
                            {p ? (
                              <>Disponible: <strong>{fmtKg(p.available_kg)}</strong></>
                            ) : (
                              <span className="text-stone-400">Disponible: —</span>
                            )}
                          </span>
                          {p && qty > 0 && p.sufficient && (
                            <span className="text-stone-600">
                              Costo FIFO ≈ <strong>{fmtMxn(p.estimated_cost)}</strong>
                            </span>
                          )}
                          {insufficient && (
                            <span className="text-red-600 font-medium">Faltan {fmtKg(qty - p.available_kg)}</span>
                          )}
                        </div>
                        {p?.using_current_layers && (
                          <div className="flex items-start gap-1.5 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-1">
                            <Info className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>Las capas de esa fecha ya se consumieron — se usarán las capas disponibles actuales con su costo real.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="flex justify-end text-xs text-stone-500 pt-1">
                Total insumos: <strong className="ml-1 text-stone-700">{fmtKg(totalInputKg)}</strong>
              </div>
            </div>

            {/* ── Combine arrow ── */}
            <div className="flex flex-col items-center gap-1 text-violet-600">
              <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center">
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDown className="h-4 w-4" />}
              </div>
              <span className="text-[11px] text-stone-400 uppercase tracking-wider">se combinan en</span>
            </div>

            {/* ── Resultado ── */}
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
              <span className="text-sm font-semibold text-violet-800 uppercase tracking-wide">
                Resultado (se produce)
              </span>
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <MaterialSelect
                    value={outputMaterialId}
                    onChange={(v, meta?: MaterialSelectChangeMeta) => {
                      setOutputMaterialId(v)
                      setOutputMaterialName(meta?.material_name ?? '')
                    }}
                    plantId={plantId}
                    disabled={!plantId}
                  />
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    inputMode="decimal"
                    value={outputQtyStr}
                    onChange={(e) => {
                      setOutputQtyTouched(true)
                      setOutputQtyStr(e.target.value)
                    }}
                    placeholder="kg"
                  />
                </div>
                <div className="w-9 shrink-0" />
              </div>

              {/* Blended cost + yield */}
              <div className="space-y-1.5">
                {preview && outputQty > 0 && preview.all_sufficient && (
                  <div className="flex items-center justify-between rounded-lg bg-white border border-violet-200 px-3 py-2">
                    <span className="text-xs text-stone-500">Costo combinado</span>
                    <span className="text-sm font-semibold text-violet-900">
                      {fmtMxn(preview.blended_total_cost)}{' '}
                      <span className="text-stone-400 font-normal">→</span>{' '}
                      <span className="text-violet-700">{fmtMxn(preview.blended_unit_cost, 4)}/kg</span>
                    </span>
                  </div>
                )}
                {outputQty > 0 && totalInputKg > 0 && Math.abs(diffKg) >= 0.01 && (
                  <p className={cn('text-xs', diffKg < 0 ? 'text-amber-700' : 'text-emerald-700')}>
                    {diffKg < 0
                      ? `Merma ${fmtKg(Math.abs(diffKg))} (${((Math.abs(diffKg) / totalInputKg) * 100).toFixed(1)}%) — sube el costo unitario`
                      : `Rendimiento +${fmtKg(diffKg)} (${((diffKg / totalInputKg) * 100).toFixed(1)}%) — baja el costo unitario`}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="comb-notes">Notas (opcional)</Label>
              <Textarea id="comb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <Button type="submit" disabled={loading || !canSubmit} className="w-full">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</>
              ) : (
                <><PackageCheck className="h-4 w-4 mr-2" /> Registrar combinación</>
              )}
            </Button>
            {hasInsufficient && (
              <p className="text-xs text-red-600 text-center -mt-2">
                Ajuste las cantidades: hay insumos sin inventario suficiente.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Recent ── */}
      {recent.length > 0 && (
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-stone-700">
              <History className="h-4 w-4 text-stone-500" />
              Combinaciones recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-stone-200 text-stone-500">
                      {c.combination_date}
                    </Badge>
                    <span className="font-medium text-stone-800 text-sm truncate">
                      {c.output_material?.material_name ?? 'Material'}
                    </span>
                    <span className="text-xs text-stone-500">{fmtKg(Number(c.output_quantity_kg))}</span>
                    <span className="text-xs text-violet-700 font-medium">
                      {fmtMxn(Number(c.output_unit_cost), 4)}/kg
                    </span>
                  </div>
                  {c.inputs && c.inputs.length > 0 && (
                    <p className="text-[11px] text-stone-400 truncate mt-0.5">
                      {c.inputs.map((i) => `${i.material?.material_name ?? '?'} (${fmtKg(Number(i.quantity_kg))})`).join(' + ')}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-stone-500 hover:text-red-600 h-8"
                  onClick={() => onUndo(c.id)}
                  disabled={undoingId === c.id}
                >
                  {undoingId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><Undo2 className="h-3.5 w-3.5 mr-1" /> Deshacer</>
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
