import React from 'react';
import type { PlantFinancialRow } from '@/hooks/useFinancialAnalysis';

interface Props {
  data: PlantFinancialRow[];
}

export function FinancialAnalysisTable({ data }: Props) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
      <table className="min-w-full">
        {/* Section 1: Ingresos Concreto */}
        <thead>
          <tr className="bg-blue-900">
            <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border-r-2 border-white">
              Ingresos Concreto
            </th>
            {data.map((plant) => (
              <th
                key={plant.plant_id}
                className="px-4 py-3 text-center text-sm font-bold text-white border-r border-blue-700 whitespace-nowrap"
              >
                {plant.plant_code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-blue-50">
          <tr className="hover:bg-blue-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-blue-50">
              Volumen Concreto (m³)
            </td>
            {data.map((p) => (
              <td key={`vol-conc-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.volumen_concreto_m3).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-blue-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-blue-50">
              f'c Ponderada (kg/cm²)
            </td>
            {data.map((p) => (
              <td key={`fc-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.fc_ponderada_kg_cm2).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-blue-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-blue-50">
              Edad Ponderada (días)
            </td>
            {data.map((p) => (
              <td key={`edad-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.edad_ponderada_dias).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-blue-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-blue-50">
              PV Unitario
            </td>
            {data.map((p) => (
              <td key={`pv-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.pv_unitario).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-blue-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-blue-50">
              Ventas Total Concreto
            </td>
            {data.map((p) => (
              <td key={`ventas-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.ventas_total_concreto).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
        </tbody>

        {/* Thick separator */}
        <tbody>
          <tr>
            <td colSpan={1 + data.length} className="h-1 bg-gray-400" />
          </tr>
        </tbody>

        {/* Section 2: Costo Materia Prima */}
        <thead>
          <tr className="bg-orange-900">
            <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border-r-2 border-white">
              Costo Materia Prima
            </th>
            {data.map((plant) => (
              <th
                key={`cost-h-${plant.plant_id}`}
                className="px-4 py-3 text-center text-sm font-bold text-white border-r border-orange-700 whitespace-nowrap"
              >
                {plant.plant_code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-orange-50">
          <tr className="hover:bg-orange-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-orange-50">
              Volumen Producido (m³)
            </td>
            {data.map((p) => (
              <td key={`vol-prod-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.volumen_producido_m3).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-orange-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-orange-50">
              Costo MP Unitario
            </td>
            {data.map((p) => (
              <td key={`costo-mpu-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.costo_mp_unitario).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-orange-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-orange-50">
              Consumo Cem/m³ (kg)
            </td>
            {data.map((p) => (
              <td key={`cem-cons-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.consumo_cem_per_m3_kg).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-orange-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-orange-50">
              Costo Cem/m³ ($ Unit)
            </td>
            {data.map((p) => (
              <td key={`cem-cost-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.costo_cem_per_m3).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-orange-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-orange-50">
              Costo MP Total Concreto
            </td>
            {data.map((p) => (
              <td key={`costo-mpt-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.costo_mp_total_concreto).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-orange-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-orange-50">
              Costo MP %
            </td>
            {data.map((p) => (
              <td key={`costo-mpp-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.costo_mp_percent).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </td>
            ))}
          </tr>
        </tbody>

        {/* Thick separator */}
        <tbody>
          <tr>
            <td colSpan={1 + data.length} className="h-1 bg-gray-400" />
          </tr>
        </tbody>

        {/* Section 3: Spread */}
        <thead>
          <tr className="bg-green-900">
            <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border-r-2 border-white">
              Spread
            </th>
            {data.map((plant) => (
              <th
                key={`spr-h-${plant.plant_id}`}
                className="px-4 py-3 text-center text-sm font-bold text-white border-r border-green-700 whitespace-nowrap"
              >
                {plant.plant_code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-green-50">
          <tr className="hover:bg-green-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-green-50">
              Spread Unitario
            </td>
            {data.map((p) => (
              <td key={`spr-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.spread_unitario).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-green-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-green-50">
              Spread Unitario %
            </td>
            {data.map((p) => (
              <td key={`sprp-${p.plant_id}`} className="px-4 py-2 text-sm text-right font-mono border-r border-gray-200">
                {Number(p.spread_unitario_percent).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}


