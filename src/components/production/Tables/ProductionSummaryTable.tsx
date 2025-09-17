'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Item {
  strength_fc: number;
  recipe_code: string;
  total_volume: number;
  remisiones_count: number;
  avg_cost_per_m3: number;
  total_material_cost: number;
  avg_selling_price?: number;
  margin_per_m3?: number;
  cement_cost: number;
  cement_consumption: number;
}

interface Summary {
  totalVolume: number;
  totalMaterialCost: number;
  weightedAvgCostPerM3: number;
  totalCementCost: number;
  avgCementConsumptionPerM3: number;
  cementCostPercentage: number;
}

interface Props {
  items: Item[];
  summary: Summary;
}

export function ProductionSummaryTable({ items, summary }: Props) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Resistencia</TableHead>
            <TableHead>Código Receta</TableHead>
            <TableHead className="text-right">Volumen (m³)</TableHead>
            <TableHead className="text-right">Remisiones</TableHead>
            <TableHead className="text-right">Costo por m³</TableHead>
            <TableHead className="text-right">Costo Total</TableHead>
            <TableHead className="text-right">Precio Promedio</TableHead>
            <TableHead className="text-right">Margen por m³</TableHead>
            <TableHead className="text-right">% Cemento</TableHead>
            <TableHead className="text-right">Cemento por m³</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={`${item.recipe_code}-${index}`}>
              <TableCell>
                <Badge variant="outline">{item.strength_fc} kg/cm²</Badge>
              </TableCell>
              <TableCell className="font-medium">{item.recipe_code}</TableCell>
              <TableCell className="text-right">{item.total_volume.toFixed(2)}</TableCell>
              <TableCell className="text-right">{item.remisiones_count}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.avg_cost_per_m3)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.total_material_cost)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.avg_selling_price || 0)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.margin_per_m3 || 0)}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-sm font-medium">
                  {((item.cement_cost / Math.max(1, item.total_material_cost)) * 100).toFixed(1)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
                  {(item.cement_consumption / Math.max(1, item.total_volume)).toFixed(1)} kg/m³
                </span>
              </TableCell>
            </TableRow>
          ))}
          {items.length > 0 && (
            <TableRow>
              <TableCell colSpan={2} className="font-bold">TOTAL</TableCell>
              <TableCell className="text-right font-bold">{summary.totalVolume.toFixed(2)}</TableCell>
              <TableCell className="text-right font-bold">{items.reduce((s, i) => s + i.remisiones_count, 0)}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(summary.weightedAvgCostPerM3)}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(summary.totalMaterialCost)}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency((() => {
                const vols = items.reduce((acc, i) => acc + i.total_volume, 0);
                const rev = items.reduce((acc, i) => acc + (i.avg_selling_price || 0) * i.total_volume, 0);
                return vols > 0 ? rev / vols : 0;
              })())}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency((() => {
                const vols = items.reduce((acc, i) => acc + i.total_volume, 0);
                const rev = items.reduce((acc, i) => acc + (i.avg_selling_price || 0) * i.total_volume, 0);
                return vols > 0 ? (rev / vols) - summary.weightedAvgCostPerM3 : 0;
              })())}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-200 text-orange-900 text-sm font-bold">
                  {summary.cementCostPercentage.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-200 text-blue-900 text-sm font-bold">
                  {summary.avgCementConsumptionPerM3.toFixed(1)} kg/m³
                </span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}


