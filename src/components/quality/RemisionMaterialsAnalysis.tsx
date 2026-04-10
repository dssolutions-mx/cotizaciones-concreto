'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Factory,
  Loader2,
  Package,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface RemisionMaterialsAnalysisProps {
  remision: Record<string, unknown> & { id?: string }
}

interface MaterialAnalysis {
  material_type: string
  material_name: string
  theoretical_quantity: number
  actual_quantity: number
  adjustment: number
  final_quantity: number
  difference: number
  percentage_difference: number
  variance_status: 'normal' | 'warning' | 'critical'
  has_adjustments: boolean
}

const MATERIAL_TYPE_MAP: Record<string, string> = {
  cement: 'CPC 40',
  water: 'AGUA 1',
  gravel: 'GRAVA BASALTO 20mm',
  gravel40mm: 'GRAVA BASALTO 40mm',
  volcanicSand: 'ARENA BLANCA',
  basalticSand: 'ARENA TRITURADA',
  additive1: '800 MX',
  additive2: 'ADITIVO 2',
}

const kpiTone = {
  ok: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  critical: 'bg-red-50 border-red-200',
  neutral: 'bg-white border-stone-200',
} as const

function findCementWater(
  materials: MaterialAnalysis[],
  vol: number
): { cementKgM3: string | null; waterLm3: string | null } {
  const cementMaterial = materials.find((m) => {
    const type = m.material_type.toLowerCase()
    const name = m.material_name.toLowerCase()
    return type === 'cement' || type.includes('cemento') || name.includes('cemento') || name.includes('cpc') || /^c\d+$/.test(type)
  })
  const waterMaterial = materials.find((m) => {
    const type = m.material_type.toLowerCase()
    const name = m.material_name.toLowerCase()
    return type === 'water' || type.includes('agua') || name.includes('agua')
  })
  return {
    cementKgM3: cementMaterial && vol > 0 ? (cementMaterial.theoretical_quantity / vol).toFixed(2) : null,
    waterLm3: waterMaterial && vol > 0 ? (waterMaterial.theoretical_quantity / vol).toFixed(2) : null,
  }
}

function varianceDot(status: string) {
  if (status === 'critical') return 'bg-red-500'
  if (status === 'warning') return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function RemisionMaterialsAnalysis({ remision }: RemisionMaterialsAnalysisProps) {
  const [materialsAnalysis, setMaterialsAnalysis] = useState<MaterialAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [crossPlantBanner, setCrossPlantBanner] = useState<{
    remisionNumber: string
    plantName: string
    horaCarga?: string | null
  } | null>(null)
  const [productionData, setProductionData] = useState<{
    volumen_fabricado?: number | null
    recipe?: { recipe_code?: string | null; strength_fc?: number | null } | null
  } | null>(null)
  const [adjOpen, setAdjOpen] = useState(false)

  useEffect(() => {
    if (remision) {
      void fetchMaterialsAnalysis()
    }
  }, [remision])

  const fetchMaterialsAnalysis = async () => {
    setLoading(true)
    setError(null)
    setCrossPlantBanner(null)
    setProductionData(null)

    try {
      if (!remision?.id) {
        setMaterialsAnalysis([])
        setLoading(false)
        return
      }

      const { data: materialsData, error: materialsError } = await supabase
        .from('remision_materiales')
        .select(
          `
          id,
          material_type,
          material_id,
          cantidad_real,
          cantidad_teorica,
          ajuste,
          materials:material_id(id, material_name, material_code)
        `
        )
        .eq('remision_id', remision.id as string)

      if (materialsError) throw materialsError

      let resolvedMaterials = materialsData || []
      const crossId = remision.cross_plant_billing_remision_id as string | undefined
      if (resolvedMaterials.length === 0 && crossId) {
        try {
          const res = await fetch(`/api/remisiones/${remision.id}/cross-plant-materials`)
          if (res.ok) {
            const cpData = await res.json()
            if (cpData.isCrossPlant && cpData.materials?.length > 0) {
              resolvedMaterials = cpData.materials
              if (cpData.productionRemisionNumber && cpData.productionPlantName) {
                setCrossPlantBanner({
                  remisionNumber: cpData.productionRemisionNumber,
                  plantName: cpData.productionPlantName,
                  horaCarga: cpData.productionHoraCarga ?? null,
                })
              }
              setProductionData({
                volumen_fabricado: cpData.productionVolumen ?? null,
                recipe: cpData.productionRecipe ?? null,
              })
            }
          }
        } catch {
          // non-critical
        }
      }

      const analysis: MaterialAnalysis[] = resolvedMaterials.map((material: Record<string, unknown>) => {
        const mat = material.materials as { material_name?: string } | null
        const materialName =
          mat?.material_name ||
          MATERIAL_TYPE_MAP[material.material_type as string] ||
          (material.material_type as string)
        const theoreticalQuantity = (material.cantidad_teorica as number) || 0
        const actualQuantity = (material.cantidad_real as number) || 0
        const adjustment = (material.ajuste as number) || 0
        const finalQuantity = actualQuantity + adjustment
        const difference = finalQuantity - theoreticalQuantity
        const percentageDifference = theoreticalQuantity > 0 ? (difference / theoreticalQuantity) * 100 : 0
        let varianceStatus: 'normal' | 'warning' | 'critical' = 'normal'
        const absPercentage = Math.abs(percentageDifference)
        if (absPercentage > 10) varianceStatus = 'critical'
        else if (absPercentage > 5) varianceStatus = 'warning'
        return {
          material_type: material.material_type as string,
          material_name: materialName,
          theoretical_quantity: theoreticalQuantity,
          actual_quantity: actualQuantity,
          adjustment,
          final_quantity: finalQuantity,
          difference,
          percentage_difference: percentageDifference,
          variance_status: varianceStatus,
          has_adjustments: Math.abs(adjustment) > 0.01,
        }
      })

      setMaterialsAnalysis(analysis)
    } catch (err) {
      console.error('Error fetching materials analysis:', err)
      setError('Error al cargar el análisis de materiales')
    } finally {
      setLoading(false)
    }
  }

  const getVarianceIcon = (status: string, percentage: number) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'warning':
        return percentage > 0 ? (
          <TrendingUp className="h-4 w-4 text-amber-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-amber-600" />
        )
      default:
        return Math.abs(percentage) < 0.1 ? (
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        ) : percentage > 0 ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-emerald-600" />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
          <p className="text-sm text-stone-500">Cargando análisis de materiales...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Error en el análisis</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!remision) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-stone-400 mx-auto mb-4" />
        <p className="text-stone-500">No hay remisión asociada a este muestreo</p>
      </div>
    )
  }

  const isCrossPlant = !!crossPlantBanner
  const displayRemisionNumber = isCrossPlant ? crossPlantBanner!.remisionNumber : (remision.remision_number as string)
  const displayPlantName = isCrossPlant ? crossPlantBanner!.plantName : null
  const vol = (productionData?.volumen_fabricado ?? remision.volumen_fabricado) as number | null | undefined
  const volumeNum = typeof vol === 'number' ? vol : 0

  const { cementKgM3, waterLm3 } = findCementWater(materialsAnalysis, volumeNum)

  const normalCount = materialsAnalysis.filter((m) => m.variance_status === 'normal').length
  const warnCount = materialsAnalysis.filter((m) => m.variance_status === 'warning').length
  const critCount = materialsAnalysis.filter((m) => m.variance_status === 'critical').length
  const totalM = materialsAnalysis.length
  const strictPct = totalM > 0 ? Math.round((normalCount / totalM) * 100) : 0
  const adjCount = materialsAnalysis.filter((m) => m.has_adjustments).length

  const complianceStatus: keyof typeof kpiTone =
    totalM === 0 ? 'neutral' : critCount > 0 ? 'critical' : warnCount > 0 ? 'warning' : 'ok'

  const adjustKpiStatus: keyof typeof kpiTone = adjCount > 0 ? 'warning' : 'ok'

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-5 w-5 text-stone-500 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-stone-900">Análisis de Materiales</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                {isCrossPlant
                  ? 'Comparación teórico vs real — datos de remisión de producción'
                  : 'Comparación entre cantidades teóricas y reales'}
              </p>
            </div>
          </div>
          {isCrossPlant && (
            <Badge
              variant="outline"
              className="shrink-0 flex items-center gap-1.5 bg-amber-50 text-amber-800 border-amber-200 text-xs font-medium px-2.5 py-1"
            >
              <Factory className="h-3.5 w-3.5" />
              Producción Cruzada
            </Badge>
          )}
        </div>

        {isCrossPlant && crossPlantBanner && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3 mb-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 mb-0.5">
                  Planta productora
                </p>
                <p className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                  <Factory className="h-3.5 w-3.5 text-amber-600" />
                  {displayPlantName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 mb-0.5">
                  Remisión de producción
                </p>
                <p className="text-sm font-semibold text-stone-900 font-mono">#{displayRemisionNumber}</p>
              </div>
              {crossPlantBanner.horaCarga && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 mb-0.5">
                    Hora de carga
                  </p>
                  <p className="text-sm font-semibold text-stone-900 font-mono">{crossPlantBanner.horaCarga}</p>
                </div>
              )}
              <div className="ml-auto text-right">
                <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                  Remisión de facturación
                </p>
                <p className="text-sm text-stone-500 font-mono flex items-center gap-1 justify-end">
                  #{remision.remision_number as string}
                  <ArrowRight className="h-3 w-3 text-stone-300" />
                  <span className="text-stone-800 font-semibold">#{displayRemisionNumber}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={cn('rounded-lg border px-4 py-3', kpiTone[complianceStatus])}>
            <div className="text-xs uppercase tracking-wide text-stone-500">Cumplimiento</div>
            <div className="text-2xl font-semibold mt-0.5 font-mono tabular-nums text-stone-900">
              {totalM > 0 ? `${strictPct}%` : '—'}
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5 truncate">variación ≤5% (normal)</div>
          </div>
          <div className="rounded-lg border px-4 py-3 bg-white border-stone-200">
            <div className="text-xs uppercase tracking-wide text-stone-500">Cemento</div>
            <div className="text-2xl font-semibold mt-0.5 font-mono tabular-nums text-stone-900">
              {cementKgM3 ?? '—'}
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5">kg/m³ (teórico)</div>
          </div>
          <div className="rounded-lg border px-4 py-3 bg-white border-stone-200">
            <div className="text-xs uppercase tracking-wide text-stone-500">Agua</div>
            <div className="text-2xl font-semibold mt-0.5 font-mono tabular-nums text-stone-900">
              {waterLm3 ?? '—'}
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5">L/m³ (teórico)</div>
          </div>
          <div className={cn('rounded-lg border px-4 py-3', kpiTone[adjustKpiStatus])}>
            <div className="text-xs uppercase tracking-wide text-stone-500">Ajustes</div>
            <div className="text-2xl font-semibold mt-0.5 font-mono tabular-nums text-stone-900">{adjCount}</div>
            <div className="text-[11px] text-stone-400 mt-0.5">materiales con ajuste</div>
          </div>
        </div>
      </div>

      <Card className="border border-stone-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-stone-900">Comparación de Materiales</CardTitle>
              <CardDescription className="mt-0.5">
                Análisis detallado de variaciones entre cantidades teóricas y reales
              </CardDescription>
            </div>
            {isCrossPlant && (
              <div className="text-right shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                  Remisión fuente
                </p>
                <p className="text-sm font-mono font-semibold text-stone-700">#{displayRemisionNumber}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {materialsAnalysis.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50 hover:bg-stone-50">
                      <TableHead className="text-stone-700">Material</TableHead>
                      <TableHead className="text-right text-stone-700">Cant. Teórica</TableHead>
                      <TableHead className="text-right text-stone-700">Cant. Real</TableHead>
                      <TableHead className="text-right text-stone-700">Ajustes</TableHead>
                      <TableHead className="text-right text-stone-700">Cant. Final</TableHead>
                      <TableHead className="text-right text-stone-700">Diferencia</TableHead>
                      <TableHead className="text-center text-stone-700">Variación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialsAnalysis.map((material, index) => (
                      <TableRow
                        key={`${material.material_type}-${index}`}
                        className={cn(
                          index % 2 === 0 ? 'bg-white' : 'bg-stone-50/50',
                          material.variance_status === 'critical' && 'bg-red-50/40',
                          material.variance_status === 'warning' && 'bg-amber-50/30'
                        )}
                      >
                        <TableCell className="font-medium text-stone-900">{material.material_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {material.theoretical_quantity.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {material.actual_quantity.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono text-sm tabular-nums',
                            material.has_adjustments
                              ? material.adjustment > 0
                                ? 'text-sky-700 font-semibold'
                                : 'text-amber-700 font-semibold'
                              : 'text-stone-400'
                          )}
                        >
                          {material.has_adjustments
                            ? `${material.adjustment > 0 ? '+' : ''}${material.adjustment.toFixed(2)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                          {material.final_quantity.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono text-sm tabular-nums',
                            material.difference > 0
                              ? 'text-sky-700'
                              : material.difference < 0
                                ? 'text-red-700'
                                : 'text-stone-600'
                          )}
                        >
                          {material.difference > 0 ? '+' : ''}
                          {material.difference.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full shrink-0', varianceDot(material.variance_status))} />
                            {getVarianceIcon(material.variance_status, material.percentage_difference)}
                            <span
                              className={cn(
                                'font-mono text-sm tabular-nums',
                                material.variance_status === 'critical'
                                  ? 'text-red-700'
                                  : material.variance_status === 'warning'
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                              )}
                            >
                              {material.percentage_difference > 0 ? '+' : ''}
                              {material.percentage_difference.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-stone-600 border-t border-stone-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Normal: {normalCount}
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Atención: {warnCount}
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Crítica: {critCount}
                  </span>
                </div>
                <p className="text-xs text-stone-500 sm:text-right">
                  Normal: ≤5% · Atención: 5–10% · Crítica: &gt;10%
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-stone-400 mx-auto mb-4" />
              <p className="text-stone-500">No se encontraron materiales para analizar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {materialsAnalysis.length > 0 && materialsAnalysis.some((m) => m.has_adjustments) && (
        <Collapsible open={adjOpen} onOpenChange={setAdjOpen}>
          <Card className="border border-stone-200 bg-white shadow-sm">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full text-left p-6 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-t-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-stone-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Ajustes realizados ({adjCount})
                    </div>
                    <p className="text-sm text-stone-500 mt-1">Materiales que requirieron ajustes durante la fabricación</p>
                  </div>
                  <ChevronDown className={cn('h-5 w-5 text-stone-400 transition-transform shrink-0', adjOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 px-6">
                <div className="space-y-2">
                  {materialsAnalysis
                    .filter((m) => m.has_adjustments)
                    .map((material, index) => (
                      <div
                        key={`${material.material_type}-adj-${index}`}
                        className="flex items-center justify-between p-3 bg-stone-50/80 rounded-lg border border-stone-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'w-2.5 h-2.5 rounded-full shrink-0',
                              material.adjustment > 0 ? 'bg-sky-500' : 'bg-amber-500'
                            )}
                          />
                          <p className="font-medium text-stone-900 truncate">{material.material_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={cn(
                              'font-mono text-sm font-semibold',
                              material.adjustment > 0 ? 'text-sky-700' : 'text-amber-700'
                            )}
                          >
                            {material.adjustment > 0 ? '+' : ''}
                            {material.adjustment.toFixed(2)}
                          </div>
                          <div className="text-xs text-stone-500">
                            {material.adjustment > 0 ? 'Incremento' : 'Reducción'}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}
