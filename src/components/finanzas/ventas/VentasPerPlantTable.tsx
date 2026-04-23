'use client';

import { Fragment, useMemo } from 'react';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { VentasPerPlantRow } from '@/hooks/useVentasPerPlantRows';
import type { BusinessUnit, Plant } from '@/types/plant';

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 22;
  if (!values.length) return <span className="text-caption text-label-tertiary">—</span>;
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - 2) + 1;
      const y = h - 1 - ((v - min) / range) * (h - 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="inline-block align-middle" aria-hidden>
      <polyline fill="none" points={pts} stroke="#007AFF" strokeWidth="1.5" />
    </svg>
  );
}

interface VentasPerPlantTableProps {
  perPlantRows: VentasPerPlantRow[];
  availablePlants: Plant[];
  businessUnits: BusinessUnit[];
  effectivePlantIds: string[];
  sparklineRevenueByPlantId: Record<string, number[]>;
  includeVAT: boolean;
  onExportPlantsTable: () => void;
}

export function VentasPerPlantTable({
  perPlantRows,
  availablePlants,
  businessUnits,
  effectivePlantIds,
  sparklineRevenueByPlantId,
  includeVAT,
  onExportPlantsTable,
}: VentasPerPlantTableProps) {
  const groupByBu = useMemo(() => {
    const buIds = new Set(
      effectivePlantIds
        .map((id) => availablePlants.find((p) => p.id === id)?.business_unit_id)
        .filter(Boolean)
    );
    return buIds.size > 1;
  }, [effectivePlantIds, availablePlants]);

  const buName = (buId: string) =>
    businessUnits.find((b) => b.id === buId)?.name || 'Unidad de negocio';

  const rowsByBu = useMemo(() => {
    if (!groupByBu) {
      return [{ buId: null as string | null, label: null as string | null, rows: perPlantRows }];
    }
    const map = new Map<string, VentasPerPlantRow[]>();
    perPlantRows.forEach((row) => {
      const buId = availablePlants.find((p) => p.id === row.plantId)?.business_unit_id || 'none';
      if (!map.has(buId)) map.set(buId, []);
      map.get(buId)!.push(row);
    });
    return Array.from(map.entries()).map(([buId, rows]) => ({
      buId,
      label: buName(buId),
      rows: [...rows].sort((a: VentasPerPlantRow, b: VentasPerPlantRow) =>
        a.plantName.localeCompare(b.plantName)
      ),
    }));
  }, [perPlantRows, groupByBu, availablePlants, businessUnits]);

  const totals = useMemo(() => {
    return perPlantRows.reduce(
      (acc, r) => {
        acc.concrete += r.concreteVolume;
        acc.pump += r.pumpVolume;
        acc.empty += r.emptyTruckVolume;
        acc.concV += r.concreteVentas;
        acc.pumpV += r.pumpVentas;
        acc.emptyV += r.emptyTruckVentas;
        acc.totalV += r.totalVentas;
        return acc;
      },
      { concrete: 0, pump: 0, empty: 0, concV: 0, pumpV: 0, emptyV: 0, totalV: 0 }
    );
  }, [perPlantRows]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-thick rounded-3xl border border-label-tertiary/10 p-6"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title-3 font-semibold text-label-primary">Comparativo por planta</h2>
          <p className="text-caption text-label-tertiary">
            Montos {includeVAT ? 'con IVA en órdenes fiscales' : 'sin IVA'} · sparkline 6m ingresos
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-label-tertiary/10"
          onClick={onExportPlantsTable}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar tabla
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-label-tertiary/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 min-w-[140px] bg-background-primary/95 backdrop-blur">
                Planta
              </TableHead>
              <TableHead className="text-right">6m</TableHead>
              <TableHead className="text-right">Concreto m³</TableHead>
              <TableHead className="text-right">Bombeo m³</TableHead>
              <TableHead className="text-right">Vacío m³</TableHead>
              <TableHead className="text-right">Concreto $</TableHead>
              <TableHead className="text-right">Bombeo $</TableHead>
              <TableHead className="text-right">Total $</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsByBu.map((section) => (
              <Fragment key={section.buId ?? 'all'}>
                {section.label && (
                  <TableRow className="bg-label-tertiary/5 hover:bg-label-tertiary/5">
                    <TableCell colSpan={8} className="text-callout font-semibold text-label-primary">
                      {section.label}
                    </TableCell>
                  </TableRow>
                )}
                {section.rows.map((row: VentasPerPlantRow) => (
                  <TableRow
                    key={row.plantId}
                    className="cursor-default border-0 transition-colors hover:bg-systemBlue/5"
                  >
                    <TableCell className="sticky left-0 z-10 bg-background-primary/95 font-medium backdrop-blur">
                      <div className="flex flex-col">
                        <span>{row.plantName}</span>
                        <span className="text-caption text-label-tertiary">{row.plantCode}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Sparkline values={sparklineRevenueByPlantId[row.plantId] ?? []} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.concreteVolume.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pumpVolume.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.emptyTruckVolume.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.concreteVentas)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.pumpVentas)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(row.totalVentas)}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {perPlantRows.length > 0 && (
              <TableRow className="border-t-2 border-label-tertiary/20 bg-label-tertiary/5 font-semibold hover:bg-label-tertiary/5">
                <TableCell className="sticky left-0 z-10 bg-label-tertiary/5">Totales</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{totals.concrete.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.pump.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.empty.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totals.concV)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totals.pumpV)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totals.totalV)}</TableCell>
              </TableRow>
            )}
            {perPlantRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-callout text-label-tertiary">
                  Sin filas por planta en los filtros actuales.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
