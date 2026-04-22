'use client';

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { HrWeeklyResponse } from '@/services/hrWeeklyRemisionesService';

type ByUnit = HrWeeklyResponse['byUnit'];

type UnitsSummaryTableProps = {
  byUnit: ByUnit;
  endDate: string;
  onRowClick: (unidad: string) => void;
  maxRows?: number;
};

function lastNRangeDates(endDateStr: string, n: number): string[] {
  const end = parseISO(endDateStr);
  if (Number.isNaN(end.getTime())) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function formatYmd(yyyyMmDd: string) {
  try {
    return format(parseISO(yyyyMmDd), 'd MMM', { locale: es });
  } catch {
    return yyyyMmDd;
  }
}

export function UnitsSummaryTable({ byUnit, endDate, onRowClick, maxRows = 50 }: UnitsSummaryTableProps) {
  const last3 = useMemo(() => lastNRangeDates(endDate, 3), [endDate]);

  const list = byUnit ?? [];

  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="sticky top-0 bg-white">
            <TableHead>Unidad</TableHead>
            <TableHead className="text-right">Viajes</TableHead>
            <TableHead className="text-right">Válidos</TableHead>
            <TableHead className="text-right">Incid.</TableHead>
            <TableHead className="text-right">Días con incid.</TableHead>
            <TableHead className="text-right">Última incid.</TableHead>
            <TableHead className="text-right">Racha</TableHead>
            <TableHead className="text-right">Conductores</TableHead>
            <TableHead className="text-right">Volumen</TableHead>
            <TableHead>Plantas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-10 text-gray-500">
                No hay unidades en el período.
              </TableCell>
            </TableRow>
          ) : (
            list.slice(0, maxRows).map((u) => {
              const c = u.compliance;
              const last = c?.lastFlaggedDate;
              const showLast3Badge = last && last3.includes(last);
              const streak = c?.flaggedDayStreak ?? 0;
              const hasStreak = streak >= 2;
              return (
                <TableRow
                  key={u.unit_key}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onRowClick(u.unidad)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onRowClick(u.unidad);
                  }}
                >
                  <TableCell className="font-medium min-w-[120px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{u.unidad || 'Sin unidad'}</span>
                      {hasStreak && (
                        <Badge variant="outline" className="text-[10px] h-5 border-amber-300 bg-amber-50 text-amber-900">
                          racha {streak}d
                        </Badge>
                      )}
                      {showLast3Badge && last && (
                        <span className="text-[10px] text-amber-800">últimos 3 días</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.trips.toLocaleString('es-MX')}</TableCell>
                  <TableCell className="text-right tabular-nums text-gray-900">
                    {c != null ? c.validTrips.toLocaleString('es-MX') : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c != null ? (
                      c.flaggedTrips > 0 ? (
                        <span className="text-amber-800 font-medium">{c.flaggedTrips.toLocaleString('es-MX')}</span>
                      ) : (
                        '0'
                      )
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c != null && c.flaggedDayCount > 0 ? c.flaggedDayCount.toLocaleString('es-MX') : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {last ? formatYmd(last) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasStreak ? (
                      <span className="text-amber-900 font-medium tabular-nums">{streak}d</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.unique_drivers.toLocaleString('es-MX')}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.total_volume.toLocaleString('es-MX', { maximumFractionDigits: 2 })} m³
                  </TableCell>
                  <TableCell className="min-w-[200px]">
                    {u.plants.length <= 2 ? (
                      <div className="flex flex-wrap gap-2">
                        {u.plants.map((p) => (
                          <Badge key={p} variant="outline" className="bg-white">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="secondary">{u.plants.length} plantas</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {list.length > maxRows && (
        <div className="px-3 py-2 text-xs text-gray-500 border-t">Mostrando {maxRows} de {list.length} unidades.</div>
      )}
    </div>
  );
}
