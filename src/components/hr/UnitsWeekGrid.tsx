'use client';

import React, { useMemo } from 'react';
import { EntityWeekGrid, type WeekGridEntityRow } from '@/components/hr/EntityWeekGrid';
import { DateRange } from 'react-day-picker';
import type { HrWeeklyResponse } from '@/services/hrWeeklyRemisionesService';

type ByUnit = HrWeeklyResponse['byUnit'];

type UnitsWeekGridProps = {
  dateRange: DateRange | null;
  byUnit: ByUnit;
  onDayClick?: (date: string) => void;
  onUnitClick?: (unidad: string) => void;
  className?: string;
};

export default function UnitsWeekGrid({
  dateRange,
  byUnit,
  onDayClick,
  onUnitClick,
  className,
}: UnitsWeekGridProps) {
  const rows: WeekGridEntityRow[] = useMemo(
    () =>
      (byUnit ?? []).map((u) => ({
        key: u.unit_key,
        name: u.unidad || 'Sin unidad',
        trips: u.trips,
        dayMatrix: u.dayMatrix,
        complianceDayMatrix: u.complianceDayMatrix,
        compliance: u.compliance,
      })),
    [byUnit],
  );

  return (
    <EntityWeekGrid
      className={className}
      dateRange={dateRange}
      title="Matriz semanal por unidad"
      description="Viajes por unidad (camión) y día, con el mismo criterio de incidencias que en la matriz de conductores. Click en una unidad para filtrar y ver el detalle."
      entityColumnLabel="Unidad"
      rows={rows}
      onDayClick={onDayClick}
      onEntityClick={onUnitClick}
    />
  );
}
