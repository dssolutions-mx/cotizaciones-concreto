'use client';

import React, { useMemo } from 'react';
import { EntityWeekGrid, type WeekGridEntityRow } from '@/components/hr/EntityWeekGrid';
import { DateRange } from 'react-day-picker';

type DriverDayMatrix = {
  driver_key: string;
  conductor: string;
  trips: number;
  total_volume: number;
  unique_trucks: number;
  plants: string[];
  dayMatrix: Record<string, number>;
  complianceDayMatrix?: Record<string, number>;
  compliance?: {
    validTrips: number;
    flaggedTrips: number;
    lastFlaggedDate: string | null;
    flaggedDayStreak: number;
    flaggedDayCount: number;
  };
};

type PayrollWeekGridProps = {
  dateRange: DateRange | null;
  byDriver: DriverDayMatrix[];
  onDayClick?: (date: string) => void;
  onDriverClick?: (driver: string) => void;
  className?: string;
};

export default function PayrollWeekGrid({
  dateRange,
  byDriver,
  onDayClick,
  onDriverClick,
  className,
}: PayrollWeekGridProps) {
  const rows: WeekGridEntityRow[] = useMemo(
    () =>
      byDriver.map((d) => ({
        key: d.driver_key,
        name: d.conductor || 'Sin conductor',
        trips: d.trips,
        dayMatrix: d.dayMatrix,
        complianceDayMatrix: d.complianceDayMatrix,
        compliance: d.compliance,
      })),
    [byDriver],
  );

  return (
    <EntityWeekGrid
      className={className}
      dateRange={dateRange}
      title="Matriz Semanal de Viajes"
      description={
        <>
          Viajes por conductor y día. Si hay datos de cumplimiento, celdas con incidencia se muestran en ámbar. Click
          en una celda para filtrar por día, o en un conductor para filtrar por conductor.
        </>
      }
      entityColumnLabel="Conductor"
      rows={rows}
      onDayClick={onDayClick}
      onEntityClick={onDriverClick}
    />
  );
}
