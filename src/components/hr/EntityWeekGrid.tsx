'use client';

import React, { useMemo } from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type WeekGridEntityRow = {
  key: string;
  name: string;
  trips: number;
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

export type EntityWeekGridProps = {
  dateRange: DateRange | null;
  title: string;
  description: React.ReactNode;
  /** First column header, e.g. "Conductor" or "Unidad" */
  entityColumnLabel: string;
  rows: WeekGridEntityRow[];
  onDayClick?: (date: string) => void;
  onEntityClick?: (name: string) => void;
  className?: string;
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatDisplayDate(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return format(d, 'd MMM', { locale: es });
}

export function EntityWeekGrid({
  dateRange,
  title,
  description,
  entityColumnLabel,
  rows: rawRows,
  onDayClick,
  onEntityClick,
  className,
}: EntityWeekGridProps) {
  const weekDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const wStart = startOfWeek(dateRange.from, { weekStartsOn: 1 });
    const wEnd = endOfWeek(dateRange.to, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: wStart, end: wEnd });
    return days.map((day) => ({
      date: day,
      dateStr: format(day, 'yyyy-MM-dd'),
      dayLabel: format(day, 'd', { locale: es }),
      weekday: getDay(day) === 0 ? 6 : getDay(day) - 1,
      weekdayLabel: WEEKDAY_LABELS[getDay(day) === 0 ? 6 : getDay(day) - 1],
    }));
  }, [dateRange]);

  const last3DateStrs = useMemo(() => {
    if (weekDays.length < 3) return weekDays.map((d) => d.dateStr);
    return weekDays.slice(-3).map((d) => d.dateStr);
  }, [weekDays]);

  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name));
  }, [rawRows]);

  const hasAnyCompliance = useMemo(
    () => sortedRows.some((r) => r.compliance != null || (r.complianceDayMatrix && Object.values(r.complianceDayMatrix).some((n) => n > 0))),
    [sortedRows],
  );

  const dayIncidentTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of weekDays) {
      let sum = 0;
      for (const r of sortedRows) {
        sum += r.complianceDayMatrix?.[d.dateStr] ?? 0;
      }
      m[d.dateStr] = sum;
    }
    return m;
  }, [weekDays, sortedRows]);

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
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <div className="min-w-full inline-block">
            <div
              className="grid border-b bg-gray-50 sticky top-0 z-10"
              style={{
                gridTemplateColumns: `minmax(200px, 1.1fr) repeat(${weekDays.length}, minmax(64px, 1fr)) 92px`,
              }}
            >
              <div className="px-4 py-3 font-semibold text-sm text-gray-700 border-r">{entityColumnLabel}</div>
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className="px-2 py-3 text-center border-r last:border-r-0"
                  title={format(day.date, "EEEE d 'de' MMMM", { locale: es })}
                >
                  <div className="text-xs font-medium text-gray-600">{day.weekdayLabel}</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{day.dayLabel}</div>
                </div>
              ))}
              <div className="px-3 py-3 text-center font-semibold text-sm text-gray-700 border-l bg-gray-100">Total</div>
            </div>

            {sortedRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">No hay filas en este período.</div>
            ) : (
              sortedRows.map((row, idx) => {
                const rowTotal = Object.values(row.dayMatrix).reduce((sum, c) => sum + c, 0);
                const comp = row.compliance;
                const showLastChip =
                  comp?.lastFlaggedDate && last3DateStrs.includes(comp.lastFlaggedDate);
                return (
                  <div
                    key={row.key}
                    className={cn(
                      'grid border-b last:border-b-0 hover:bg-gray-50/50 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                    )}
                    style={{
                      gridTemplateColumns: `minmax(200px, 1.1fr) repeat(${weekDays.length}, minmax(64px, 1fr)) 92px`,
                    }}
                  >
                    <div
                      className={cn(
                        'px-4 py-3 border-r text-sm text-gray-900',
                        onEntityClick && 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors',
                      )}
                      onClick={() => onEntityClick?.(row.name)}
                      role={onEntityClick ? 'button' : undefined}
                      tabIndex={onEntityClick ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (onEntityClick && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onEntityClick(row.name);
                        }
                      }}
                    >
                      <div className="font-medium">{row.name || '—'}</div>
                      {comp && row.trips > 0 ? (
                        <div
                          className="mt-1.5 text-[11px] text-gray-600 leading-snug flex flex-wrap items-center gap-1.5"
                          title="Válido: remisiones sin hallazgo vinculado. Incid.: con al menos un hallazgo."
                        >
                          <span className="tabular-nums text-gray-800 font-medium">
                            {comp.validTrips} válid.{comp.validTrips === 1 ? 'o' : 'os'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="tabular-nums text-amber-800 font-medium">{comp.flaggedTrips} incid.</span>
                          {comp.flaggedDayStreak >= 2 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5 border-amber-300 bg-amber-50 text-amber-900"
                              title="Incidencia N días consecutivos (por hallazgo en días consecutivos)"
                            >
                              racha {comp.flaggedDayStreak}d
                            </Badge>
                          )}
                          {showLastChip && comp.lastFlaggedDate && (
                            <span className="text-[10px] text-amber-900" title="Último día con al menos un viaje con incidencia en el rango">
                              último: {formatDisplayDate(comp.lastFlaggedDate)}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {weekDays.map((day) => {
                      const count = row.dayMatrix[day.dateStr] ?? 0;
                      const flagged = row.complianceDayMatrix?.[day.dateStr] ?? 0;
                      const hasTrips = count > 0;
                      const hasIncident = flagged > 0;
                      const dayTitle = hasTrips
                        ? hasIncident
                          ? `${count} viaje${count !== 1 ? 's' : ''} · ${flagged} con incidencia el ${format(day.date, "d 'de' MMMM", { locale: es })}`
                          : `${count} viaje${count !== 1 ? 's' : ''} el ${format(day.date, "d 'de' MMMM", { locale: es })}`
                        : undefined;
                      return (
                        <div
                          key={day.dateStr}
                          className={cn(
                            'px-1.5 py-2.5 text-center border-r last:border-r-0 transition-colors',
                            hasTrips && onDayClick && 'cursor-pointer hover:opacity-90',
                            hasIncident && 'bg-amber-50/80',
                            hasTrips && !hasIncident && 'bg-blue-50/30',
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
                          title={dayTitle}
                        >
                          {hasTrips ? (
                            hasIncident ? (
                              <div className="flex flex-col items-center justify-center min-h-[44px] gap-0.5">
                                <span className="text-base font-semibold text-amber-900 tabular-nums leading-none">
                                  {count}
                                </span>
                                <span className="text-[9px] text-amber-800/90 tabular-nums leading-tight">
                                  {flagged}/{count} incid.
                                </span>
                              </div>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"
                              >
                                {count}
                              </Badge>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      );
                    })}

                    <div className="px-2 py-3 text-center border-l bg-gray-100/50">
                      <div className="text-sm font-semibold text-gray-900 tabular-nums leading-none">{rowTotal}</div>
                      {comp && rowTotal > 0 ? (
                        <div className="mt-1 text-[10px] text-gray-500 leading-tight">
                          {comp.validTrips}/{rowTotal} vál. · {comp.flaggedTrips} incid.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}

            <div
              className="grid border-t-2 border-gray-300 bg-gray-100 font-semibold"
              style={{
                gridTemplateColumns: `minmax(200px, 1.1fr) repeat(${weekDays.length}, minmax(64px, 1fr)) 92px`,
              }}
            >
              <div className="px-4 py-3 text-sm text-gray-700 border-r">Total viajes</div>
              {weekDays.map((day) => {
                const dayTotal = sortedRows.reduce((sum, r) => sum + (r.dayMatrix[day.dateStr] ?? 0), 0);
                return (
                  <div key={day.dateStr} className="px-2 py-3 text-center border-r last:border-r-0">
                    <span className="text-sm text-gray-900 tabular-nums">{dayTotal}</span>
                  </div>
                );
              })}
              <div className="px-3 py-3 text-center border-l bg-gray-200">
                <span className="text-sm text-gray-900 tabular-nums">
                  {sortedRows.reduce((sum, r) => sum + Object.values(r.dayMatrix).reduce((s, c) => s + c, 0), 0)}
                </span>
              </div>
            </div>

            {hasAnyCompliance ? (
              <div
                className="grid border-t border-amber-200 bg-amber-50/50 text-amber-950"
                style={{
                  gridTemplateColumns: `minmax(200px, 1.1fr) repeat(${weekDays.length}, minmax(64px, 1fr)) 92px`,
                }}
              >
                <div className="px-4 py-2.5 text-xs font-medium text-amber-900 border-r">Incid. por día (viajes c/hallazgo)</div>
                {weekDays.map((day) => {
                  const n = dayIncidentTotals[day.dateStr] ?? 0;
                  return (
                    <div key={day.dateStr} className="px-2 py-2.5 text-center border-r last:border-r-0">
                      <span className="text-xs font-semibold tabular-nums">{n}</span>
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 text-center border-l bg-amber-100/60">
                  <span className="text-xs font-semibold tabular-nums">
                    {Object.values(dayIncidentTotals).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
