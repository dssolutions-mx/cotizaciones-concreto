'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface CostsChartProps {
  byPeriod: Array<{
    label: string;
    avgCostPerM3: number;
    volume: number;
    cement?: number;
    sands?: number;
    gravels?: number;
    additives?: number;
    cementSharePct?: number;
  }>;
}

export const CostsChart: React.FC<CostsChartProps> = ({ byPeriod }) => {
  const chartData = useMemo(() => {
    // Filter out periods with no cost data and format properly
    return byPeriod
      .filter(period => period.volume > 0 && period.avgCostPerM3 > 0)
      .map(period => {
        const totalMaterialCost = (period.cement || 0) + (period.sands || 0) + (period.gravels || 0) + (period.additives || 0);
        return {
          period: period.label,
          costPerM3: Number(period.avgCostPerM3.toFixed(2)),
          volume: Number(period.volume.toFixed(1)),
          // Convert absolute costs to per-m³ for stacked bars
          cementPerM3: totalMaterialCost > 0 ? Number(((period.cement || 0) / period.volume).toFixed(2)) : 0,
          sandsPerM3: totalMaterialCost > 0 ? Number(((period.sands || 0) / period.volume).toFixed(2)) : 0,
          gravelsPerM3: totalMaterialCost > 0 ? Number(((period.gravels || 0) / period.volume).toFixed(2)) : 0,
          additivesPerM3: totalMaterialCost > 0 ? Number(((period.additives || 0) / period.volume).toFixed(2)) : 0,
          cementShare: period.cementSharePct || 0,
        };
      });
  }, [byPeriod]);

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Costos</CardTitle>
          <CardDescription>Evolución de costos de materiales por período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">Sin datos de costos</div>
              <div className="text-sm">Esta receta no tiene datos de materiales con precios en el período seleccionado</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate max cost for Y-axis scaling
  const maxCost = Math.max(...chartData.map(d => d.costPerM3));
  const costDomain = [0, Math.ceil(maxCost * 1.1)];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Costos</CardTitle>
        <CardDescription>
          Desglose de costos de materiales por m³ • {chartData.length} período{chartData.length > 1 ? 's' : ''} con datos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="cost" 
              orientation="left" 
              domain={costDomain}
              tickFormatter={(value) => `$${value}`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Costo/m³ ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <YAxis 
              yAxisId="volume" 
              orientation="right" 
              tickFormatter={(value) => `${value}m³`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Volumen (m³)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value, name) => {
                if (name === 'Volumen') return [`${value} m³`, 'Volumen Producido'];
                if (name === 'Costo Total') return [formatCurrency(value as number), 'Costo Total/m³'];
                if (name === 'Cemento') return [formatCurrency(value as number), 'Cemento/m³'];
                if (name === 'Arenas') return [formatCurrency(value as number), 'Arenas/m³'];
                if (name === 'Gravas') return [formatCurrency(value as number), 'Gravas/m³'];
                if (name === 'Aditivos') return [formatCurrency(value as number), 'Aditivos/m³'];
                return [formatCurrency(value as number), name];
              }}
              labelFormatter={(label) => `Período: ${label}`}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            />
            
            {/* Stacked bars for material costs */}
            <Bar 
              yAxisId="cost" 
              dataKey="cementPerM3" 
              stackId="materials"
              fill="#dc2626" 
              name="Cemento"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              yAxisId="cost" 
              dataKey="sandsPerM3" 
              stackId="materials"
              fill="#f59e0b" 
              name="Arenas"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              yAxisId="cost" 
              dataKey="gravelsPerM3" 
              stackId="materials"
              fill="#6b7280" 
              name="Gravas"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              yAxisId="cost" 
              dataKey="additivesPerM3" 
              stackId="materials"
              fill="#8b5cf6" 
              name="Aditivos"
              radius={[2, 2, 0, 0]}
            />
            
            {/* Total cost line */}
            <Line 
              yAxisId="cost" 
              type="monotone" 
              dataKey="costPerM3" 
              stroke="#1f2937" 
              strokeWidth={3} 
              dot={{ r: 5, fill: "#1f2937", strokeWidth: 2, stroke: "white" }}
              activeDot={{ r: 7, fill: "#1f2937" }}
              name="Costo Total" 
            />
            
            {/* Volume bars (background) */}
            <Bar 
              yAxisId="volume" 
              dataKey="volume" 
              fill="rgba(156, 163, 175, 0.3)" 
              name="Volumen"
              radius={[2, 2, 2, 2]}
            />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="font-medium text-red-900">Cemento Promedio</div>
            <div className="text-base font-bold text-red-700">
              {formatNumber(chartData.reduce((s, d) => s + d.cementShare, 0) / chartData.length, { minimumFractionDigits: 1 })}%
            </div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-900">Costo Promedio</div>
            <div className="text-base font-bold text-gray-700">
              {formatCurrency(chartData.reduce((s, d) => s + d.costPerM3, 0) / chartData.length)}
            </div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="font-medium text-blue-900">Volumen Total</div>
            <div className="text-base font-bold text-blue-700">
              {formatNumber(chartData.reduce((s, d) => s + d.volume, 0), { minimumFractionDigits: 1 })} m³
            </div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-medium text-green-900">Períodos</div>
            <div className="text-base font-bold text-green-700">
              {chartData.length}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
