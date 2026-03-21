'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Loader2, Package, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, BarChart3, Settings, Factory, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface RemisionMaterialsAnalysisProps {
  remision: any;
}

interface MaterialAnalysis {
  material_type: string;
  material_name: string;
  theoretical_quantity: number;
  actual_quantity: number;
  adjustment: number;
  final_quantity: number;
  difference: number;
  percentage_difference: number;
  variance_status: 'normal' | 'warning' | 'critical';
  has_adjustments: boolean;
}

const MATERIAL_TYPE_MAP: Record<string, string> = {
  'cement': 'CPC 40',
  'water': 'AGUA 1',
  'gravel': 'GRAVA BASALTO 20mm',
  'gravel40mm': 'GRAVA BASALTO 40mm',
  'volcanicSand': 'ARENA BLANCA',
  'basalticSand': 'ARENA TRITURADA',
  'additive1': '800 MX',
  'additive2': 'ADITIVO 2'
};

export default function RemisionMaterialsAnalysis({ remision }: RemisionMaterialsAnalysisProps) {
  const [materialsAnalysis, setMaterialsAnalysis] = useState<MaterialAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crossPlantBanner, setCrossPlantBanner] = useState<{ remisionNumber: string; plantName: string; horaCarga?: string | null } | null>(null);
  // Production remision data — overrides billing remision fields in summary for cross-plant cases
  const [productionData, setProductionData] = useState<{
    volumen_fabricado?: number | null;
    recipe?: { recipe_code?: string | null; strength_fc?: number | null } | null;
  } | null>(null);

  useEffect(() => {
    if (remision) {
      fetchMaterialsAnalysis();
    }
  }, [remision]);

  const fetchMaterialsAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate that we have a valid remision
      if (!remision?.id) {
        console.warn('No remision found:', remision);
        setMaterialsAnalysis([]);
        setLoading(false);
        return;
      }

      // Get materials directly from remision_materiales with material relationship
      // Join with materials table to get material_name dynamically
      const { data: materialsData, error: materialsError } = await supabase
        .from('remision_materiales')
        .select(`
          id,
          material_type,
          material_id,
          cantidad_real,
          cantidad_teorica,
          ajuste,
          materials:material_id(id, material_name, material_code)
        `)
        .eq('remision_id', remision.id);
      
      if (materialsError) throw materialsError;

      // Cross-plant read-through: if no local materials but there's a cross-plant link,
      // fetch production materials from the linked Plant B remision via API (bypasses RLS)
      let resolvedMaterials = materialsData || [];
      if (resolvedMaterials.length === 0 && remision.cross_plant_billing_remision_id) {
        try {
          const res = await fetch(`/api/remisiones/${remision.id}/cross-plant-materials`);
          if (res.ok) {
            const cpData = await res.json();
            if (cpData.isCrossPlant && cpData.materials?.length > 0) {
              resolvedMaterials = cpData.materials;
              if (cpData.productionRemisionNumber && cpData.productionPlantName) {
                setCrossPlantBanner({
                  remisionNumber: cpData.productionRemisionNumber,
                  plantName: cpData.productionPlantName,
                  horaCarga: cpData.productionHoraCarga ?? null,
                });
              }
              // Store production remision data to use for the summary card
              setProductionData({
                volumen_fabricado: cpData.productionVolumen ?? null,
                recipe: cpData.productionRecipe ?? null,
              });
            }
          }
        } catch {
          // Non-critical — just show empty state if cross-plant fetch fails
        }
      }

      // Process the materials with calculated values
      const analysis: MaterialAnalysis[] = resolvedMaterials.map((material: any) => {
        // Use material_name from materials table if available, otherwise fallback to MATERIAL_TYPE_MAP or material_type
        const materialName = material.materials?.material_name 
          || MATERIAL_TYPE_MAP[material.material_type] 
          || material.material_type;
        const theoreticalQuantity = material.cantidad_teorica || 0;
        const actualQuantity = material.cantidad_real || 0;
        const adjustment = material.ajuste || 0;
        const finalQuantity = actualQuantity + adjustment;
        const difference = finalQuantity - theoreticalQuantity;
        const percentageDifference = theoreticalQuantity > 0 
          ? (difference / theoreticalQuantity) * 100 
          : 0;
        
        // Determine variance status based on percentage difference
        let varianceStatus: 'normal' | 'warning' | 'critical' = 'normal';
        const absPercentage = Math.abs(percentageDifference);
        
        if (absPercentage > 10) {
          varianceStatus = 'critical';
        } else if (absPercentage > 5) {
          varianceStatus = 'warning';
        }
        
        return {
          material_type: material.material_type,
          material_name: materialName,
          theoretical_quantity: theoreticalQuantity,
          actual_quantity: actualQuantity,
          adjustment: adjustment,
          final_quantity: finalQuantity,
          difference,
          percentage_difference: percentageDifference,
          variance_status: varianceStatus,
          has_adjustments: Math.abs(adjustment) > 0.01
        };
      });
      
      setMaterialsAnalysis(analysis);
    } catch (err) {
      console.error('Error fetching materials analysis:', err);
      setError('Error al cargar el análisis de materiales');
    } finally {
      setLoading(false);
    }
  };

  const getVarianceIcon = (status: string, percentage: number) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return percentage > 0 ? 
          <TrendingUp className="h-4 w-4 text-yellow-600" /> : 
          <TrendingDown className="h-4 w-4 text-yellow-600" />;
      default:
        return Math.abs(percentage) < 0.1 ? 
          <CheckCircle className="h-4 w-4 text-green-600" /> :
          percentage > 0 ? 
            <TrendingUp className="h-4 w-4 text-green-600" /> : 
            <TrendingDown className="h-4 w-4 text-green-600" />;
    }
  };

  const getVarianceBadgeColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 text-green-600 animate-spin" />
          <p className="text-gray-500">Cargando análisis de materiales...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-red-800 mb-2">
              Error en el análisis
            </h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!remision) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No hay remisión asociada a este muestreo</p>
      </div>
    );
  }

  // Derive display remision number and plant context upfront
  const isCrossPlant = !!crossPlantBanner;
  const displayRemisionNumber = isCrossPlant ? crossPlantBanner!.remisionNumber : remision.remision_number;
  const displayPlantName = isCrossPlant ? crossPlantBanner!.plantName : null;

  return (
    <div className="space-y-6">

      {/* Header with remision info */}
      <Card className="border border-gray-200 bg-white shadow-sm">

        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-500 flex-shrink-0" />
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">
                  Análisis de Materiales
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {isCrossPlant
                    ? 'Comparación teórico vs real — datos de remisión de producción'
                    : 'Comparación entre cantidades teóricas y reales'
                  }
                </CardDescription>
              </div>
            </div>
            {isCrossPlant && (
              <Badge variant="outline" className="flex-shrink-0 flex items-center gap-1.5 bg-amber-50 text-amber-700 border-amber-300 text-xs font-medium px-2.5 py-1">
                <Factory className="h-3.5 w-3.5" />
                Producción Cruzada
              </Badge>
            )}
          </div>

          {/* Cross-plant provenance strip */}
          {isCrossPlant && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 mb-0.5">Planta productora</p>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Factory className="h-3.5 w-3.5 text-amber-500" />
                    {displayPlantName}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 mb-0.5">Remisión de producción</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">#{displayRemisionNumber}</p>
                </div>
                {crossPlantBanner!.horaCarga && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 mb-0.5">Hora de carga</p>
                    <p className="text-sm font-semibold text-gray-900 font-mono flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      {crossPlantBanner!.horaCarga}
                    </p>
                  </div>
                )}
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-0.5">Remisión de facturación</p>
                  <p className="text-sm text-gray-400 font-mono flex items-center gap-1 justify-end">
                    #{remision.remision_number}
                    <ArrowRight className="h-3 w-3 text-gray-300" />
                    <span className="text-gray-600 font-semibold">#{displayRemisionNumber}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {(() => {
            // Use production remision data for cross-plant cases; fall back to billing remision
            const vol = productionData?.volumen_fabricado ?? remision.volumen_fabricado;
            const recipe = productionData?.recipe ?? remision.recipe;
            const horaCarga = crossPlantBanner?.horaCarga ?? remision.hora_carga;
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Volumen Fabricado</p>
                  <div className="text-lg font-bold text-gray-900">{vol} m³</div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Hora de Carga</p>
                  <div className={`text-lg font-bold font-mono ${horaCarga ? 'text-gray-900' : 'text-gray-300'}`}>
                    {horaCarga || '—'}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Cemento kg/m³</p>
                  <div className="text-lg font-bold text-green-600">
                    {(() => {
                      const cementMaterial = materialsAnalysis.find(m => {
                        const type = m.material_type.toLowerCase();
                        const name = m.material_name.toLowerCase();
                        return type === 'cement' || type.includes('cemento') || name.includes('cemento') || name.includes('cpc') || /^c\d+$/.test(type);
                      });
                      return cementMaterial && vol > 0 ? (cementMaterial.theoretical_quantity / vol).toFixed(2) : '--';
                    })()}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Agua L/m³</p>
                  <div className="text-lg font-bold text-green-600">
                    {(() => {
                      const waterMaterial = materialsAnalysis.find(m => {
                        const type = m.material_type.toLowerCase();
                        const name = m.material_name.toLowerCase();
                        return type === 'water' || type.includes('agua') || name.includes('agua');
                      });
                      return waterMaterial && vol > 0 ? (waterMaterial.theoretical_quantity / vol).toFixed(2) : '--';
                    })()}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Fórmula</p>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                    {recipe?.recipe_code || 'N/A'}
                  </Badge>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Resistencia</p>
                  <div className="text-lg font-bold text-gray-900">
                    {recipe?.strength_fc || '--'} kg/cm²
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Ajustes Realizados</p>
                  <div className={`text-lg font-bold ${materialsAnalysis.some(m => m.has_adjustments) ? 'text-orange-600' : 'text-gray-400'}`}>
                    {materialsAnalysis.some(m => m.has_adjustments) ? '✓ Sí' : '✗ No'}
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Materials analysis table */}
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">Comparación de Materiales</CardTitle>
              <CardDescription className="mt-0.5">
                Análisis detallado de variaciones entre cantidades teóricas y reales
              </CardDescription>
            </div>
            {isCrossPlant && (
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-0.5">Remisión fuente</p>
                <p className="text-sm font-mono font-semibold text-gray-700">#{displayRemisionNumber}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {materialsAnalysis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-700">Material</th>
                    <th className="px-4 py-3 border-b text-right text-sm font-medium text-gray-700">Cant. Teórica</th>
                    <th className="px-4 py-3 border-b text-right text-sm font-medium text-gray-700">Cant. Real</th>
                    <th className="px-4 py-3 border-b text-right text-sm font-medium text-gray-700">Ajustes</th>
                    <th className="px-4 py-3 border-b text-right text-sm font-medium text-gray-700">Cant. Final</th>
                    <th className="px-4 py-3 border-b text-right text-sm font-medium text-gray-700">Diferencia</th>
                    <th className="px-4 py-3 border-b text-center text-sm font-medium text-gray-700">% Variación</th>
                    <th className="px-4 py-3 border-b text-center text-sm font-medium text-gray-700">Indicador</th>
                    <th className="px-4 py-3 border-b text-center text-sm font-medium text-gray-700">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {materialsAnalysis.map((material, index) => (
                    <tr key={`${material.material_type}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 border-b">
                        <div className="font-medium text-gray-900">{material.material_name}</div>
                      </td>
                      <td className="px-4 py-3 border-b text-right font-mono text-sm">
                        {material.theoretical_quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border-b text-right font-mono text-sm">
                        {material.actual_quantity.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 border-b text-right font-mono text-sm ${
                        material.has_adjustments ? 
                          (material.adjustment > 0 ? 'text-blue-600 font-semibold' : 'text-orange-600 font-semibold') :
                          'text-gray-400'
                      }`}>
                        {material.has_adjustments ? 
                          `${material.adjustment > 0 ? '+' : ''}${material.adjustment.toFixed(2)}` :
                          '—'
                        }
                      </td>
                      <td className="px-4 py-3 border-b text-right font-mono text-sm font-semibold">
                        {material.final_quantity.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 border-b text-right font-mono text-sm ${
                        material.difference > 0 ? 'text-blue-600' : 
                        material.difference < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {material.difference > 0 ? '+' : ''}{material.difference.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border-b text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getVarianceIcon(material.variance_status, material.percentage_difference)}
                          <span className={`font-mono text-sm ${
                            material.variance_status === 'critical' ? 'text-red-600' :
                            material.variance_status === 'warning' ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {material.percentage_difference > 0 ? '+' : ''}
                            {material.percentage_difference.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b text-center">
                        <div className="w-20 mx-auto">
                          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                material.variance_status === 'critical' ? 'bg-red-500' :
                                material.variance_status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ 
                                width: `${Math.min(Math.abs(material.percentage_difference) * 6.67, 100)}%` 
                              }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.abs(material.percentage_difference) > 15 ? '15+' : Math.abs(material.percentage_difference).toFixed(1)}%
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b text-center">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getVarianceBadgeColor(material.variance_status)}`}
                        >
                          {material.variance_status === 'critical' ? 'Crítica' :
                           material.variance_status === 'warning' ? 'Atención' : 'Normal'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron materiales para analizar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary statistics */}
      {materialsAnalysis.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-gray-600" />
                Resumen de Variaciones
              </CardTitle>
              <CardDescription>
                Estadísticas generales del análisis de materiales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {materialsAnalysis.length}
                  </div>
                  <p className="text-sm text-gray-500">Total Materiales</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {materialsAnalysis.filter(m => m.has_adjustments).length}
                  </div>
                  <p className="text-sm text-gray-500">Con Ajustes</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">
                      {materialsAnalysis.filter(m => m.variance_status === 'normal').length}
                    </div>
                    <p className="text-xs text-gray-500">Normal</p>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-600">
                      {materialsAnalysis.filter(m => m.variance_status === 'warning').length}
                    </div>
                    <p className="text-xs text-gray-500">Atención</p>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600">
                      {materialsAnalysis.filter(m => m.variance_status === 'critical').length}
                    </div>
                    <p className="text-xs text-gray-500">Crítica</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                Rangos de Tolerancia
              </CardTitle>
              <CardDescription>
                Criterios de evaluación aplicados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Normal</p>
                    <p className="text-xs text-gray-500">Variación ≤ 5%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Atención</p>
                    <p className="text-xs text-gray-500">Variación 5% - 10%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Crítica</p>
                    <p className="text-xs text-gray-500">Variación &gt; 10%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Adjustments Summary */}
      {materialsAnalysis.length > 0 && materialsAnalysis.some(m => m.has_adjustments) && (
        <Card className="border border-orange-200 bg-orange-50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-orange-800">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Ajustes Realizados
            </CardTitle>
            <CardDescription className="text-orange-700">
              Materiales que requirieron ajustes durante la fabricación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {materialsAnalysis
                .filter(m => m.has_adjustments)
                .map((material, index) => (
                  <div key={`${material.material_type}-adjustment-${index}`} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        material.adjustment > 0 ? 'bg-blue-500' : 'bg-orange-500'
                      }`}></div>
                      <div>
                        <p className="font-medium text-gray-900">{material.material_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm font-semibold ${
                        material.adjustment > 0 ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        {material.adjustment > 0 ? '+' : ''}{material.adjustment.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {material.adjustment > 0 ? 'Incremento' : 'Reducción'}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
