'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RecipeCVBreakdown } from '@/types/clientQuality';

export function ClientCvByRecipeTable({ rows }: { rows: RecipeCVBreakdown[] }) {
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Coeficiente de variación por receta</CardTitle>
        <CardDescription>
          CV calculado sobre promedios de resistencia por muestreo (edad garantía, a tiempo).
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receta</TableHead>
              <TableHead className="text-right">Fc</TableHead>
              <TableHead className="text-right">Ensayos</TableHead>
              <TableHead className="text-right">Muestreos</TableHead>
              <TableHead className="text-right">R prom.</TableHead>
              <TableHead className="text-right">Cumpl. %</TableHead>
              <TableHead className="text-right">CV %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 25).map((r) => (
              <TableRow key={r.recipeCode}>
                <TableCell className="font-medium">{r.recipeCode}</TableCell>
                <TableCell className="text-right">{r.strengthFc}</TableCell>
                <TableCell className="text-right">{r.ensayoCount}</TableCell>
                <TableCell className="text-right">{r.muestreoCount}</TableCell>
                <TableCell className="text-right">{r.avgResistencia.toFixed(1)}</TableCell>
                <TableCell className="text-right">{r.avgCompliance.toFixed(1)}</TableCell>
                <TableCell className="text-right">{r.coefficientVariation.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 25 && (
          <p className="mt-2 text-xs text-muted-foreground">Mostrando 25 de {rows.length} recetas.</p>
        )}
      </CardContent>
    </Card>
  );
}
