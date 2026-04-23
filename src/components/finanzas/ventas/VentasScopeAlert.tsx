'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface VentasScopeAlertProps {
  scopePlantSummary: string;
  dateRangeText: string;
  streaming: boolean;
  streamingPercent: number;
  remisionesMissingOrderCount: number;
}

export function VentasScopeAlert({
  scopePlantSummary,
  dateRangeText,
  streaming,
  streamingPercent,
  remisionesMissingOrderCount,
}: VentasScopeAlertProps) {
  return (
    <Alert className="mb-6 border-border bg-card">
      <AlertTitle className="text-sm font-medium text-foreground">Alcance del reporte</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground space-y-1">
        <p>
          {scopePlantSummary}. <span className="text-foreground font-medium">Rango:</span> {dateRangeText}.{' '}
          Totales por <span className="text-foreground font-medium">fecha de remisión</span>
          {streaming ? ` · Cargando datos ${streamingPercent}%` : ''}.
        </p>
        {remisionesMissingOrderCount > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            {remisionesMissingOrderCount} remisión(es) con volumen no tienen orden cargada; los importes pueden
            quedar bajo respecto al volumen.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
