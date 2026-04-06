'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Settings2,
} from 'lucide-react';
import { MuestraWithRelations } from '@/types/quality';
import { createSafeDate } from '@/lib/utils';

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
        <Minus className="h-4 w-4 text-gray-400" />
        <span className="text-[10px] text-gray-400">≈</span>
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
  const [factorActive, setFactorActive] = useState(false);
  const [factorValue, setFactorValue] = useState(0.92);

  const applyFactor = (val: number) => factorActive ? val * factorValue : val;

  const ageGroups: AgeGroup[] = React.useMemo(() => {
    const groupMap = new Map<number, AgeGroup['specimens']>();

    for (const muestra of muestras) {
      if (!muestra.ensayos || muestra.ensayos.length === 0) continue;

      for (const ensayo of muestra.ensayos) {
        if (ensayo.resistencia_calculada == null) continue;

        const fechaRef = (ensayo as any).fecha_ensayo_ts || ensayo.fecha_ensayo;
        if (!fechaRef) continue;

        const ageDays = computeAgeDays(fechaMuestreo, fechaRef);
        if (ageDays <= 0) continue;

        const existing = groupMap.get(ageDays) || [];
        existing.push({
          id: muestra.id,
          displayName: displayNameById.get(muestra.id) || muestra.identificacion,
          resistencia: ensayo.resistencia_calculada,
          cumplimiento: ensayo.porcentaje_cumplimiento ?? 0,
          isGarantia: !!(muestra.is_edad_garantia || ensayo.is_edad_garantia),
        });
        groupMap.set(ageDays, existing);
      }
    }

    const groups: AgeGroup[] = [];
    for (const [ageDays, specimens] of groupMap) {
      const avgResistencia =
        specimens.reduce((s, sp) => s + sp.resistencia, 0) / specimens.length;
      const avgCumplimiento =
        specimens.reduce((s, sp) => s + sp.cumplimiento, 0) / specimens.length;
      groups.push({ ageDays, specimens, avgResistencia, avgCumplimiento });
    }

    groups.sort((a, b) => a.ageDays - b.ageDays);
    return groups;
  }, [muestras, fechaMuestreo, displayNameById]);

  if (ageGroups.length === 0) return null;

  return (
    <Card className="mb-6 border border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-gray-600" />
              Evolución de Resistencia
              {factorActive && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 font-normal">
                  Factor ×{factorValue}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Resistencia a compresión por edad de ensayo
              {strengthFc ? ` — f'c = ${strengthFc} kg/cm²` : ''}
            </CardDescription>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={factorActive ? "default" : "outline"}
                size="sm"
                className={`h-8 gap-1.5 ${factorActive ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Factor
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Factor de Corrección</Label>
                  <Button
                    variant={factorActive ? "destructive" : "default"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setFactorActive(!factorActive)}
                  >
                    {factorActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="timeline-factor" className="text-xs text-gray-500 whitespace-nowrap">
                    Valor:
                  </Label>
                  <Input
                    id="timeline-factor"
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.5"
                    value={factorValue}
                    onChange={(e) => setFactorValue(parseFloat(e.target.value) || 0.92)}
                    className="h-8 w-20 text-center"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Multiplica la resistencia y el % de cumplimiento por el factor indicado.
                </p>
              </div>
            </PopoverContent>
          </Popover>
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
                    <span className="text-sm font-bold text-gray-900">
                      {group.ageDays} {group.ageDays === 1 ? 'día' : 'días'}
                    </span>
                    {group.specimens.some(s => s.isGarantia) && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                        Garantía
                      </Badge>
                    )}
                  </div>

                  {/* Resistance value card */}
                  <div className={`rounded-lg border p-3 w-full ${complianceColor(applyFactor(group.avgCumplimiento))}`}>
                    <div className="text-center">
                      <div className="text-xl font-bold leading-tight">
                        {applyFactor(group.avgResistencia).toFixed(0)}
                      </div>
                      <div className="text-[11px] opacity-70 mb-1.5">kg/cm²</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${complianceDotColor(applyFactor(group.avgCumplimiento))}`} />
                        <span className="text-sm font-semibold">
                          {applyFactor(group.avgCumplimiento).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Specimen breakdown (when multiple specimens at same age) */}
                  {group.specimens.length > 1 && (
                    <div className="mt-2 space-y-0.5 w-full">
                      {group.specimens.map((sp, spIdx) => (
                        <div key={`${sp.id}-${spIdx}`} className="flex items-center justify-between text-[10px] text-gray-500 px-1">
                          <span className="truncate max-w-[80px]">{sp.displayName}</span>
                          <span className="font-medium text-gray-700">
                            {applyFactor(sp.resistencia).toFixed(0)} kg/cm²
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {group.specimens.length === 1 && (
                    <div className="mt-1.5 text-[10px] text-gray-400 text-center">
                      {group.specimens[0].displayName}
                    </div>
                  )}
                </div>

                {/* Trend arrow between ages */}
                {idx < ageGroups.length - 1 && (
                  <div className="flex items-center self-center pt-4 mx-1">
                    <div className="w-6 h-px bg-gray-300" />
                    <TrendArrow
                      prev={applyFactor(group.avgResistencia)}
                      next={applyFactor(ageGroups[idx + 1].avgResistencia)}
                    />
                    <div className="w-6 h-px bg-gray-300" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[11px] text-gray-500">≥ 100%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span className="text-[11px] text-gray-500">70–99%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[11px] text-gray-500">&lt; 70%</span>
          </div>
          <div className="ml-auto text-[11px] text-gray-400">
            % cumplimiento vs f'c
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
