'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatNumber } from '@/lib/utils';

interface EfficiencyChartProps {
  byPeriod: Array<{
    label: string;
    efficiencyMean: number;
    passRate: number | null;
    volume: number;
    efficiencyCOV?: number;
  }>;
}

export const EfficiencyChart: React.FC<EfficiencyChartProps> = ({ byPeriod }) => {
  const chartData = useMemo(() => {
    // Filter out periods with no efficiency data and format properly
    return byPeriod
      .filter(period => period.volume > 0 && period.efficiencyMean > 0 && period.passRate !== null)
      .map(period => ({
        period: period.label,
        efficiency: Number(period.efficiencyMean.toFixed(3)),
        passRate: Number((period.passRate! * 100).toFixed(1)), // Convert to percentage
        volume: period.volume,
        cov: period.efficiencyCOV ? Number((period.efficiencyCOV * 100).toFixed(1)) : null,
      }));
  }, [byPeriod]);

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Eficiencia</CardTitle>
          <CardDescription>Evolución de eficiencia y cumplimiento por período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">Sin datos de eficiencia</div>
              <div className="text-sm">Esta receta no tiene ensayos a edad de garantía en el período seleccionado</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate dynamic Y-axis domain for efficiency
  const efficiencyValues = chartData.map(d => d.efficiency);
  const minEff = Math.min(...efficiencyValues);
  const maxEff = Math.max(...efficiencyValues);
  const padding = (maxEff - minEff) * 0.1;
  const efficiencyDomain = [
    Math.max(0.7, minEff - padding),
    Math.min(1.5, maxEff + padding)
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Eficiencia</CardTitle>
        <CardDescription>
          Eficiencia promedio y tasa de cumplimiento por período • {chartData.length} período{chartData.length > 1 ? 's' : ''} con datos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="efficiency" 
              orientation="left" 
              domain={efficiencyDomain}
              tickFormatter={(value) => `${value.toFixed(2)}x`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Eficiencia', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <YAxis 
              yAxisId="passRate" 
              orientation="right" 
              domain={[0, 100]} 
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Cumplimiento (%)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value, name) => {
                if (name === 'Cumplimiento') return [`${value}%`, 'Tasa de Cumplimiento'];
                if (name === 'Eficiencia') return [`${formatNumber(value as number, { minimumFractionDigits: 3 })}x`, 'Eficiencia Promedio'];
                return [value, name];
              }}
              labelFormatter={(label) => `Período: ${label}`}
            />
            <ReferenceLine 
              yAxisId="efficiency" 
              y={1.0} 
              stroke="#dc2626" 
              strokeDasharray="4 4" 
              strokeWidth={2}
              label={{ value: "f'c Objetivo", position: "topRight", fontSize: 11 }}
            />
            <Line 
              yAxisId="efficiency" 
              type="monotone" 
              dataKey="efficiency" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={{ r: 5, fill: "#2563eb", strokeWidth: 2, stroke: "white" }}
              activeDot={{ r: 7, fill: "#2563eb" }}
              name="Eficiencia" 
            />
            <Line 
              yAxisId="passRate" 
              type="monotone" 
              dataKey="passRate" 
              stroke="#059669" 
              strokeWidth={2} 
              dot={{ r: 4, fill: "#059669", strokeWidth: 2, stroke: "white" }}
              activeDot={{ r: 6, fill: "#059669" }}
              name="Cumplimiento" 
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="font-medium text-blue-900">Eficiencia Promedio</div>
            <div className="text-lg font-bold text-blue-700">
              {formatNumber(chartData.reduce((s, d) => s + d.efficiency, 0) / chartData.length, { minimumFractionDigits: 3 })}x
            </div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-medium text-green-900">Cumplimiento Promedio</div>
            <div className="text-lg font-bold text-green-700">
              {formatNumber(chartData.reduce((s, d) => s + d.passRate, 0) / chartData.length, { minimumFractionDigits: 1 })}%
            </div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-900">Volumen Total</div>
            <div className="text-lg font-bold text-gray-700">
              {formatNumber(chartData.reduce((s, d) => s + d.volume, 0), { minimumFractionDigits: 1 })} m³
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
