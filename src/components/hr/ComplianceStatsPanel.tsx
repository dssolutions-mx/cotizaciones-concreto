'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import type { ComplianceRemisionStats } from '@/lib/hr/complianceStats';
import { cn } from '@/lib/utils';

type Props = {
  stats: ComplianceRemisionStats;
  className?: string;
};

function PctBar({ pct, className }: { pct: number; className?: string }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn('h-2 w-full max-w-[140px] rounded-full bg-gray-100 overflow-hidden', className)}>
      <div
        className="h-full rounded-full bg-amber-500 transition-[width]"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function ComplianceStatsPanel({ stats, className }: Props) {
  const { totalRemisiones, remisionesConHallazgo, remisionesSinHallazgo, pctConHallazgo, byRule } =
    stats;

  return (
    <Card className={cn('border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">Estadísticas de cumplimiento (remisiones)</CardTitle>
            <CardDescription className="mt-1">
              Números basados en el motor de cumplimiento diario y las remisiones del mismo filtro
              (fechas, plantas, conductores). Una misma remisión puede contar en varias filas si aplica
              a más de un tipo de hallazgo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total remisiones</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">
              {totalRemisiones.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-gray-500 mt-2">En el período con filtros actuales</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
            <p className="text-xs font-medium text-amber-900/80 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Con hallazgo vinculado
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-amber-950">
              {remisionesConHallazgo.toLocaleString('es-MX')}
              <span className="text-lg font-medium text-amber-800/90 ml-1">
                ({pctConHallazgo}%)
              </span>
            </p>
            <p className="text-xs text-amber-900/70 mt-2">
              Al menos un hallazgo que referencia el id de la remisión
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sin hallazgo en motor</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">
              {remisionesSinHallazgo.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {totalRemisiones > 0
                ? `${(100 - pctConHallazgo).toLocaleString('es-MX', { maximumFractionDigits: 1 })}% del total`
                : '—'}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Desglose por tipo de hallazgo</h4>
          <p className="text-xs text-gray-500 mb-3">
            Ejemplo: «{byRule[0]?.remisionCount ?? '—'} de {totalRemisiones.toLocaleString('es-MX')}» en la
            primera fila indica cuántas remisiones distintas tuvieron ese tipo de incidencia.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="min-w-[200px]">Tipo</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Remisiones</TableHead>
                  <TableHead className="text-right whitespace-nowrap">% del total</TableHead>
                  <TableHead className="min-w-[160px] hidden sm:table-cell">Proporción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRule.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500 text-sm">
                      No hay hallazgos vinculados a remisiones en este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  byRule.map((row) => (
                    <TableRow key={row.rule}>
                      <TableCell className="text-sm font-medium text-gray-900">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-semibold">{row.remisionCount.toLocaleString('es-MX')}</span>
                        <span className="text-gray-500 text-xs ml-1">de {totalRemisiones.toLocaleString('es-MX')}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-gray-700">
                        {row.pctOfTotal.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%
                      </TableCell>
                      <TableCell className="hidden sm:table-cell align-middle">
                        <PctBar pct={row.pctOfTotal} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
