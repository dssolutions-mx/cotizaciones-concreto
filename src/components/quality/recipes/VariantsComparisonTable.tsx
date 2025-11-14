'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import type { RecipeQualityRemisionData } from '@/hooks/useProgressiveRecipeQuality';

interface VariantMetrics {
  variantId: string;
  recipeCode: string;
  arkikCode: string | null;
  variantSuffix: string | null;
  totalVolume: number;
  remisionCount: number;
  muestreoCount: number;
  ensayoCount: number;
  avgCompliance: number;
  avgResistance: number;
  cv: number;
  avgYield: number;
  avgCostPerM3: number;
  qualityLevel: string;
}

interface VariantsComparisonTableProps {
  remisiones: RecipeQualityRemisionData[];
  targetStrength: number;
}

export function VariantsComparisonTable({ remisiones, targetStrength }: VariantsComparisonTableProps) {
  const variantMetrics = useMemo(() => {
    // Group remisiones by variant (recipe_id)
    const variantGroups = new Map<string, RecipeQualityRemisionData[]>();

    remisiones.forEach(r => {
      if (!variantGroups.has(r.recipeId)) {
        variantGroups.set(r.recipeId, []);
      }
      variantGroups.get(r.recipeId)!.push(r);
    });

    // Calculate metrics for each variant
    const metrics: VariantMetrics[] = [];

    variantGroups.forEach((variantRemisiones, variantId) => {
      if (variantRemisiones.length === 0) return;

      const firstRemision = variantRemisiones[0];

      // Calculate totals
      const totalVolume = variantRemisiones.reduce((sum, r) => sum + r.volume, 0);
      const remisionCount = variantRemisiones.length;

      // Calculate muestreo-level metrics (IMPORTANT: average by muestreo, not ensayo)
      const muestreoMetrics: Array<{
        avgResistance: number;
        avgCompliance: number;
        yield: number;
        cost: number;
      }> = [];

      variantRemisiones.forEach(r => {
        r.muestreos.forEach(m => {
          // Get valid ensayos for this muestreo (edad de garantía, not fuera de tiempo)
          const validEnsayos = m.muestras.flatMap(mu =>
            mu.ensayos.filter(e =>
              e.isEdadGarantia &&
              !e.isEnsayoFueraTiempo &&
              e.resistenciaCalculada > 0
            )
          );

          if (validEnsayos.length > 0) {
            // Calculate AVERAGE for this muestreo
            const muestreoAvgResistance = validEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / validEnsayos.length;
            const muestreoAvgCompliance = validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length;

            muestreoMetrics.push({
              avgResistance: muestreoAvgResistance,
              avgCompliance: muestreoAvgCompliance,
              yield: r.rendimientoVolumetrico || 0,
              cost: r.costPerM3 || 0
            });
          }
        });
      });

      const muestreoCount = muestreoMetrics.length;
      const ensayoCount = variantRemisiones.reduce((sum, r) =>
        sum + r.muestreos.reduce((mSum, m) =>
          mSum + m.muestras.reduce((muSum, mu) =>
            muSum + mu.ensayos.filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo).length
          , 0)
        , 0)
      , 0);

      // Calculate averages from muestreo-level data
      const avgCompliance = muestreoCount > 0
        ? muestreoMetrics.reduce((sum, m) => sum + m.avgCompliance, 0) / muestreoCount
        : 0;

      const avgResistance = muestreoCount > 0
        ? muestreoMetrics.reduce((sum, m) => sum + m.avgResistance, 0) / muestreoCount
        : 0;

      // Calculate CV from muestreo-level resistances
      let cv = 0;
      if (muestreoCount > 1) {
        const resistances = muestreoMetrics.map(m => m.avgResistance);
        const mean = avgResistance;
        const variance = resistances.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (muestreoCount - 1);
        const stdDev = Math.sqrt(variance);
        cv = mean > 0 ? (stdDev / mean) * 100 : 0;
      }

      const avgYield = muestreoCount > 0
        ? muestreoMetrics.filter(m => m.yield > 0).reduce((sum, m) => sum + m.yield, 0) / muestreoMetrics.filter(m => m.yield > 0).length || 0
        : 0;

      // Volume-weighted average cost per m³ (matches production report methodology)
      let totalCostWeighted = 0;
      let totalVolumeForCost = 0;
      variantRemisiones.forEach(r => {
        if (r.costPerM3 && r.costPerM3 > 0 && r.volume > 0) {
          totalCostWeighted += r.costPerM3 * r.volume;
          totalVolumeForCost += r.volume;
        }
      });
      const avgCostPerM3 = totalVolumeForCost > 0 ? totalCostWeighted / totalVolumeForCost : 0;

      // Quality classification
      let qualityLevel = 'Mejorable';
      if (avgCompliance >= 100 && cv <= 8 && avgYield >= 99) qualityLevel = 'Excelente';
      else if (avgCompliance >= 95 && cv <= 10 && avgYield >= 98) qualityLevel = 'Muy Bueno';
      else if (avgCompliance >= 90 && cv <= 12 && avgYield >= 97) qualityLevel = 'Aceptable';

      metrics.push({
        variantId,
        recipeCode: firstRemision.recipeCode,
        arkikCode: firstRemision.arkikLongCode,
        variantSuffix: firstRemision.variantSuffix,
        totalVolume,
        remisionCount,
        muestreoCount,
        ensayoCount,
        avgCompliance,
        avgResistance,
        cv,
        avgYield,
        avgCostPerM3,
        qualityLevel
      });
    });

    // Sort by volume (most used first)
    return metrics.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [remisiones]);

  const getQualityBadge = (level: string) => {
    switch (level) {
      case 'Excelente':
        return <Badge className="bg-green-600">Excelente</Badge>;
      case 'Muy Bueno':
        return <Badge className="bg-blue-600">Muy Bueno</Badge>;
      case 'Aceptable':
        return <Badge className="bg-yellow-600">Aceptable</Badge>;
      default:
        return <Badge variant="destructive">Mejorable</Badge>;
    }
  };

  const getCVColor = (cv: number) => {
    if (cv <= 8) return 'text-green-600 font-semibold';
    if (cv <= 10) return 'text-blue-600 font-semibold';
    if (cv <= 12) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const getComplianceIcon = (compliance: number) => {
    if (compliance >= 100) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (compliance >= 95) return <TrendingUp className="h-4 w-4 text-blue-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  if (variantMetrics.length === 0) {
    return null;
  }

  if (variantMetrics.length === 1) {
    return (
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="text-sm text-blue-800">
            Esta receta maestra tiene solo una variante en uso durante el período analizado.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparación de Variantes</CardTitle>
        <CardDescription>
          Análisis detallado de cada variante de la receta maestra ({variantMetrics.length} variantes con datos)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 pr-4 font-semibold text-gray-700">Variante</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Volumen</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Remisiones</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Muestreos</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Resistencia</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Cumpl.</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">CV</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Rendimiento</th>
                <th className="text-right py-3 pr-4 font-semibold text-gray-700">Costo/m³</th>
                <th className="text-center py-3 pr-4 font-semibold text-gray-700">Calidad</th>
              </tr>
            </thead>
            <tbody>
              {variantMetrics.map((variant, idx) => (
                <tr
                  key={variant.variantId}
                  className={`border-b hover:bg-gray-50 ${idx === 0 ? 'bg-blue-50' : ''}`}
                >
                  <td className="py-3 pr-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-medium">
                        {variant.arkikCode || variant.recipeCode}
                      </span>
                      {variant.variantSuffix && (
                        <span className="text-xs text-blue-600 mt-1">
                          Sufijo: {variant.variantSuffix}
                        </span>
                      )}
                      {idx === 0 && (
                        <Badge variant="outline" className="mt-1 w-fit bg-blue-100 text-blue-700 text-xs">
                          Más usada
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-right py-3 pr-4 font-medium">
                    {formatNumber(variant.totalVolume, 1)} m³
                  </td>
                  <td className="text-right py-3 pr-4">
                    {variant.remisionCount}
                  </td>
                  <td className="text-right py-3 pr-4">
                    {variant.muestreoCount}
                    <div className="text-xs text-gray-500">
                      ({variant.ensayoCount} ensayos)
                    </div>
                  </td>
                  <td className="text-right py-3 pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {formatNumber(variant.avgResistance, 0)} kg/cm²
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatNumber((variant.avgResistance / targetStrength) * 100, 0)}% eficiencia
                    </div>
                  </td>
                  <td className="text-right py-3 pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {getComplianceIcon(variant.avgCompliance)}
                      {formatNumber(variant.avgCompliance, 1)}%
                    </div>
                  </td>
                  <td className={`text-right py-3 pr-4 ${getCVColor(variant.cv)}`}>
                    {formatNumber(variant.cv, 1)}%
                  </td>
                  <td className="text-right py-3 pr-4">
                    {formatNumber(variant.avgYield, 1)}%
                  </td>
                  <td className="text-right py-3 pr-4">
                    {formatCurrency(variant.avgCostPerM3)}
                  </td>
                  <td className="text-center py-3 pr-4">
                    {getQualityBadge(variant.qualityLevel)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="py-3 pr-4">TOTAL / PROMEDIO</td>
                <td className="text-right py-3 pr-4">
                  {formatNumber(variantMetrics.reduce((sum, v) => sum + v.totalVolume, 0), 1)} m³
                </td>
                <td className="text-right py-3 pr-4">
                  {variantMetrics.reduce((sum, v) => sum + v.remisionCount, 0)}
                </td>
                <td className="text-right py-3 pr-4">
                  {variantMetrics.reduce((sum, v) => sum + v.muestreoCount, 0)}
                </td>
                <td className="text-right py-3 pr-4">
                  {formatNumber(
                    variantMetrics.reduce((sum, v) => sum + v.avgResistance, 0) / variantMetrics.length,
                    0
                  )} kg/cm²
                </td>
                <td className="text-right py-3 pr-4">
                  {formatNumber(
                    variantMetrics.reduce((sum, v) => sum + v.avgCompliance, 0) / variantMetrics.length,
                    1
                  )}%
                </td>
                <td className="text-right py-3 pr-4">
                  {formatNumber(
                    variantMetrics.reduce((sum, v) => sum + v.cv, 0) / variantMetrics.length,
                    1
                  )}%
                </td>
                <td className="text-right py-3 pr-4">
                  {formatNumber(
                    variantMetrics.reduce((sum, v) => sum + v.avgYield, 0) / variantMetrics.length,
                    1
                  )}%
                </td>
                <td className="text-right py-3 pr-4">
                  {formatCurrency(
                    // Volume-weighted average across all variants
                    variantMetrics.reduce((sum, v) => sum + (v.avgCostPerM3 * v.totalVolume), 0) /
                    variantMetrics.reduce((sum, v) => sum + v.totalVolume, 0)
                  )}
                </td>
                <td className="text-center py-3 pr-4">—</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Analysis Notes */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">Notas de Análisis:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>Métricas por Muestreo:</strong> Todos los cálculos se realizan promediando ensayos por muestreo primero</li>
            <li>• <strong>Ensayos Válidos:</strong> Solo se incluyen ensayos en edad de garantía y a tiempo</li>
            <li>• <strong>CV (Coeficiente de Variación):</strong> ≤8% Excelente | ≤10% Muy Bueno | ≤12% Aceptable | &gt;12% Mejorable</li>
            <li>• <strong>Variante más usada:</strong> Se resalta la variante con mayor volumen producido</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
