'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PricingFamily } from '@/lib/services/listPriceWorkspaceService';
import type { ListPriceRow, PerformanceRow } from '../shared';
import {
  fmtMXN,
  marketFitInfo,
  placementLabel,
  zoneDivergesFromAb,
} from '../shared';
import type { MasterRecipeRow } from '@/lib/services/listPriceWorkspaceService';
import { ZoneLegend } from './ZoneLegend';

export interface InsightTableRow {
  master: MasterRecipeRow;
  fam: PricingFamily;
  lp: ListPriceRow;
  kpi: PerformanceRow | null;
}

interface Props {
  strengthFc: number;
  rows: InsightTableRow[];
  selectedListPriceId: string | null;
  onSelectRow: (row: InsightTableRow) => void;
}

function LowSampleBadge({ volume }: { volume: number | null | undefined }) {
  if (volume == null || volume >= 50) return null;
  return (
    <Badge variant="outline" className="ml-2 text-[10px] font-normal text-amber-700 border-amber-200">
      Muestra pequeña
    </Badge>
  );
}

function ZoneCell({
  value,
  abValue,
}: {
  value: number | null | undefined;
  abValue: number | null | undefined;
}) {
  const diverges = zoneDivergesFromAb(value, abValue);
  return (
    <td
      className={cn(
        'px-3 py-3 text-slate-600 whitespace-nowrap tabular-nums',
        diverges && 'bg-amber-50/80 text-amber-900 font-medium',
      )}
    >
      {value != null ? fmtMXN(value) : '—'}
    </td>
  );
}

export function InsightsMasterTable({
  strengthFc,
  rows,
  selectedListPriceId,
  onSelectRow,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>f&apos;c {strengthFc} kg/cm²</CardTitle>
            <CardDescription>
              {rows.length} maestros · clic en fila para ver cotizaciones y tendencia
            </CardDescription>
          </div>
          <ZoneLegend />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-100">
              <tr>
                {[
                  'Maestro',
                  'Lista',
                  'Vol. m³',
                  '# Cot.',
                  'Precio VW',
                  'Δ VW',
                  'Bajo piso %',
                  'AB',
                  'C',
                  'D',
                  'E',
                  'Mercado',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const { master, lp, kpi } = row;
                const fit = marketFitInfo(kpi?.market_fit ?? 'NO_DATA');
                const selected = selectedListPriceId === lp.id;
                const tma =
                  master.max_aggregate_size != null ? `${master.max_aggregate_size} mm` : '—';

                return (
                  <tr
                    key={master.id}
                    onClick={() => onSelectRow(row)}
                    className={cn(
                      'cursor-pointer hover:bg-slate-50 transition-colors',
                      selected && 'bg-slate-100/90 ring-1 ring-inset ring-slate-300',
                    )}
                  >
                    <td className="px-3 py-3 min-w-[140px]">
                      <p className="font-medium font-mono text-slate-900">{master.master_code}</p>
                      <p className="text-[11px] text-slate-400">
                        {row.fam.ageLabel} · {placementLabel(master.placement_type)} · Rev.{' '}
                        {master.slump} · TMA {tma}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">{fmtMXN(lp.base_price)}</td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      {kpi?.total_volume_m3 != null
                        ? Number(kpi.total_volume_m3).toLocaleString('es-MX', { maximumFractionDigits: 1 })
                        : '—'}
                      <LowSampleBadge volume={kpi?.total_volume_m3} />
                    </td>
                    <td className="px-3 py-3 tabular-nums">{kpi?.total_quotes ?? '—'}</td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      {kpi?.vw_avg_price != null ? fmtMXN(kpi.vw_avg_price) : '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      {kpi?.vw_avg_floor_delta != null ? fmtMXN(kpi.vw_avg_floor_delta) : '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {kpi?.sub_floor_volume_pct != null ? `${kpi.sub_floor_volume_pct}%` : '—'}
                    </td>
                    <ZoneCell value={kpi?.vw_delta_zone_ab} abValue={kpi?.vw_delta_zone_ab} />
                    <ZoneCell value={kpi?.vw_delta_zone_c} abValue={kpi?.vw_delta_zone_ab} />
                    <ZoneCell value={kpi?.vw_delta_zone_d} abValue={kpi?.vw_delta_zone_ab} />
                    <ZoneCell value={kpi?.vw_delta_zone_e} abValue={kpi?.vw_delta_zone_ab} />
                    <td className="px-3 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', fit.className)}>
                        {fit.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
