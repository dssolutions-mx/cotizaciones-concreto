'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

interface ClientRecipePerformanceTableProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function ClientRecipePerformanceTable({ data, summary }: ClientRecipePerformanceTableProps) {
  const cvByRecipe = summary.averages.cvByRecipe || [];
  const cvMap = useMemo(
    () => new Map(cvByRecipe.map((r) => [r.recipeCode, r.coefficientVariation])),
    [cvByRecipe]
  );

  const rows = [...data.qualityByRecipe].sort((a, b) => b.totalVolume - a.totalVolume);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Rendimiento por receta</CardTitle>
        <CardDescription>
          Volumen, resistencia promedio, cumplimiento y CV (entre muestreos) por código de receta.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receta</TableHead>
              <TableHead className="text-right">Fc</TableHead>
              <TableHead className="text-right">Volumen (m³)</TableHead>
              <TableHead className="text-right">Ensayos</TableHead>
              <TableHead className="text-right">R (kg/cm²)</TableHead>
              <TableHead className="text-right">Cumpl. %</TableHead>
              <TableHead className="text-right">CV %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.recipeCode}-${r.recipeFc}`}>
                <TableCell className="font-medium">{r.recipeCode || '—'}</TableCell>
                <TableCell className="text-right">{r.recipeFc}</TableCell>
                <TableCell className="text-right">{r.totalVolume.toFixed(1)}</TableCell>
                <TableCell className="text-right">{r.totalTests}</TableCell>
                <TableCell className="text-right">{r.avgResistencia.toFixed(1)}</TableCell>
                <TableCell className="text-right">{r.complianceRate.toFixed(1)}</TableCell>
                <TableCell className="text-right">
                  {(cvMap.get(r.recipeCode) ?? 0).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
