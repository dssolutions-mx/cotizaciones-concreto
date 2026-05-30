'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, TrendingUp, TrendingDown, Minus, ScanLine } from 'lucide-react'
import type { InventoryClosureMaterial } from '@/types/inventoryClosure'

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

interface Props {
  materials: InventoryClosureMaterial[]
  thresholdPct: number
  onConfirm: () => void
  onEditPhysicalCount?: () => void
  saving: boolean
}

export default function ReconciliationStep({
  materials,
  thresholdPct,
  onConfirm,
  onEditPhysicalCount,
  saving,
}: Props) {
  const withVariance = materials.filter((m) => Math.abs(m.variance_kg ?? 0) > 0.001)
  const zeroVariance = materials.filter((m) => Math.abs(m.variance_kg ?? 0) <= 0.001)

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">
        Los siguientes ajustes se crearán automáticamente al sellar el cierre. Revisa y confirma.
      </p>

      {withVariance.length === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-emerald-800 font-medium">¡Inventario perfecto!</p>
          <p className="text-sm text-emerald-700 mt-1">Todos los materiales coinciden exactamente. No se crearán ajustes.</p>
        </div>
      )}

      {withVariance.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="bg-[#1B2A4A] px-4 py-2">
            <p className="text-xs font-medium text-white uppercase tracking-wide">Ajustes a crear al sellar</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-2 text-left font-medium text-stone-600">Material</th>
                <th className="px-4 py-2 text-right font-medium text-stone-600">Teórico</th>
                <th className="px-4 py-2 text-center text-stone-400">→</th>
                <th className="px-4 py-2 text-right font-medium text-stone-600">Físico</th>
                <th className="px-4 py-2 text-right font-medium text-stone-600">Varianza</th>
                <th className="px-4 py-2 text-right font-medium text-stone-600">%</th>
                <th className="px-4 py-2 text-center font-medium text-stone-600">Tipo ajuste</th>
              </tr>
            </thead>
            <tbody>
              {withVariance.map((m, idx) => {
                const variance = m.variance_kg ?? 0
                const varPct = m.variance_pct ?? 0
                const needsJust = Math.abs(varPct) > thresholdPct
                return (
                  <tr key={m.material_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                    <td className="px-4 py-2.5 font-medium text-stone-800">
                      {m.material?.material_name ?? m.material_id}
                      {needsJust && (
                        <span className="ml-1.5 text-xs text-amber-600 font-normal">(requiere justificación)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{fmtKg(m.theoretical_final_kg)}</td>
                    <td className="px-4 py-2.5 text-center text-stone-300">
                      <ArrowRight className="h-3 w-3 inline" />
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-800 font-medium">{fmtKg(m.physical_count_kg)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${variance > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {variance > 0 ? '+' : ''}{fmtKg(variance)}
                    </td>
                    <td className={`px-4 py-2.5 text-right text-xs ${Math.abs(varPct) > thresholdPct ? 'text-red-700 font-semibold' : 'text-stone-600'}`}>
                      {varPct > 0 ? '+' : ''}{varPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {variance > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <TrendingUp className="h-3 w-3" />ajuste positivo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <TrendingDown className="h-3 w-3" />ajuste negativo
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {zeroVariance.length > 0 && (
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
          <p className="text-xs text-stone-500 flex items-center gap-1">
            <Minus className="h-3 w-3" />
            {zeroVariance.length} material(es) sin varianza — no se crearán ajustes para estos.
          </p>
        </div>
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
          onClick={onConfirm}
          disabled={saving}
          className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
        >
          {saving ? 'Procesando...' : 'Confirmar y continuar'}
        </Button>
      </div>
    </div>
  )
}
