'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign, BarChart3, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Props {
  totalVolume: number;
  totalMaterialCost: number;
  weightedAvgCostPerM3: number;
  totalCementConsumption: number;
}

export function SummaryCards({ totalVolume, totalMaterialCost, weightedAvgCostPerM3, totalCementConsumption }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Volumen Total</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalVolume.toFixed(1)} m³</div>
          <p className="text-xs text-muted-foreground">Concreto producido en el período</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Costo Total de Materiales</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalMaterialCost)}</div>
          <p className="text-xs text-muted-foreground">Inversión en materias primas</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Costo Promedio</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(weightedAvgCostPerM3)}</div>
          <p className="text-xs text-muted-foreground">por m³ (costo ponderado)</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Consumo Cemento</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(totalCementConsumption / 1000).toFixed(1)} t</div>
          <p className="text-xs text-muted-foreground">Total de cemento utilizado</p>
        </CardContent>
      </Card>
      <div />
    </div>
  );
}


