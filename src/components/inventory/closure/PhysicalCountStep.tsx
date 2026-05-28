'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Scale,
  Paperclip,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react'
import type {
  InventoryClosureMaterial,
  PhysicalCountInput,
  PhysicalCountUnit,
  InventoryClosureEvidence,
} from '@/types/inventoryClosure'
import { convertToKg } from '@/lib/inventory/closureVolumetricWeight'
import { cn } from '@/lib/utils'

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

function varianceBadge(pct: number | null, threshold: number) {
  if (pct == null) return null
  const abs = Math.abs(pct)
  if (abs <= threshold) return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</Badge>
  return <Badge className="bg-red-50 text-red-700 border-red-200">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</Badge>
}

interface RowState {
  value: string
  unit: PhysicalCountUnit
  volW: string
  volSource: string
  qualityStudyId?: string
  expanded: boolean
  uploading: boolean
  evidence: InventoryClosureEvidence[]
}

interface Props {
  closureId: string
  materials: InventoryClosureMaterial[]
  thresholdPct: number
  onSaved: () => void
}

export default function PhysicalCountStep({ closureId, materials, thresholdPct, onSaved }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const m of materials) {
      init[m.material_id] = {
        value: m.physical_count_value != null ? String(m.physical_count_value) : '',
        unit: (m.physical_count_unit as PhysicalCountUnit) ?? 'kg',
        volW: m.volumetric_weight_kg_per_m3 != null ? String(m.volumetric_weight_kg_per_m3) : '',
        volSource: m.volumetric_weight_source ?? '',
        qualityStudyId: m.quality_study_id ?? undefined,
        expanded: false,
        uploading: false,
        evidence: m.evidence ?? [],
      }
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRow(materialId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [materialId]: { ...prev[materialId], ...patch } }))
  }

  function computeKg(materialId: string): number | null {
    const row = rows[materialId]
    if (!row) return null
    const val = parseFloat(row.value)
    if (!isFinite(val) || val < 0) return null
    const volW = parseFloat(row.volW)
    return convertToKg(val, row.unit, isFinite(volW) && volW > 0 ? volW : null)
  }

  function computeVariancePct(materialId: string, theoretical: number): number | null {
    const physKg = computeKg(materialId)
    if (physKg == null || theoretical === 0) return null
    return ((physKg - theoretical) / Math.abs(theoretical)) * 100
  }

  async function handleEvidenceUpload(materialId: string, file: File) {
    updateRow(materialId, { uploading: true })
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('material_id', materialId)
      const res = await fetch(`/api/inventory/closures/${closureId}/evidence`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al subir archivo')
      updateRow(materialId, {
        evidence: [...(rows[materialId]?.evidence ?? []), data.evidence],
        uploading: false,
      })
    } catch (err) {
      console.error(err)
      updateRow(materialId, { uploading: false })
    }
  }

  function removeEvidence(materialId: string, evidenceId: string) {
    const current = rows[materialId]?.evidence ?? []
    updateRow(materialId, { evidence: current.filter((e) => e.id !== evidenceId) })
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const counts: PhysicalCountInput[] = materials
        .filter((m) => rows[m.material_id]?.value !== '')
        .map((m) => {
          const row = rows[m.material_id]
          const volW = parseFloat(row.volW)
          return {
            material_id: m.material_id,
            physical_count_value: parseFloat(row.value),
            physical_count_unit: row.unit,
            ...(isFinite(volW) && volW > 0
              ? {
                  volumetric_weight_kg_per_m3: volW,
                  volumetric_weight_source: (row.volSource as any) || 'closure_override',
                  quality_study_id: row.qualityStudyId,
                }
              : {}),
          }
        })

      if (counts.length === 0) throw new Error('Ingresa al menos un conteo físico')

      const res = await fetch(`/api/inventory/closures/${closureId}/physical-count`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const allFilled = materials.every((m) => rows[m.material_id]?.value !== '')

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Ingresa el conteo físico real de cada material. Para agregados medidos en m³ elige la unidad
        m³ y confirma el peso volumétrico sugerido por el estudio de calidad.
      </p>

      <div className="space-y-3">
        {materials.map((mat) => {
          const row = rows[mat.material_id]
          if (!row) return null
          const physKg = computeKg(mat.material_id)
          const varPct = computeVariancePct(mat.material_id, mat.theoretical_final_kg)
          const needsVolW = row.unit === 'm3'
          const volWValid = !needsVolW || (parseFloat(row.volW) > 0)
          const isM3Missing = needsVolW && !volWValid

          return (
            <div key={mat.material_id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50"
                onClick={() => updateRow(mat.material_id, { expanded: !row.expanded })}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Scale className="h-4 w-4 text-stone-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {mat.material?.material_name ?? mat.material_id}
                    </p>
                    <p className="text-xs text-stone-500">
                      Teórico: {fmtKg(mat.theoretical_final_kg)}
                      {physKg != null && (
                        <> · Físico: <span className="font-medium text-stone-700">{fmtKg(physKg)}</span></>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {varPct != null && varianceBadge(varPct, thresholdPct)}
                  {row.value !== '' && !isM3Missing
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <span className="h-4 w-4 rounded-full border-2 border-stone-300" />}
                  {row.expanded
                    ? <ChevronUp className="h-4 w-4 text-stone-400" />
                    : <ChevronDown className="h-4 w-4 text-stone-400" />}
                </div>
              </div>

              {row.expanded && (
                <div className="border-t border-stone-100 px-4 py-4 space-y-4 bg-[#f5f3f0]/40">
                  {/* Count input */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-stone-600 mb-1 block">Conteo físico</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.value}
                        onChange={(e) => updateRow(mat.material_id, { value: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-600 mb-1 block">Unidad</label>
                      <select
                        value={row.unit}
                        onChange={(e) => updateRow(mat.material_id, { unit: e.target.value as PhysicalCountUnit })}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                      >
                        <option value="kg">kg</option>
                        <option value="m3">m³</option>
                        <option value="ton">ton</option>
                        <option value="unit">unidad</option>
                      </select>
                    </div>
                  </div>

                  {/* Volumetric weight (only for m³) */}
                  {needsVolW && (
                    <div>
                      <label className="text-xs font-medium text-stone-600 mb-1 block">
                        Peso volumétrico (kg/m³)
                        {row.volSource === 'quality_study' && (
                          <span className="ml-2 text-emerald-600 font-normal">· Sugerido por estudio de calidad</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={row.volW}
                        onChange={(e) =>
                          updateRow(mat.material_id, {
                            volW: e.target.value,
                            volSource: 'closure_override',
                          })
                        }
                        placeholder="ej. 1620"
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]',
                          isM3Missing ? 'border-red-300' : 'border-stone-300',
                        )}
                      />
                      {isM3Missing && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Requerido para convertir m³ a kg
                        </p>
                      )}
                      {physKg != null && row.value !== '' && (
                        <p className="text-xs text-stone-500 mt-1">
                          = <span className="font-medium text-stone-700">{fmtKg(physKg)}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Evidence upload */}
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-2 block">
                      Evidencia fotográfica
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {row.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700"
                        >
                          <Paperclip className="h-3 w-3 text-stone-400" />
                          <span className="max-w-[140px] truncate">{ev.original_name}</span>
                          <button
                            type="button"
                            onClick={() => removeEvidence(mat.material_id, ev.id)}
                            className="text-stone-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors">
                        <Paperclip className="h-3 w-3" />
                        {row.uploading ? 'Subiendo...' : 'Adjuntar foto'}
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*,.pdf"
                          disabled={row.uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleEvidenceUpload(mat.material_id, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">
          {materials.filter((m) => rows[m.material_id]?.value !== '').length} / {materials.length} materiales con conteo
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
        >
          {saving ? 'Guardando...' : 'Guardar conteos y continuar'}
        </Button>
      </div>
    </div>
  )
}
