'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Info } from 'lucide-react'
import type { InventoryClosureMaterial } from '@/types/inventoryClosure'

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

interface Props {
  materials: InventoryClosureMaterial[]
  periodStart: string
  periodEnd: string
  onConfirm: () => void | Promise<void>
  confirmed: boolean
  confirming?: boolean
}

export default function TheoreticalReviewStep({
  materials,
  periodStart,
  periodEnd,
  onConfirm,
  confirmed,
  confirming = false,
}: Props) {
  const totalEntries = materials.reduce((s, m) => s + (m.period_entries_kg ?? 0), 0)
  const totalConsumption = materials.reduce((s, m) => s + (m.period_consumption_kg ?? 0), 0)
  const totalAdjustments = materials.reduce((s, m) => s + (m.period_adjustments_kg ?? 0), 0)
  const totalWaste = materials.reduce((s, m) => s + (m.period_waste_kg ?? 0), 0)
  const totalFinal = materials.reduce((s, m) => s + (m.theoretical_final_kg ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-start gap-2 mb-4">
          <Info className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-stone-600">
            Revisa el inventario teórico del período <strong>{periodStart}</strong> al{' '}
            <strong>{periodEnd}</strong>. Estos valores provienen del dashboard de inventario histórico.
            Confirma que los datos son correctos antes de proceder al conteo físico.
          </p>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Entradas', value: totalEntries, color: 'text-emerald-700' },
            { label: 'Consumo', value: -totalConsumption, color: 'text-red-700' },
            { label: 'Ajustes neto', value: totalAdjustments, color: totalAdjustments >= 0 ? 'text-emerald-700' : 'text-red-700' },
            { label: 'Desperdicio', value: -totalWaste, color: 'text-amber-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-[#f5f3f0] px-3 py-2">
              <p className="text-xs text-stone-500 mb-0.5">{label}</p>
              <p className={`text-sm font-semibold ${color}`}>{fmtKg(value)}</p>
            </div>
          ))}
        </div>

        {materials.length === 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No se encontraron materiales con movimientos en este período. Verifica las fechas del cierre o
            cancela e inicia uno nuevo con el rango correcto.
          </p>
        )}

        {/* Per-material table */}
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B2A4A] text-white">
                <th className="px-3 py-2 text-left font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">Stock inicial</th>
                <th className="px-3 py-2 text-right font-medium">Entradas</th>
                <th className="px-3 py-2 text-right font-medium">Consumo</th>
                <th className="px-3 py-2 text-right font-medium">Ajustes</th>
                <th className="px-3 py-2 text-right font-medium">Desperdicio</th>
                <th className="px-3 py-2 text-right font-medium">Final teórico</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, idx) => (
                <tr key={m.material_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                  <td className="px-3 py-2 font-medium text-stone-800">
                    {m.material?.material_name ?? m.material_id}
                  </td>
                  <td className="px-3 py-2 text-right text-stone-600">{fmtKg(m.initial_stock_kg)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmtKg(m.period_entries_kg)}</td>
                  <td className="px-3 py-2 text-right text-red-700">{fmtKg(m.period_consumption_kg)}</td>
                  <td className={`px-3 py-2 text-right ${(m.period_adjustments_kg ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {fmtKg(m.period_adjustments_kg)}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-700">{fmtKg(m.period_waste_kg)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-stone-900">{fmtKg(m.theoretical_final_kg)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-[#f5f3f0] font-semibold border-t border-stone-300">
                <td className="px-3 py-2 text-stone-800">TOTAL</td>
                <td className="px-3 py-2 text-right text-stone-600">
                  {fmtKg(materials.reduce((s, m) => s + (m.initial_stock_kg ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-right text-emerald-700">{fmtKg(totalEntries)}</td>
                <td className="px-3 py-2 text-right text-red-700">{fmtKg(totalConsumption)}</td>
                <td className={`px-3 py-2 text-right ${totalAdjustments >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {fmtKg(totalAdjustments)}
                </td>
                <td className="px-3 py-2 text-right text-amber-700">{fmtKg(totalWaste)}</td>
                <td className="px-3 py-2 text-right text-stone-900">{fmtKg(totalFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onConfirm}
          disabled={confirmed || confirming || materials.length === 0}
          className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
        >
          {confirmed ? (
            <><CheckCircle2 className="h-4 w-4" /> Datos confirmados</>
          ) : confirming ? (
            <>Confirmando...</>
          ) : (
            <>Confirmar datos y continuar</>
          )}
        </Button>
      </div>
    </div>
  )
}
