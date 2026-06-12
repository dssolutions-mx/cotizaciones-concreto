'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EntityWeekGrid } from '@/components/hr/EntityWeekGrid';
import { HrWaterEntryEvidenceCell } from '@/components/hr/HrWaterEntryEvidenceCell';
import type { HrWaterEntryRow } from '@/services/hrWeeklyRemisionesService';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

function formatWaterQuantity(row: HrWaterEntryRow): string {
  const uom = row.received_uom;
  if (uom === 'l') {
    const n = Number(row.received_qty_entered ?? row.quantity_received ?? 0);
    return `${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} L`;
  }
  if (uom === 'm3') {
    const n = Number(row.received_qty_entered ?? row.quantity_received ?? 0);
    return `${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} m³`;
  }
  const n = Number(row.received_qty_kg ?? row.quantity_received ?? 0);
  return `${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg`;
}

function rowSearchHaystack(row: HrWaterEntryRow): string {
  return [
    row.entry_number,
    row.supplier_invoice,
    row.fleet_invoice,
    row.supplier?.name,
    row.fleet_supplier?.name,
    row.notes,
    row.plant?.code,
    row.plant?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export type HrWaterEntriesPanelProps = {
  dateRange: DateRange;
  rows: HrWaterEntryRow[];
  byPlant: Array<{
    plant_id: string;
    code: string;
    name: string;
    totalEntries: number;
    dayMatrix: Record<string, number>;
  }>;
  plantFilterIds: string[];
  dayFilter: string | null;
  search: string;
  onPlantFilter: (plantId: string) => void;
  onDayFilter: (date: string) => void;
  onClearWaterFilters: () => void;
  className?: string;
};

export function HrWaterEntriesPanel({
  dateRange,
  rows,
  byPlant,
  plantFilterIds,
  dayFilter,
  search,
  onPlantFilter,
  onDayFilter,
  onClearWaterFilters,
  className,
}: HrWaterEntriesPanelProps) {
  const [localSearch, setLocalSearch] = useState('');

  const effectiveSearch = (localSearch || search).trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (plantFilterIds.length > 0 && !plantFilterIds.includes(r.plant_id)) return false;
      if (dayFilter && r.entry_date !== dayFilter) return false;
      if (effectiveSearch && !rowSearchHaystack(r).includes(effectiveSearch)) return false;
      return true;
    });
  }, [rows, plantFilterIds, dayFilter, effectiveSearch]);

  const stats = useMemo(() => {
    const missingEvidence = filteredRows.filter((r) => r.document_count === 0).length;
    const withEvidence = filteredRows.filter((r) => r.document_count > 0).length;
    return {
      total: filteredRows.length,
      missingEvidence,
      withEvidence,
    };
  }, [filteredRows]);

  const gridRows = useMemo(
    () =>
      byPlant.map((p) => ({
        key: p.plant_id,
        name: `${p.name} (${p.code})`,
        trips: p.totalEntries,
        dayMatrix: p.dayMatrix,
      })),
    [byPlant],
  );

  const hasActiveFilters =
    plantFilterIds.length > 0 || !!dayFilter || !!effectiveSearch || !!localSearch;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500">Viajes de agua</div>
            <div className="text-2xl font-semibold tabular-nums">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500">Con evidencia</div>
            <div className="text-2xl font-semibold tabular-nums text-emerald-800">{stats.withEvidence}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500">Sin evidencia</div>
            <div
              className={cn(
                'text-2xl font-semibold tabular-nums',
                stats.missingEvidence > 0 && 'text-amber-800',
              )}
            >
              {stats.missingEvidence}
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityWeekGrid
        dateRange={dateRange}
        title="Entradas de agua por planta"
        description="Click en planta o día para filtrar el detalle de viajes"
        entityColumnLabel="Planta"
        rows={gridRows}
        countNoun={{ one: 'entrada', many: 'entradas' }}
        totalRowLabel="Total entradas"
        emptyMessage="No hubo entradas de agua en el período."
        onDayClick={onDayFilter}
        onEntityClick={(row) => onPlantFilter(row.key)}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">Detalle de viajes de agua</CardTitle>
              <CardDescription>
                Folios, proveedor, cantidad y evidencia adjunta por recepción. Revise los archivos antes
                de autorizar el pago.
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="outline" size="sm" onClick={onClearWaterFilters}>
                Limpiar filtros agua
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {plantFilterIds.length > 0 && (
              <Badge variant="secondary">Planta filtrada ({plantFilterIds.length})</Badge>
            )}
            {dayFilter && <Badge variant="secondary">Día: {dayFilter}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar folio, proveedor, notas…"
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Folio / remisión</TableHead>
                  <TableHead>Planta</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="min-w-[160px]">Evidencia adjunta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                      No hay viajes de agua para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const noEvidence = row.document_count === 0;
                    const fleetFolio = row.fleet_invoice?.trim();
                    const materialFolio = row.supplier_invoice?.trim();
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(noEvidence && 'bg-amber-50/40')}
                      >
                        <TableCell className="whitespace-nowrap align-top">
                          {format(new Date(`${row.entry_date}T12:00:00`), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top">{row.entry_number || '—'}</TableCell>
                        <TableCell className="text-sm align-top">
                          <div className="font-mono">{materialFolio || fleetFolio || '—'}</div>
                          {fleetFolio && materialFolio && fleetFolio !== materialFolio && (
                            <div className="text-xs text-gray-500 font-mono">Guía {fleetFolio}</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-top">
                          {row.plant?.name ?? '—'}
                          {row.plant?.code ? (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              {row.plant.code}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className="max-w-[160px] truncate align-top"
                          title={row.supplier?.name ?? row.fleet_supplier?.name ?? undefined}
                        >
                          {row.supplier?.name ?? row.fleet_supplier?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm align-top">
                          {formatWaterQuantity(row)}
                        </TableCell>
                        <TableCell className="align-top">
                          <HrWaterEntryEvidenceCell
                            entryId={row.id}
                            documentCount={row.document_count}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
