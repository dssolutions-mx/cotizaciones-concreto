'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { formatNumber } from '@/lib/utils';
import { ClientQualityRemisionData } from '@/types/clientQuality';

interface ClientMuestreosChartsProps {
  remisiones: ClientQualityRemisionData[];
}

export default function ClientMuestreosCharts({ remisiones }: ClientMuestreosChartsProps) {
  // Flatten all muestreos from all remisiones
  const allMuestreos = remisiones.flatMap(remision => 
    remision.muestreos.map(muestreo => ({
      ...muestreo,
      remisionNumber: remision.remisionNumber,
      fecha: remision.fecha,
      volume: remision.volume,
      recipeCode: remision.recipeCode,
      constructionSite: remision.constructionSite,
      rendimientoVolumetrico: remision.rendimientoVolumetrico || 0,
      totalMaterialQuantity: remision.totalMaterialQuantity || 0
    }))
  );

  // Process data for charts
  const processChartData = () => {
    // Scatter plot data - resistencia vs cumplimiento
    const scatterData = allMuestreos.flatMap(muestreo => {
      const validEnsayos = muestreo.muestras.flatMap(muestra => 
        muestra.ensayos.filter(ensayo => 
          ensayo.isEdadGarantia && 
          !ensayo.isEnsayoFueraTiempo && 
          ensayo.resistenciaCalculada > 0 &&
          ensayo.porcentajeCumplimiento > 0
        )
      );

      return validEnsayos.map(ensayo => ({
        resistencia: ensayo.resistenciaCalculada,
        cumplimiento: ensayo.porcentajeCumplimiento,
        fecha: muestreo.fechaMuestreo,
        recipeCode: muestreo.recipeCode,
        remisionNumber: muestreo.remisionNumber,
        masaUnitaria: muestreo.masaUnitaria,
        temperaturaConcreto: muestreo.temperaturaConcreto
      }));
    });

    // Monthly trends
    const monthlyData = allMuestreos.reduce((acc: any, muestreo) => {
      const month = new Date(muestreo.fechaMuestreo).toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short' 
      });
      
      if (!acc[month]) {
        acc[month] = {
          month,
          total: 0,
          ensayados: 0,
          siteChecks: 0,
          avgCompliance: 0,
          avgResistencia: 0,
          avgRendimiento: 0
        };
      }
      
      acc[month].total += 1;
      
      const validEnsayos = muestreo.muestras.flatMap(muestra => 
        muestra.ensayos.filter(ensayo => 
          ensayo.isEdadGarantia && 
          !ensayo.isEnsayoFueraTiempo && 
          ensayo.resistenciaCalculada > 0
        )
      );
      
      if (validEnsayos.length > 0) {
        acc[month].ensayados += 1;
        const avgCompliance = validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length;
        const avgResistencia = validEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / validEnsayos.length;
        
        acc[month].avgCompliance = (acc[month].avgCompliance * (acc[month].ensayados - 1) + avgCompliance) / acc[month].ensayados;
        acc[month].avgResistencia = (acc[month].avgResistencia * (acc[month].ensayados - 1) + avgResistencia) / acc[month].ensayados;
      } else {
        acc[month].siteChecks += 1;
      }
      
      if (muestreo.rendimientoVolumetrico > 0) {
        acc[month].avgRendimiento = (acc[month].avgRendimiento * (acc[month].total - 1) + muestreo.rendimientoVolumetrico) / acc[month].total;
      }
      
      return acc;
    }, {});

    // Recipe performance
    const recipeData = allMuestreos.reduce((acc: any, muestreo) => {
      if (!acc[muestreo.recipeCode]) {
        acc[muestreo.recipeCode] = {
          recipe: muestreo.recipeCode,
          total: 0,
          ensayados: 0,
          avgCompliance: 0,
          avgResistencia: 0,
          avgRendimiento: 0
        };
      }
      
      acc[muestreo.recipeCode].total += 1;
      
      const validEnsayos = muestreo.muestras.flatMap(muestra => 
        muestra.ensayos.filter(ensayo => 
          ensayo.isEdadGarantia && 
          !ensayo.isEnsayoFueraTiempo && 
          ensayo.resistenciaCalculada > 0
        )
      );
      
      if (validEnsayos.length > 0) {
        acc[muestreo.recipeCode].ensayados += 1;
        const avgCompliance = validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length;
        const avgResistencia = validEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / validEnsayos.length;
        
        acc[muestreo.recipeCode].avgCompliance = avgCompliance;
        acc[muestreo.recipeCode].avgResistencia = avgResistencia;
      }
      
      if (muestreo.rendimientoVolumetrico > 0) {
        acc[muestreo.recipeCode].avgRendimiento = (acc[muestreo.recipeCode].avgRendimiento * (acc[muestreo.recipeCode].total - 1) + muestreo.rendimientoVolumetrico) / acc[muestreo.recipeCode].total;
      }
      
      return acc;
    }, {});

    return {
      scatter: scatterData,
      monthly: Object.values(monthlyData).sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime()),
      recipes: Object.values(recipeData).sort((a: any, b: any) => b.total - a.total).slice(0, 8)
    };
  };

  const chartData = processChartData();
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value, 1)}{entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-800">Ensayo Individual</p>
          <p className="text-sm text-blue-600">
            Resistencia: {formatNumber(data.resistencia, 1)} kg/cm²
          </p>
          <p className="text-sm text-green-600">
            Cumplimiento: {formatNumber(data.cumplimiento, 1)}%
          </p>
          <p className="text-xs text-gray-500">
            Receta: {data.recipeCode}
          </p>
          <p className="text-xs text-gray-500">
            Fecha: {new Date(data.fecha).toLocaleDateString('es-ES')}
          </p>
        </div>
      );
    }
    return null;
  };

  if (allMuestreos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Muestreos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No hay datos de muestreos para mostrar gráficos.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scatter Plot - Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Relación Resistencia vs Cumplimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={chartData.scatter}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="resistencia" 
                name="Resistencia (kg/cm²)" 
                domain={['dataMin - 10', 'dataMax + 10']}
                label={{ value: 'Resistencia (kg/cm²)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                type="number" 
                dataKey="cumplimiento" 
                name="Cumplimiento (%)" 
                domain={[0, 120]}
                label={{ value: 'Cumplimiento (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter 
                dataKey="cumplimiento" 
                fill="#8884d8" 
                name="Ensayo"
                r={6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencias Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="total" fill="#e0e0e0" name="Total Muestreos" />
              <Bar yAxisId="left" dataKey="ensayados" fill="#82ca9d" name="Ensayados" />
              <Line yAxisId="right" type="monotone" dataKey="avgCompliance" stroke="#8884d8" strokeWidth={2} name="Cumplimiento Promedio (%)" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recipe Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento por Receta</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData.recipes} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 150]} />
              <YAxis dataKey="recipe" type="category" width={160} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgRendimiento" fill="#ff7300" name="Rendimiento (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Muestreos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{allMuestreos.length}</div>
              <div className="text-sm text-blue-800">Total Muestreos</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {allMuestreos.filter(m => 
                  m.muestras.some(muestra => 
                    muestra.ensayos.some(ensayo => 
                      ensayo.isEdadGarantia && 
                      !ensayo.isEnsayoFueraTiempo && 
                      ensayo.resistenciaCalculada > 0
                    )
                  )
                ).length}
              </div>
              <div className="text-sm text-green-800">Con Ensayos</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {allMuestreos.filter(m => 
                  !m.muestras.some(muestra => 
                    muestra.ensayos.some(ensayo => 
                      ensayo.isEdadGarantia && 
                      !ensayo.isEnsayoFueraTiempo && 
                      ensayo.resistenciaCalculada > 0
                    )
                  )
                ).length}
              </div>
              <div className="text-sm text-yellow-800">Site Checks</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(allMuestreos.map(m => m.recipeCode)).size}
              </div>
              <div className="text-sm text-purple-800">Recetas Únicas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}