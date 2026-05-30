'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquareWarning, CheckCircle2, ScanLine } from 'lucide-react'
import type { InventoryClosureMaterial } from '@/types/inventoryClosure'

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

interface Props {
  closureId: string
  materials: InventoryClosureMaterial[]
  thresholdPct: number
  onSaved: () => void
  onEditPhysicalCount?: () => void
}

export default function JustificationStep({
  closureId,
  materials,
  thresholdPct,
  onSaved,
  onEditPhysicalCount,
}: Props) {
  const requiring = materials.filter((m) => m.requires_justification)
  const optional = materials.filter((m) => !m.requires_justification && Math.abs(m.variance_kg ?? 0) > 0.001)

  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const m of materials) {
      if (m.requires_justification || Math.abs(m.variance_kg ?? 0) > 0.001) {
        init[m.material_id] = m.justification_text ?? ''
      }
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allRequiredFilled = requiring.every((m) => (texts[m.material_id] ?? '').trim().length > 0)

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const toSave = Object.entries(texts)
        .filter(([, t]) => t.trim())
        .map(([material_id, justification_text]) => ({ material_id, justification_text: justification_text.trim() }))

      if (toSave.length === 0 && requiring.length > 0) {
        throw new Error('Completa las justificaciones requeridas antes de continuar')
      }

      if (toSave.length > 0) {
        const res = await fetch(`/api/inventory/closures/${closureId}/justifications`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ justifications: toSave }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      }

      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const renderMaterial = (m: InventoryClosureMaterial, required: boolean) => (
    <div key={m.material_id} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-900">{m.material?.material_name ?? m.material_id}</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Varianza: {(m.variance_kg ?? 0) > 0 ? '+' : ''}{fmtKg(m.variance_kg)}
            {m.variance_pct != null && (
              <> ({m.variance_pct > 0 ? '+' : ''}{m.variance_pct.toFixed(2)}%)</>
            )}
          </p>
        </div>
        {required ? (
          <span className="shrink-0 text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            Requerida
          </span>
        ) : (
          <span className="shrink-0 text-xs text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
            Opcional
          </span>
        )}
      </div>
      <textarea
        value={texts[m.material_id] ?? ''}
        onChange={(e) => setTexts((prev) => ({ ...prev, [m.material_id]: e.target.value }))}
        rows={3}
        placeholder="Explica la causa de la varianza..."
        className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {requiring.length === 0 && optional.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-emerald-800 font-medium">No se requieren justificaciones</p>
          <p className="text-sm text-emerald-700 mt-1">
            Todas las varianzas están dentro del umbral del {thresholdPct}%.
          </p>
        </div>
      ) : (
        <>
          {requiring.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-4 w-4 text-red-500" />
                <p className="text-sm font-medium text-stone-800">
                  Justificaciones requeridas ({requiring.length})
                </p>
                <span className="text-xs text-stone-500">— varianza &gt; {thresholdPct}%</span>
              </div>
              {requiring.map((m) => renderMaterial(m, true))}
            </div>
          )}

          {optional.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-stone-600">Justificaciones opcionales ({optional.length})</p>
              {optional.map((m) => renderMaterial(m, false))}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {onEditPhysicalCount ? (
          <Button
            type="button"
            variant="outline"
            onClick={onEditPhysicalCount}
            className="gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Editar conteo físico
          </Button>
        ) : (
          <span />
        )}
        <Button
          onClick={handleSave}
          disabled={saving || !allRequiredFilled}
          className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
        >
          {saving ? 'Guardando...' : 'Guardar y continuar'}
        </Button>
      </div>
    </div>
  )
}
