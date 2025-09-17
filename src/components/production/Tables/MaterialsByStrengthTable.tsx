'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

export interface MaterialBreakdownRow {
  material_type: string;
  material_name: string;
  total_consumption: number;
  unit: string;
  total_cost: number;
  cost_per_unit: number;
}

export interface StrengthAggregation {
  strength_fc: number;
  total_volume: number;
  total_cost: number;
  breakdown: Map<string, MaterialBreakdownRow> | MaterialBreakdownRow[];
}

interface Props {
  strengths: StrengthAggregation[];
}

export function MaterialsByStrengthTable({ strengths }: Props) {
  if (!strengths || strengths.length === 0) return null;

  const normalized = strengths.map((agg) => ({
    strength_fc: agg.strength_fc,
    total_volume: agg.total_volume,
    total_cost: agg.total_cost,
    breakdownArray: Array.isArray(agg.breakdown)
      ? (agg.breakdown as MaterialBreakdownRow[])
      : Array.from((agg.breakdown as Map<string, MaterialBreakdownRow>).values()),
  })).sort((a, b) => a.strength_fc - b.strength_fc);

  return (
    <div className="space-y-6">
      {normalized.map((agg, idx) => (
        <Card key={idx}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold mb-1">Resistencia {agg.strength_fc} kg/cm²</h4>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{agg.strength_fc} kg/cm²</Badge>
                  <span className="text-sm text-muted-foreground">Volumen total: {agg.total_volume.toFixed(2)} m³</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{formatCurrency(agg.total_cost)}</div>
                <div className="text-sm text-muted-foreground">Costo total</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Consumo Total</TableHead>
                    <TableHead className="text-right">Unidad</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                    <TableHead className="text-right">Costo por m³</TableHead>
                    <TableHead className="text-right">Costo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agg.breakdownArray
                    .sort((a, b) => b.total_cost - a.total_cost)
                    .map((material, i) => {
                      const costPerM3 = agg.total_volume > 0 ? material.total_cost / agg.total_volume : 0;
                      return (
                        <TableRow key={`${material.material_name}-${i}`}>
                          <TableCell className="font-medium">{material.material_name}</TableCell>
                          <TableCell className="text-right">{material.total_consumption.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{material.unit}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(material.cost_per_unit)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(costPerM3)}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(material.total_cost)}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


