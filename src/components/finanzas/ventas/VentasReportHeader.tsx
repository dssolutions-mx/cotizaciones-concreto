'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function VentasReportHeader({ dateRangeText }: { dateRangeText: string }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-large-title mb-2 font-bold text-label-primary">Reporte de Ventas</h1>
        <p className="text-body text-label-secondary">{dateRangeText}</p>
      </div>
      <span className="text-callout text-label-tertiary">
        {format(new Date(), 'dd-MMM-yy hh:mm a', { locale: es })}
      </span>
    </div>
  );
}
