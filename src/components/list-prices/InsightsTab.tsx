'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PricingFamily } from '@/lib/services/listPriceWorkspaceService';
import { type ListPriceRow, type PerformanceRow, fmtMXN, placementLabel, marketFitInfo } from './shared';

interface Props {
  familiesByStrength: [number, PricingFamily[]][];
  currentLpByMaster: Map<string, ListPriceRow>;
  perfByLpId: Map<string, PerformanceRow>;
}

export function InsightsTab({ familiesByStrength, currentLpByMaster, perfByLpId }: Props) {
  const hasAny = familiesByStrength.some(([, fams]) =>
    fams.some((fam) => fam.masters.some((m) => currentLpByMaster.has(m.id))),
  );

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-slate-600 font-semibold">Sin precios configurados</p>
          <p className="text-sm text-slate-400 mt-1">
            Configura precios ejecutivos en la pestaña Gestión para ver los KPIs aquí.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">KPIs de mercado</h2>
        <p className="text-slate-600 mt-1">
          Qué tan alineados están los precios ejecutivos con lo que el mercado acepta.
          Este apartado es analítico y no modifica precios.
        </p>
      </div>

      {familiesByStrength.map(([strengthFc, fams]) => {
        const allRows = fams.flatMap((fam) =>
          fam.masters
            .map((m) => {
              const lp  = currentLpByMaster.get(m.id);
              const kpi = lp ? perfByLpId.get(lp.id) : null;
              return { master: m, fam, lp, kpi };
            })
            .filter((r) => r.lp != null),
        );
        if (allRows.length === 0) return null;

        return (
          <Card key={strengthFc}>
            <CardHeader className="pb-4">
              <CardTitle>f&apos;c {strengthFc} kg/cm²</CardTitle>
              <CardDescription>{allRows.length} maestros con precio de lista configurado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-100">
                    <tr>
                      {['Madurez', 'Maestro', 'TMA', 'Precio lista', 'Ajuste de mercado', 'Vol. bajo piso', 'Delta VW', 'Zona AB', 'Zona C', 'Zona D', 'Zona E'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allRows.map(({ master, fam, lp, kpi }) => {
                      const fit = marketFitInfo(kpi?.market_fit ?? 'NO_DATA');
                      const tma = master.max_aggregate_size != null ? `${master.max_aggregate_size} mm` : '—';
                      return (
                        <tr key={master.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fam.ageLabel}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium font-mono text-slate-900">{master.master_code}</p>
                            <p className="text-[11px] text-slate-400">
                              {placementLabel(master.placement_type)} · Rev. {master.slump} cm
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{tma}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{fmtMXN(lp!.base_price)}</td>
                          <td className="px-4 py-3">
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', fit.className)}>
                              {fit.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{kpi?.sub_floor_volume_pct != null ? `${kpi.sub_floor_volume_pct.toFixed(1)}%` : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{kpi?.vw_avg_floor_delta != null ? fmtMXN(kpi.vw_avg_floor_delta) : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{kpi?.vw_delta_zone_ab != null ? fmtMXN(kpi.vw_delta_zone_ab) : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{kpi?.vw_delta_zone_c != null ? fmtMXN(kpi.vw_delta_zone_c) : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{kpi?.vw_delta_zone_d != null ? fmtMXN(kpi.vw_delta_zone_d) : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{kpi?.vw_delta_zone_e != null ? fmtMXN(kpi.vw_delta_zone_e) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
