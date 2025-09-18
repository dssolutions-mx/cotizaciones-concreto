'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@mui/x-charts/ChartContainer';
import { BarPlot } from '@mui/x-charts/BarChart';
import { LinePlot } from '@mui/x-charts/LineChart';
import { ChartsXAxis, ChartsYAxis, ChartsLegend, ChartsTooltip } from '@mui/x-charts';

interface Period {
  label: string;
  avgCostPerM3: number;
  volume: number;
  cement?: number; sands?: number; gravels?: number; additives?: number;
  efficiencyMean?: number | null;
  passRate?: number | null;
  avgYield?: number | null;
}

export function CostsChart({ byPeriod }: { byPeriod: Period[] }) {
  const categories = byPeriod.map(p => p.label).reverse();
  const stackedBars = [
    { type: 'bar', label: 'Cemento', data: byPeriod.map(p => (p.cement || 0)).reverse(), stack: 'mat', color: '#6b7280', yAxisId: 'cost' },
    { type: 'bar', label: 'Arenas', data: byPeriod.map(p => (p.sands || 0)).reverse(), stack: 'mat', color: '#94a3b8', yAxisId: 'cost' },
    { type: 'bar', label: 'Gravas', data: byPeriod.map(p => (p.gravels || 0)).reverse(), stack: 'mat', color: '#cbd5e1', yAxisId: 'cost' },
    { type: 'bar', label: 'Aditivos', data: byPeriod.map(p => (p.additives || 0)).reverse(), stack: 'mat', color: '#a3e635', yAxisId: 'cost' },
  ];
  const line = { type: 'line', label: 'Costo/m³', data: byPeriod.map(p => p.avgCostPerM3).reverse(), yAxisId: 'unit' } as any;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costos por período</CardTitle>
      </CardHeader>
      <CardContent>
        {byPeriod.length === 0 ? (
          <div className="text-sm text-gray-500">Sin datos</div>
        ) : (
          <ChartContainer
            height={480}
            series={[...stackedBars as any[], line]}
            xAxis={[{ data: categories, scaleType: 'point' }]}
            yAxis={[{ id: 'cost', label: 'Costo total', scaleType: 'linear' }, { id: 'unit', label: 'Costo/m³', scaleType: 'linear' }] as any}
          >
            <BarPlot />
            <LinePlot />
            <ChartsXAxis />
            <ChartsYAxis axisId="cost" />
            <ChartsYAxis axisId="unit" />
            <ChartsLegend />
            <ChartsTooltip />
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function EfficiencyChart({ byPeriod }: { byPeriod: Period[] }) {
  const categories = byPeriod.map(p => p.label).reverse();
  const efficiency = { type: 'line', label: 'Eficiencia media', data: byPeriod.map(p => p.efficiencyMean || 0).reverse(), yAxisId: 'eff' } as any;
  const pass = { type: 'line', label: 'Cumplimiento %', data: byPeriod.map(p => (p.passRate || 0)).reverse(), yAxisId: 'rate' } as any;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eficiencia y cumplimiento</CardTitle>
      </CardHeader>
      <CardContent>
        {byPeriod.length === 0 ? (
          <div className="text-sm text-gray-500">Sin datos</div>
        ) : (
          <ChartContainer
            height={420}
            series={[efficiency, pass]}
            xAxis={[{ data: categories, scaleType: 'point' }]}
            yAxis={[{ id: 'eff', label: 'Eficiencia', scaleType: 'linear' }, { id: 'rate', label: 'Cumplimiento %', scaleType: 'linear' }] as any}
          >
            <LinePlot />
            <ChartsXAxis />
            <ChartsYAxis axisId="eff" />
            <ChartsYAxis axisId="rate" />
            <ChartsLegend />
            <ChartsTooltip />
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function YieldChart({ byPeriod }: { byPeriod: Period[] }) {
  const categories = byPeriod.map(p => p.label).reverse();
  const yieldSeries = { type: 'line', label: 'Rendimiento', data: byPeriod.map(p => (p.avgYield || 0)).reverse() } as any;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento volumétrico</CardTitle>
      </CardHeader>
      <CardContent>
        {byPeriod.length === 0 ? (
          <div className="text-sm text-gray-500">Sin datos</div>
        ) : (
          <ChartContainer height={380} series={[yieldSeries]} xAxis={[{ data: categories, scaleType: 'point' }]}> 
            <LinePlot />
            <ChartsXAxis />
            <ChartsYAxis />
            <ChartsLegend />
            <ChartsTooltip />
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}


