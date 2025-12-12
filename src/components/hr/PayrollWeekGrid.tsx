'use client';

import React, { useMemo } from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type DriverDayMatrix = {
  driver_key: string;
  conductor: string;
  trips: number;
  total_volume: number;
  unique_trucks: number;
  plants: string[];
  dayMatrix: Record<string, number>; // date (yyyy-mm-dd) -> trip count
};

type PayrollWeekGridProps = {
  dateRange: DateRange | null;
  byDriver: DriverDayMatrix[];
  onDayClick?: (date: string) => void;
  onDriverClick?: (driver: string) => void;
  className?: string;
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function PayrollWeekGrid({
  dateRange,
  byDriver,
  onDayClick,
  onDriverClick,
  className,
}: PayrollWeekGridProps) {
  const weekDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const weekStart = startOfWeek(dateRange.from, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(dateRange.to, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    return days.map((day) => ({
      date: day,
      dateStr: format(day, 'yyyy-MM-dd'),
      dayLabel: format(day, 'd', { locale: es }),
      weekday: getDay(day) === 0 ? 6 : getDay(day) - 1, // Mon=0, Sun=6
      weekdayLabel: WEEKDAY_LABELS[getDay(day) === 0 ? 6 : getDay(day) - 1],
    }));
  }, [dateRange]);

  const sortedDrivers = useMemo(() => {
    return [...byDriver].sort((a, b) => b.trips - a.trips || a.conductor.localeCompare(b.conductor));
  }, [byDriver]);

  if (!dateRange?.from || !dateRange?.to || weekDays.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-sm text-gray-500 text-center py-8">Selecciona un rango de fechas para ver la matriz.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Matriz Semanal de Viajes</CardTitle>
        <CardDescription>
          Viajes por conductor y día. Click en una celda para filtrar por día, o en un conductor para filtrar por conductor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <div className="min-w-full inline-block">
            {/* Header row with day labels */}
            <div
              className="grid border-b bg-gray-50 sticky top-0 z-10"
              style={{
                gridTemplateColumns: `200px repeat(${weekDays.length}, minmax(60px, 1fr)) 80px`,
              }}
            >
              <div className="px-4 py-3 font-semibold text-sm text-gray-700 border-r">Conductor</div>
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className="px-2 py-3 text-center border-r last:border-r-0"
                  title={format(day.date, 'EEEE d \'de\' MMMM', { locale: es })}
                >
                  <div className="text-xs font-medium text-gray-600">{day.weekdayLabel}</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{day.dayLabel}</div>
                </div>
              ))}
              <div className="px-3 py-3 text-center font-semibold text-sm text-gray-700 border-l bg-gray-100">
                Total
              </div>
            </div>

            {/* Driver rows */}
            {sortedDrivers.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">No hay conductores en este período.</div>
            ) : (
              sortedDrivers.map((driver, idx) => {
                const rowTotal = Object.values(driver.dayMatrix).reduce((sum, count) => sum + count, 0);
                return (
                  <div
                    key={driver.driver_key}
                    className={cn(
                      'grid border-b last:border-b-0 hover:bg-gray-50/50 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    )}
                    style={{
                      gridTemplateColumns: `200px repeat(${weekDays.length}, minmax(60px, 1fr)) 80px`,
                    }}
                  >
                    {/* Driver name cell */}
                    <div
                      className={cn(
                        'px-4 py-3 border-r font-medium text-sm text-gray-900',
                        onDriverClick && 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors'
                      )}
                      onClick={() => onDriverClick?.(driver.conductor)}
                      role={onDriverClick ? 'button' : undefined}
                      tabIndex={onDriverClick ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (onDriverClick && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onDriverClick(driver.conductor);
                        }
                      }}
                    >
                      {driver.conductor || 'Sin conductor'}
                    </div>

                    {/* Day cells */}
                    {weekDays.map((day) => {
                      const count = driver.dayMatrix[day.dateStr] ?? 0;
                      const hasTrips = count > 0;
                      return (
                        <div
                          key={day.dateStr}
                          className={cn(
                            'px-2 py-3 text-center border-r last:border-r-0 transition-colors',
                            hasTrips && onDayClick && 'cursor-pointer hover:bg-blue-50',
                            hasTrips && 'bg-blue-50/30'
                          )}
                          onClick={() => hasTrips && onDayClick?.(day.dateStr)}
                          role={hasTrips && onDayClick ? 'button' : undefined}
                          tabIndex={hasTrips && onDayClick ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (hasTrips && onDayClick && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              onDayClick(day.dateStr);
                            }
                          }}
                          title={hasTrips ? `${count} viaje${count !== 1 ? 's' : ''} el ${format(day.date, 'd \'de\' MMMM', { locale: es })}` : undefined}
                        >
                          {hasTrips ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                              {count}
                            </Badge>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      );
                    })}

                    {/* Total cell */}
                    <div className="px-3 py-3 text-center border-l bg-gray-100/50">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{rowTotal}</span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer row with column totals */}
            <div
              className="grid border-t-2 border-gray-300 bg-gray-100 font-semibold"
              style={{
                gridTemplateColumns: `200px repeat(${weekDays.length}, minmax(60px, 1fr)) 80px`,
              }}
            >
              <div className="px-4 py-3 text-sm text-gray-700 border-r">Total</div>
              {weekDays.map((day) => {
                const dayTotal = sortedDrivers.reduce((sum, driver) => sum + (driver.dayMatrix[day.dateStr] ?? 0), 0);
                return (
                  <div key={day.dateStr} className="px-2 py-3 text-center border-r last:border-r-0">
                    <span className="text-sm text-gray-900 tabular-nums">{dayTotal}</span>
                  </div>
                );
              })}
              <div className="px-3 py-3 text-center border-l bg-gray-200">
                <span className="text-sm text-gray-900 tabular-nums">
                  {sortedDrivers.reduce((sum, driver) => sum + Object.values(driver.dayMatrix).reduce((s, c) => s + c, 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
