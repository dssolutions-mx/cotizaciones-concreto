'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PricingFamily } from '@/lib/services/listPriceWorkspaceService';
import {
  type ListPriceRow,
  type PerformanceRow,
  type InsightsDatePreset,
  resolveInsightsDateRange,
} from './shared';
import { InsightsSummaryStrip } from './insights/InsightsSummaryStrip';
import {
  InsightsFiltersBar,
  type MarketFitFilter,
} from './insights/InsightsFiltersBar';
import {
  InsightsMasterTable,
  type InsightTableRow,
} from './insights/InsightsMasterTable';
import { ListPriceInsightSheet } from './insights/ListPriceInsightSheet';
import { Download } from 'lucide-react';
import { marketFitInfo } from './shared';

interface Props {
  familiesByStrength: [number, PricingFamily[]][];
  currentLpByMaster: Map<string, ListPriceRow>;
  perfByLpId: Map<string, PerformanceRow>;
  plantId: string;
  refreshedAt: string | null;
}

export function InsightsTab({
  familiesByStrength,
  currentLpByMaster,
  perfByLpId,
  plantId,
  refreshedAt,
}: Props) {
  const [datePreset, setDatePreset] = useState<InsightsDatePreset>('12m');
  const [marketFitFilter, setMarketFitFilter] = useState<MarketFitFilter>('ALL');
  const [strengthFilter, setStrengthFilter] = useState<number | 'ALL'>('ALL');
  const [selectedRow, setSelectedRow] = useState<InsightTableRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const allPerfRows = useMemo(() => Array.from(perfByLpId.values()), [perfByLpId]);

  const strengthOptions = useMemo(
    () => familiesByStrength.map(([s]) => s).sort((a, b) => b - a),
    [familiesByStrength],
  );

  const tableRowsByStrength = useMemo(() => {
    const map = new Map<number, InsightTableRow[]>();

    familiesByStrength.forEach(([strengthFc, fams]) => {
      if (strengthFilter !== 'ALL' && strengthFc !== strengthFilter) return;

      const rows: InsightTableRow[] = [];
      fams.forEach((fam) => {
        fam.masters.forEach((master) => {
          const lp = currentLpByMaster.get(master.id);
          if (!lp) return;
          const kpi = perfByLpId.get(lp.id) ?? null;
          if (marketFitFilter !== 'ALL' && (kpi?.market_fit ?? 'NO_DATA') !== marketFitFilter) {
            return;
          }
          rows.push({ master, fam, lp, kpi });
        });
      });

      if (rows.length > 0) map.set(strengthFc, rows);
    });

    return map;
  }, [familiesByStrength, currentLpByMaster, perfByLpId, marketFitFilter, strengthFilter]);

  const hasAny = tableRowsByStrength.size > 0;

  const sheetDateRange = useMemo(() => {
    if (!selectedRow) return { from: '', to: '' };
    return resolveInsightsDateRange(datePreset, selectedRow.lp.effective_date);
  }, [selectedRow, datePreset]);

  const handleSelectRow = (row: InsightTableRow) => {
    setSelectedRow(row);
    setSheetOpen(true);
  };

  const exportInsightsCsv = () => {
    const headers = [
      "f'c",
      'Madurez',
      'Maestro',
      'Precio lista',
      'Vol m3',
      '# Cotizaciones',
      'Precio VW',
      'Delta VW',
      '% bajo piso',
      'Zona AB',
      'Zona C',
      'Zona D',
      'Zona E',
      'Mercado',
    ];
    const lines: string[][] = [headers];
    tableRowsByStrength.forEach((rows, strengthFc) => {
      rows.forEach(({ master, fam, lp, kpi }) => {
        const fit = marketFitInfo(kpi?.market_fit ?? 'NO_DATA');
        lines.push([
          String(strengthFc),
          fam.ageLabel,
          master.master_code,
          String(lp.base_price),
          kpi?.total_volume_m3 != null ? String(kpi.total_volume_m3) : '',
          kpi?.total_quotes != null ? String(kpi.total_quotes) : '',
          kpi?.vw_avg_price != null ? String(kpi.vw_avg_price) : '',
          kpi?.vw_avg_floor_delta != null ? String(kpi.vw_avg_floor_delta) : '',
          kpi?.sub_floor_volume_pct != null ? String(kpi.sub_floor_volume_pct) : '',
          kpi?.vw_delta_zone_ab != null ? String(kpi.vw_delta_zone_ab) : '',
          kpi?.vw_delta_zone_c != null ? String(kpi.vw_delta_zone_c) : '',
          kpi?.vw_delta_zone_d != null ? String(kpi.vw_delta_zone_d) : '',
          kpi?.vw_delta_zone_e != null ? String(kpi.vw_delta_zone_e) : '',
          fit.label,
        ]);
      });
    });
    const csv = lines
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analisis-lista-precios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-slate-600 font-semibold">Sin precios configurados</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Configura precios ejecutivos en la pestaña Gestión para ver el análisis de mercado aquí.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Análisis de mercado</h2>
          <p className="text-slate-600 mt-1 text-sm max-w-2xl">
            Compara el precio de lista con cotizaciones aprobadas. Haz clic en una fila para ver
            las cotizaciones que componen cada indicador.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportInsightsCsv} className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Exportar análisis
        </Button>
      </div>

      <InsightsSummaryStrip rows={allPerfRows} refreshedAt={refreshedAt} />

      <InsightsFiltersBar
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        marketFitFilter={marketFitFilter}
        onMarketFitFilterChange={setMarketFitFilter}
        strengthFilter={strengthFilter}
        onStrengthFilterChange={setStrengthFilter}
        strengthOptions={strengthOptions}
      />

      {Array.from(tableRowsByStrength.entries()).map(([strengthFc, rows]) => (
        <InsightsMasterTable
          key={strengthFc}
          strengthFc={strengthFc}
          rows={rows}
          selectedListPriceId={selectedRow?.lp.id ?? null}
          onSelectRow={handleSelectRow}
        />
      ))}

      <ListPriceInsightSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        row={selectedRow}
        plantId={plantId}
        dateFrom={sheetDateRange.from}
        dateTo={sheetDateRange.to}
      />
    </div>
  );
}
