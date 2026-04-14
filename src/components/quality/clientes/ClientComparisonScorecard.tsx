'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ClientQualitySummary } from '@/types/clientQuality';
import { Loader2 } from 'lucide-react';

function Metric({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-stone-900">
        {value}
        {suffix && <span className="text-sm font-normal text-stone-600">{suffix}</span>}
      </div>
    </div>
  );
}

export interface ClientComparisonScorecardProps {
  primaryLabel: string;
  primarySummary: ClientQualitySummary | null;
  compareLabel: string;
  compareSummary: ClientQualitySummary | null;
  compareLoading?: boolean;
  onClearCompare?: () => void;
}

export function ClientComparisonScorecard({
  primaryLabel,
  primarySummary,
  compareLabel,
  compareSummary,
  compareLoading,
  onClearCompare,
}: ClientComparisonScorecardProps) {
  if (!primarySummary) return null;

  const col = (s: ClientQualitySummary | null) => {
    if (!s) {
      return (
        <div className="text-sm text-stone-500 py-6 text-center">Sin datos en el período</div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Volumen" value={s.totals.volume.toFixed(1)} suffix=" m³" />
        <Metric label="Cumplimiento" value={s.averages.complianceRate.toFixed(1)} suffix="%" />
        <Metric label="Resistencia" value={s.averages.resistencia.toFixed(1)} suffix=" kg/cm²" />
        <Metric label="CV" value={s.averages.coefficientVariation.toFixed(2)} suffix="%" />
        <Metric label="Rend. vol." value={s.averages.rendimientoVolumetrico.toFixed(1)} suffix="%" />
        <Metric label="Ensayos EG" value={String(s.totals.ensayosEdadGarantia)} />
      </div>
    );
  };

  return (
    <Card className="border-stone-200 bg-stone-50/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Comparación de clientes</CardTitle>
        {onClearCompare && compareSummary && (
          <Button variant="ghost" size="sm" onClick={onClearCompare} className="text-stone-600">
            Quitar comparación
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium text-stone-800">{primaryLabel}</div>
            {col(primarySummary)}
          </div>
                   <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-800">
              {compareLabel}
              {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
            </div>
            {compareLoading && !compareSummary ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white py-10 text-sm text-stone-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando comparación…
              </div>
            ) : compareSummary ? (
              col(compareSummary)
            ) : (
              <div className="rounded-lg border border-dashed border-stone-300 bg-white/80 py-8 text-center text-sm text-stone-500">
                Selecciona un segundo cliente para comparar métricas lado a lado.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
