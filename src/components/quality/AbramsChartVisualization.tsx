'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Target, Zap, Droplets } from 'lucide-react';

interface AbramsChartVisualizationProps {
  cementType: string;
  aggregateType: string;
  age: number;
  targetStrength?: number;
  onPointSelect?: (point: any) => void;
}

interface AbramsDataPoint {
  waterCementRatio: number;
  compressiveStrength: number;
  efficiency: number;
  workability: string;
}

export default function AbramsChartVisualization({ 
  cementType, 
  aggregateType, 
  age, 
  targetStrength,
  onPointSelect 
}: AbramsChartVisualizationProps) {
  
  // Generar datos de la curva de Abrams
  const abramsData = useMemo(() => {
    const data: AbramsDataPoint[] = [];
    
    // Constantes de Abrams según materiales
    const getConstants = (cement: string, aggregate: string) => {
      const baseConstants = {
        'CPC-30': { A: 400, B: 7.5 },
        'CPC-40': { A: 450, B: 7.8 },
        'CPC-50': { A: 500, B: 8.0 },
        'CPO': { A: 380, B: 7.2 }
      };

      const aggregateFactors = {
        'basaltic': 1.0,
        'volcanic': 0.95,
        'limestone': 0.90,
        'river': 0.85
      };

      const base = baseConstants[cement as keyof typeof baseConstants] || baseConstants['CPC-30'];
      const factor = aggregateFactors[aggregate as keyof typeof aggregateFactors] || 1.0;

      return {
        A: base.A * factor,
        B: base.B
      };
    };

    const { A, B } = getConstants(cementType, aggregateType);
    
    // Factor de edad
    const ageFactors = { 7: 0.75, 14: 0.90, 28: 1.0, 56: 1.15, 90: 1.25 };
    const ageFactor = ageFactors[age as keyof typeof ageFactors] || 1.0;

    // Generar puntos de la curva
    for (let ratio = 0.3; ratio <= 0.8; ratio += 0.02) {
      const strength28 = A / Math.pow(B, ratio);
      const strengthAge = strength28 * ageFactor;
      const efficiency = strengthAge / 350; // Asumiendo 350 kg/m³ de cemento base
      
      // Clasificar trabajabilidad basada en relación a/c
      let workability = '';
      if (ratio <= 0.4) workability = 'Baja';
      else if (ratio <= 0.55) workability = 'Media';
      else workability = 'Alta';
      
      data.push({
        waterCementRatio: parseFloat(ratio.toFixed(2)),
        compressiveStrength: parseFloat(strengthAge.toFixed(2)),
        efficiency: parseFloat(efficiency.toFixed(2)),
        workability
      });
    }
    
    return data;
  }, [cementType, aggregateType, age]);

  // Encontrar el punto óptimo para la resistencia objetivo
  const optimalPoint = useMemo(() => {
    if (!targetStrength) return null;
    
    return abramsData.reduce((prev, curr) => 
      Math.abs(curr.compressiveStrength - targetStrength) < Math.abs(prev.compressiveStrength - targetStrength) 
        ? curr 
        : prev
    );
  }, [abramsData, targetStrength]);

  // Datos para gráfico de eficiencia
  const efficiencyData = useMemo(() => {
    return abramsData.map(point => ({
      ...point,
      efficiencyLabel: `${point.efficiency.toFixed(2)} kg/cm²/kg`
    }));
  }, [abramsData]);

  return (
    <div className="space-y-6">
      {/* Gráfico Principal - Curva de Abrams */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Curva de Abrams - Relación a/c vs Resistencia
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{cementType}</Badge>
            <Badge variant="outline">{aggregateType}</Badge>
            <Badge variant="outline">{age} días</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={abramsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="waterCementRatio" 
                  label={{ value: 'Relación Agua/Cemento (a/c)', position: 'insideBottom', offset: -10 }}
                  domain={['dataMin', 'dataMax']}
                  type="number"
                  scale="linear"
                />
                <YAxis 
                  label={{ value: 'Resistencia (kg/cm²)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value} kg/cm²`, 
                    'Resistencia'
                  ]}
                  labelFormatter={(label: any) => `a/c = ${label}`}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                
                {/* Curva principal */}
                <Line 
                  type="monotone" 
                  dataKey="compressiveStrength" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#1d4ed8' }}
                  name="Resistencia a la Compresión"
                />
                
                {/* Línea de referencia para resistencia objetivo */}
                {targetStrength && (
                  <ReferenceLine 
                    y={targetStrength} 
                    stroke="#ef4444" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ value: `Objetivo: ${targetStrength} kg/cm²`, position: "topRight" }}
                  />
                )}
                
                {/* Línea de referencia para punto óptimo */}
                {optimalPoint && (
                  <ReferenceLine 
                    x={optimalPoint.waterCementRatio} 
                    stroke="#10b981" 
                    strokeDasharray="3 3"
                    strokeWidth={2}
                    label={{ value: `Óptimo: a/c = ${optimalPoint.waterCementRatio}`, position: "topLeft" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Eficiencia */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Eficiencia del Cemento
          </CardTitle>
          <p className="text-sm text-gray-500">
            Relación entre resistencia obtenida y contenido de cemento
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="waterCementRatio" 
                  label={{ value: 'Relación Agua/Cemento (a/c)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Eficiencia (kg/cm²/kg cemento)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value} kg/cm²/kg`, 
                    'Eficiencia'
                  ]}
                  labelFormatter={(label: any) => `a/c = ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="efficiency" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Eficiencia del Cemento"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Información de Zonas de Trabajo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Target className="h-4 w-4" />
              Zona Óptima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-green-700">
                <strong>a/c: 0.35 - 0.50</strong>
              </div>
              <p className="text-xs text-green-600">
                Balance ideal entre resistencia y trabajabilidad. 
                Recomendado para la mayoría de aplicaciones estructurales.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Droplets className="h-4 w-4" />
              Alta Trabajabilidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-amber-700">
                <strong>a/c: 0.50 - 0.65</strong>
              </div>
              <p className="text-xs text-amber-600">
                Mayor facilidad de colocación, pero menor resistencia. 
                Útil para elementos con geometría compleja.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <TrendingUp className="h-4 w-4" />
              Alta Resistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-red-700">
                <strong>a/c: 0.30 - 0.40</strong>
              </div>
              <p className="text-xs text-red-600">
                Máxima resistencia, pero requiere aditivos para trabajabilidad. 
                Para elementos de alta exigencia estructural.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
