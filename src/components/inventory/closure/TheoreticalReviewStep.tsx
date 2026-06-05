'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Info } from 'lucide-react'
import type { TheoreticalReviewMaterialRow } from '@/types/inventoryClosure'
import { todayIsoDate } from '@/lib/validations/inventoryClosure'
import { cn } from '@/lib/utils'

const VARIANCE_EPS_KG = 0.05

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

interface Props {
  materials: TheoreticalReviewMaterialRow[]
  periodStart: string
  periodEnd: string
  adjustmentsFromLedgerAudit?: boolean
  loading?: boolean
  onConfirm: () => void | Promise<void>
  confirmed: boolean
  confirming?: boolean
  readOnly?: boolean
}

export default function TheoreticalReviewStep({
  materials,
  periodStart,
  periodEnd,
  adjustmentsFromLedgerAudit = false,
  loading = false,
  onConfirm,
  confirmed,
  confirming = false,
  readOnly = false,
}: Props) {
  const totalInitial = materials.reduce((s, m) => s + (m.initial_stock_kg ?? 0), 0)
  const totalEntries = materials.reduce((s, m) => s + (m.period_entries_kg ?? 0), 0)
  const totalConsumption = materials.reduce((s, m) => s + (m.period_consumption_kg ?? 0), 0)
  const totalAdjPos = materials.reduce((s, m) => s + (m.period_adjustments_positive_kg ?? 0), 0)
  const totalAdjNeg = materials.reduce((s, m) => s + (m.period_adjustments_negative_kg ?? 0), 0)
  const totalWaste = materials.reduce((s, m) => s + (m.period_waste_kg ?? 0), 0)
  const totalFinal = materials.reduce((s, m) => s + (m.theoretical_final_kg ?? 0), 0)
  const totalSystem = materials.reduce((s, m) => s + (m.system_current_stock_kg ?? 0), 0)
  const totalVariance = materials.reduce((s, m) => s + (m.variance_vs_system_kg ?? 0), 0)
  const periodEndsToday = periodEnd === todayIsoDate()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-start gap-2 mb-4">
          <Info className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-stone-600">
            Revisa el inventario teórico del período <strong>{periodStart}</strong> al{' '}
            <strong>{periodEnd}</strong>. El <strong>inv. teórico final</strong> es la suma aritmética de las
            columnas (inicial + entradas + ajustes − consumo − desperdicio), alineada con consumos y auditoría de
            material. La columna <strong>inv. actual (sistema)</strong> es el stock vivo en{' '}
            <code className="text-xs bg-stone-100 px-1 rounded">material_inventory</code>
            {periodEndsToday
              ? ' — con el período cerrado a hoy, ambas cifras deben coincidir si los movimientos están completos.'
              : ' — si el fin del período es anterior a hoy, puede diferir del teórico (movimientos posteriores).'}
            En plantas con corte ERP, el <strong>inventario inicial</strong> es el cierre del tramo desde el día
            de corte hasta el día anterior a {periodStart}.
          </p>
        </div>

        {adjustmentsFromLedgerAudit && (
          <p className="mb-3 text-xs text-stone-500">
            Columnas Ajustes ± alineadas con Auditoría de material / exportación contable de consumos.
          </p>
        )}

        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {[
            { label: 'Inv. inicial', value: totalInitial, color: 'text-stone-800' },
            { label: 'Entradas', value: totalEntries, color: 'text-emerald-700' },
            { label: 'Ajustes +', value: totalAdjPos, color: 'text-emerald-700' },
            { label: 'Ajustes −', value: -totalAdjNeg, color: 'text-red-700' },
            { label: 'Consumo', value: -totalConsumption, color: 'text-red-700' },
            { label: 'Desperdicio', value: -totalWaste, color: 'text-amber-700' },
            { label: 'Teórico final', value: totalFinal, color: 'text-stone-900' },
            ...(periodEndsToday
              ? [{ label: 'Actual sistema', value: totalSystem, color: 'text-sky-800' as const }]
              : []),
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

        {loading ? (
          <p className="py-8 text-center text-sm text-stone-400">Recalculando inventario teórico...</p>
        ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B2A4A] text-white">
                <th className="px-3 py-2 text-left font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">Inv. inicial</th>
                <th className="px-3 py-2 text-right font-medium">Entradas</th>
                <th className="px-3 py-2 text-right font-medium">
                  {adjustmentsFromLedgerAudit ? 'Ajustes + (aud.)' : 'Ajustes +'}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {adjustmentsFromLedgerAudit ? 'Ajustes − (aud.)' : 'Ajustes −'}
                </th>
                <th className="px-3 py-2 text-right font-medium">Consumo</th>
                <th className="px-3 py-2 text-right font-medium">Desperdicio</th>
                <th className="px-3 py-2 text-right font-medium">Inv. teórico final</th>
                <th className="px-3 py-2 text-right font-medium">Inv. actual (sistema)</th>
                {periodEndsToday && (
                  <th className="px-3 py-2 text-right font-medium">Dif. vs sistema</th>
                )}
              </tr>
            </thead>
            <tbody>
              {materials.map((m, idx) => {
                const rowVariance = m.variance_vs_system_kg ?? 0
                const mismatch =
                  periodEndsToday && Math.abs(rowVariance) > VARIANCE_EPS_KG
                return (
                <tr
                  key={m.material_id}
                  className={cn(
                    idx % 2 === 0 ? 'bg-white' : 'bg-stone-50',
                    mismatch && 'bg-amber-50/80',
                  )}
                >
                  <td className="px-3 py-2 font-medium text-stone-800">
                    {m.material?.material_name ?? m.material_id}
                  </td>
                  <td className="px-3 py-2 text-right text-stone-600">{fmtKg(m.initial_stock_kg)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmtKg(m.period_entries_kg)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">
                    {fmtKg(m.period_adjustments_positive_kg)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-700">
                    {fmtKg(m.period_adjustments_negative_kg)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-700">{fmtKg(m.period_consumption_kg)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{fmtKg(m.period_waste_kg)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-stone-900">{fmtKg(m.theoretical_final_kg)}</td>
                  <td className="px-3 py-2 text-right font-medium text-sky-800">
                    {fmtKg(m.system_current_stock_kg)}
                  </td>
                  {periodEndsToday && (
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-medium',
                        mismatch ? 'text-amber-800' : 'text-stone-500',
                      )}
                    >
                      {fmtKg(rowVariance)}
                    </td>
                  )}
                </tr>
              )})}
              <tr className="bg-[#f5f3f0] font-semibold border-t border-stone-300">
                <td className="px-3 py-2 text-stone-800">TOTAL</td>
                <td className="px-3 py-2 text-right text-stone-600">{fmtKg(totalInitial)}</td>
                <td className="px-3 py-2 text-right text-emerald-700">{fmtKg(totalEntries)}</td>
                <td className="px-3 py-2 text-right text-emerald-700">{fmtKg(totalAdjPos)}</td>
                <td className="px-3 py-2 text-right text-red-700">{fmtKg(totalAdjNeg)}</td>
                <td className="px-3 py-2 text-right text-red-700">{fmtKg(totalConsumption)}</td>
                <td className="px-3 py-2 text-right text-amber-700">{fmtKg(totalWaste)}</td>
                <td className="px-3 py-2 text-right text-stone-900">{fmtKg(totalFinal)}</td>
                <td className="px-3 py-2 text-right text-sky-800">{fmtKg(totalSystem)}</td>
                {periodEndsToday && (
                  <td
                    className={cn(
                      'px-3 py-2 text-right',
                      Math.abs(totalVariance) > VARIANCE_EPS_KG ? 'text-amber-800' : 'text-stone-600',
                    )}
                  >
                    {fmtKg(totalVariance)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button
            onClick={onConfirm}
            disabled={confirmed || confirming || loading || materials.length === 0}
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
      )}
    </div>
  )
}
