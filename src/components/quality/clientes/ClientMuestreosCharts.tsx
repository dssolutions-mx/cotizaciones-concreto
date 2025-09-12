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
  ResponsiveContainer
} from 'recharts';
import { formatNumber } from '@/lib/utils';
import { ClientQualityRemisionData } from '@/types/clientQuality';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import type { DatoGraficoResistencia } from '@/types/quality';

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

    // Recipe performance (from muestreos)
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

    // Fallback: compute rendimiento by recipe directly from remisiones (more robust)
    const recipeFromRemisiones = remisiones.reduce((acc: any, r) => {
      const key = r.recipeCode || 'SIN-RECETA';
      if (!acc[key]) {
        acc[key] = { recipe: key, sumR: 0, countR: 0 };
      }
      if ((r.rendimientoVolumetrico || 0) > 0) {
        acc[key].sumR += r.rendimientoVolumetrico as number;
        acc[key].countR += 1;
      }
      return acc;
    }, {});
    const recipeRendimiento = Object.values(recipeFromRemisiones)
      .map((x: any) => ({
        recipe: x.recipe,
        avgRendimiento: x.countR > 0 ? x.sumR / x.countR : 0,
      }))
      .filter((r: any) => r.avgRendimiento > 0 && r.recipe && r.recipe !== 'SIN-RECETA');

    return {
      scatter: scatterData,
      monthly: Object.values(monthlyData).sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime()),
      recipes: (recipeRendimiento.length > 0
        ? recipeRendimiento
        : Object.values(recipeData)
            .filter((r: any) => (r.avgRendimiento || 0) > 0 && r.recipe && r.recipe !== 'SIN-RECETA')
      ).sort((a: any, b: any) => (b.avgRendimiento || 0) - (a.avgRendimiento || 0)).slice(0, 8)
    };
  };

  const chartData = processChartData();
  // Map to QualityChartSection data format
  const datosGrafico: DatoGraficoResistencia[] = allMuestreos.flatMap((muestreo: any) =>
    (muestreo.muestras || []).flatMap((muestra: any) =>
      (muestra.ensayos || [])
        .filter((ensayo: any) => ensayo.isEdadGarantia && !ensayo.isEnsayoFueraTiempo && (ensayo.resistenciaCalculada || 0) > 0 && (ensayo.porcentajeCumplimiento || 0) > 0)
        .map((ensayo: any) => {
          const specs = muestreo.concrete_specs || {};
          // Resolve age in days from specs if available
          const edad = typeof specs.valor_edad === 'number' && specs.valor_edad > 0
            ? specs.valor_edad
            : 28;
          const clasificacion = (specs.clasificacion as 'FC' | 'MR') || 'FC';
          return {
            x: new Date(muestreo.fechaMuestreo || muestreo.fecha_muestreo || muestreo.fecha || Date.now()).getTime(),
            y: ensayo.porcentajeCumplimiento || 0,
            clasificacion,
            edad,
            fecha_ensayo: ensayo.fechaEnsayo || ensayo.fecha_ensayo,
            resistencia_calculada: ensayo.resistenciaCalculada || ensayo.resistencia_calculada,
            muestra: { muestreo, muestra, ensayo }
          } as DatoGraficoResistencia;
        })
    )
  );
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

  // Removed custom scatter tooltip; QualityChartSection handles its own UI

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
      {/* Scatter Plot replaced with QualityChartSection */}
      <QualityChartSection datosGrafico={datosGrafico} loading={false} soloEdadGarantia={true} constructionSites={[...new Set(remisiones.map(r => r.constructionSite).filter(Boolean))]} />

      {/* Monthly Trends removed by request */}

      {/* Recipe Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento por Receta</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData.recipes} layout="vertical" barCategoryGap={20} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[90, 105]} />
              <YAxis dataKey="recipe" type="category" width={220} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgRendimiento" fill="#ff7300" name="Rendimiento (%)" isAnimationActive={false} />
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