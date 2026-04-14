'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
} from 'lucide-react';
import type { Ensayo, MuestraWithRelations } from '@/types/quality';
import { createSafeDate } from '@/lib/utils';
import { resolveEnsayoResistenciaReportada } from '@/lib/qualityHelpers';

interface AgeGroup {
  ageDays: number;
  specimens: {
    id: string;
    displayName: string;
    resistencia: number;
    cumplimiento: number;
    isGarantia: boolean;
  }[];
  avgResistencia: number;
  avgCumplimiento: number;
}

interface ResistanceEvolutionTimelineProps {
  muestras: MuestraWithRelations[];
  fechaMuestreo: string;
  strengthFc: number | null | undefined;
  displayNameById: Map<string, string>;
}

function computeAgeDays(fechaMuestreo: string, fechaEnsayo: string): number {
  const d0 = createSafeDate(fechaMuestreo);
  const d1 = createSafeDate(fechaEnsayo);
  if (!d0 || !d1) return 0;
  const diffMs = d1.getTime() - d0.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function complianceColor(pct: number): string {
  if (pct >= 100) return 'text-green-700 bg-green-50 border-green-200';
  if (pct >= 70) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function complianceDotColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 70) return 'bg-orange-500';
  return 'bg-red-500';
}

function TrendArrow({ prev, next }: { prev: number; next: number }) {
  const diff = next - prev;
  const absDiff = Math.abs(diff);
  const pctChange = prev > 0 ? ((diff / prev) * 100).toFixed(0) : '—';

  if (absDiff < 0.5) {
    return (
      <div className="flex flex-col items-center gap-0.5 px-1">
        <Minus className="h-4 w-4 text-stone-400" />
        <span className="text-[10px] text-stone-400">≈</span>
      </div>
    );
  }
  if (diff > 0) {
    return (
      <div className="flex flex-col items-center gap-0.5 px-1">
        <TrendingUp className="h-4 w-4 text-green-600" />
        <span className="text-[10px] font-medium text-green-600">+{pctChange}%</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <TrendingDown className="h-4 w-4 text-red-600" />
      <span className="text-[10px] font-medium text-red-600">{pctChange}%</span>
    </div>
  );
}

export default function ResistanceEvolutionTimeline({
  muestras,
  fechaMuestreo,
  strengthFc,
  displayNameById,
}: ResistanceEvolutionTimelineProps) {
  const ageGroups: AgeGroup[] = React.useMemo(() => {
    const groupMap = new Map<number, AgeGroup['specimens']>();

    for (const muestra of muestras) {
      if (!muestra.ensayos || muestra.ensayos.length === 0) continue;

      for (const ensayo of muestra.ensayos) {
        if (ensayo.resistencia_calculada == null) continue;

        const fechaRef = (ensayo as Ensayo & { fecha_ensayo_ts?: string }).fecha_ensayo_ts || ensayo.fecha_ensayo;
        if (!fechaRef) continue;

        const ageDays = computeAgeDays(fechaMuestreo, fechaRef);
        if (ageDays <= 0) continue;

        const existing = groupMap.get(ageDays) || [];
        existing.push({
          id: muestra.id,
          displayName: displayNameById.get(muestra.id) || muestra.identificacion,
          resistencia: resolveEnsayoResistenciaReportada(ensayo as Ensayo),
          cumplimiento: ensayo.porcentaje_cumplimiento ?? 0,
          isGarantia: !!(muestra.is_edad_garantia || ensayo.is_edad_garantia),
        });
        groupMap.set(ageDays, existing);
      }
    }

    const groups: AgeGroup[] = [];
    for (const [ageDays, specimens] of Array.from(groupMap.entries())) {
      type Sp = AgeGroup['specimens'][number];
      const avgResistencia =
        specimens.reduce((s: number, sp: Sp) => s + sp.resistencia, 0) / specimens.length;
      const avgCumplimiento =
        specimens.reduce((s: number, sp: Sp) => s + sp.cumplimiento, 0) / specimens.length;
      groups.push({ ageDays, specimens, avgResistencia, avgCumplimiento });
    }

    groups.sort((a, b) => a.ageDays - b.ageDays);
    return groups;
  }, [muestras, fechaMuestreo, displayNameById]);

  if (ageGroups.length === 0) return null;

  return (
    <Card className="mb-6 border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-stone-600" />
            Evolución de Resistencia
          </CardTitle>
          <CardDescription className="mt-1">
            Resistencia corregida (factor de probeta aplicado en base de datos) por edad de ensayo
            {strengthFc ? ` — f'c = ${strengthFc} kg/cm²` : ''}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* Timeline */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-0 min-w-fit justify-center">
            {ageGroups.map((group, idx) => (
              <React.Fragment key={group.ageDays}>
                {/* Age node */}
                <div className="flex flex-col items-center min-w-[140px]">
                  {/* Age label */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-sm font-bold text-stone-900">
                      {group.ageDays} {group.ageDays === 1 ? 'día' : 'días'}
                    </span>
                    {group.specimens.some(s => s.isGarantia) && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-50 text-sky-800 border-sky-200">
                        Garantía
                      </Badge>
                    )}
                  </div>

                  {/* Resistance value card */}
                  <div className={`rounded-lg border p-3 w-full ${complianceColor(group.avgCumplimiento)}`}>
                    <div className="text-center">
                      <div className="text-xl font-bold leading-tight">
                        {group.avgResistencia.toFixed(0)}
                      </div>
                      <div className="text-[11px] opacity-70 mb-1.5">kg/cm²</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${complianceDotColor(group.avgCumplimiento)}`} />
                        <span className="text-sm font-semibold">
                          {group.avgCumplimiento.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Specimen breakdown (when multiple specimens at same age) */}
                  {group.specimens.length > 1 && (
                    <div className="mt-2 space-y-0.5 w-full">
                      {group.specimens.map((sp, spIdx) => (
                        <div key={`${sp.id}-${spIdx}`} className="flex items-center justify-between text-[10px] text-stone-500 px-1">
                          <span className="truncate max-w-[80px]">{sp.displayName}</span>
                          <span className="font-medium text-stone-700">
                            {sp.resistencia.toFixed(0)} kg/cm²
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {group.specimens.length === 1 && (
                    <div className="mt-1.5 text-[10px] text-stone-400 text-center">
                      {group.specimens[0].displayName}
                    </div>
                  )}
                </div>

                {/* Trend arrow between ages */}
                {idx < ageGroups.length - 1 && (
                  <div className="flex items-center self-center pt-4 mx-1">
                    <div className="w-6 h-px bg-stone-300" />
                    <TrendArrow
                      prev={group.avgResistencia}
                      next={ageGroups[idx + 1].avgResistencia}
                    />
                    <div className="w-6 h-px bg-stone-300" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stone-100">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[11px] text-stone-500">≥ 100%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span className="text-[11px] text-stone-500">70–99%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[11px] text-stone-500">&lt; 70%</span>
          </div>
          <div className="ml-auto text-[11px] text-stone-400">
            % cumplimiento vs f'c
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
