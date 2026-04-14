'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react';
import { getResistenciaForDisplay } from '@/lib/qualityReportHelpers';

function formatMetric(value: number | null | undefined, decimals: number = 2, suffix: string = '') {
  if (value === null || value === undefined) return 'N/A';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  return `${numValue.toFixed(decimals)}${suffix}`;
}

function formatString(value: string | null | undefined) {
  return value ?? 'N/A';
}

export type AggregateEfficiencyMetrics = {
  rendimientoPromedio: number;
  eficienciaPromedio: number;
  resistenciaPromedio: number;
  consumoPromedio: number;
  totalMuestreos: number;
};

export function EficienciaReportTab({
  eficienciaData,
  loading,
  aggregateMetrics,
  expandedRows,
  toggleRowExpansion,
  onExportExcel,
}: {
  eficienciaData: any[];
  loading: boolean;
  aggregateMetrics: AggregateEfficiencyMetrics;
  expandedRows: Record<string, boolean>;
  toggleRowExpansion: (rowId: string) => void;
  onExportExcel: () => void;
}) {
  return (
    <>
      <Card className="mb-6 border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Resumen de métricas de eficiencia</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : eficienciaData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-stone-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Rendimiento volumétrico prom.</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold tabular-nums">
                    {formatMetric(aggregateMetrics.rendimientoPromedio, 2, '%')}
                  </div>
                  <p className="text-xs text-stone-500">Sin valores cero</p>
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Eficiencia prom.</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold tabular-nums">
                    {formatMetric(aggregateMetrics.eficienciaPromedio, 3)}
                  </div>
                  <p className="text-xs text-stone-500">Sin valores cero</p>
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Consumo cemento prom.</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold tabular-nums">
                    {formatMetric(aggregateMetrics.consumoPromedio, 2, ' kg/m³')}
                  </div>
                  <p className="text-xs text-stone-500">Sin valores cero</p>
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total muestreos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold tabular-nums">{aggregateMetrics.totalMuestreos}</div>
                  <p className="text-xs text-stone-500">Con datos válidos</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertTitle>No hay datos disponibles</AlertTitle>
              <AlertDescription>
                No se encontraron datos de eficiencia para el período seleccionado.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Detalle de eficiencia por muestreo</CardTitle>
          <Button variant="outline" size="sm" onClick={onExportExcel} disabled={loading || !eficienciaData.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar datos
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center rounded-md border border-stone-100 bg-stone-50/50">
              <div className="text-center flex flex-col items-center gap-2 text-stone-500">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Cargando datos de eficiencia...</p>
              </div>
            </div>
          ) : eficienciaData.length > 0 ? (
            <div className="border border-stone-200 rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Fecha</TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead>Remisión</TableHead>
                    <TableHead>Receta</TableHead>
                    <TableHead>Clasificación</TableHead>
                    <TableHead className="text-right">Masa unit. (kg/m³)</TableHead>
                    <TableHead className="text-right">Vol. real (m³)</TableHead>
                    <TableHead className="bg-emerald-50/80 text-right">Rendimiento (%)</TableHead>
                    <TableHead className="text-right">kg cemento</TableHead>
                    <TableHead className="bg-emerald-50/80 text-right">Consumo C. (kg/m³)</TableHead>
                    <TableHead className="text-right">Resist. (kg/cm²)</TableHead>
                    <TableHead className="bg-emerald-50/80 text-right">Eficiencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eficienciaData.map((dato, index) => {
                    const rowId = dato.id ? dato.id.toString() : `row-${index}`;
                    const isExpanded = !!expandedRows[rowId];

                    return (
                      <React.Fragment key={rowId}>
                        <TableRow className="hover:bg-stone-50">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => toggleRowExpansion(rowId)}
                              className="h-6 w-6 p-0"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>{formatString(dato.fecha)}</TableCell>
                          <TableCell>{formatString(dato.planta)}</TableCell>
                          <TableCell>{formatString(dato.remision_id || '-')}</TableCell>
                          <TableCell>{formatString(dato.receta)}</TableCell>
                          <TableCell>{formatString(dato.clasificacion)}</TableCell>
                          <TableCell className="text-right">{formatMetric(dato.masa_unitaria)}</TableCell>
                          <TableCell className="text-right">{formatMetric(dato.volumen_real)}</TableCell>
                          <TableCell className="bg-emerald-50/80 text-right">
                            {formatMetric(dato.rendimiento_volumetrico, 2, '%')}
                          </TableCell>
                          <TableCell className="text-right">{formatMetric(dato.kg_cemento)}</TableCell>
                          <TableCell className="bg-emerald-50/80 text-right">{formatMetric(dato.consumo_cemento)}</TableCell>
                          <TableCell className="text-right">
                            {dato.muestras && Array.isArray(dato.muestras) && dato.muestras.length > 0
                              ? formatMetric(getResistenciaForDisplay(dato.muestras, dato.resistencia_promedio))
                              : formatMetric(dato.resistencia_promedio || 0)}
                          </TableCell>
                          <TableCell className="bg-emerald-50/80 text-right">{formatMetric(dato.eficiencia, 3)}</TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={13} className="p-0 border-t-0">
                              <div className="px-4 pb-4">
                                <h4 className="text-sm font-semibold mb-2 mt-2">
                                  Muestras y ensayos — muestreo ID: {dato.id || '-'}
                                </h4>

                                {dato.muestras && Array.isArray(dato.muestras) && dato.muestras.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-stone-100">
                                        <TableHead className="py-2 text-xs">Muestra ID</TableHead>
                                        <TableHead className="py-2 text-xs">Identificación</TableHead>
                                        <TableHead className="py-2 text-xs">Tipo</TableHead>
                                        <TableHead className="py-2 text-xs">Fecha programada</TableHead>
                                        <TableHead className="py-2 text-xs">Garantía</TableHead>
                                        <TableHead className="py-2 text-xs">Resistencia</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {dato.muestras.map((muestra: any, muestraIndex: number) => {
                                        const isGarantia =
                                          muestra.is_edad_garantia === true ||
                                          muestra.fecha_programada_matches_garantia === true ||
                                          (muestra.ensayos &&
                                            muestra.ensayos.some((e: any) => e.is_edad_garantia === true));

                                        let resistencia: number | null = null;
                                        if (muestra.resistencia) {
                                          resistencia = muestra.resistencia;
                                        } else if (muestra.ensayos && muestra.ensayos.length > 0) {
                                          const garantiaEnsayo = muestra.ensayos.find((e: any) => e.is_edad_garantia);
                                          if (garantiaEnsayo && garantiaEnsayo.resistencia_calculada) {
                                            resistencia = garantiaEnsayo.resistencia_calculada;
                                          } else {
                                            const anyEnsayo = muestra.ensayos.find((e: any) => e.resistencia_calculada);
                                            if (anyEnsayo) resistencia = anyEnsayo.resistencia_calculada;
                                          }
                                        }

                                        const cumplimiento =
                                          muestra.cumplimiento ||
                                          muestra.ensayos?.find((e: any) => e.is_edad_garantia)
                                            ?.porcentaje_cumplimiento ||
                                          muestra.ensayos?.[0]?.porcentaje_cumplimiento ||
                                          0;

                                        return (
                                          <TableRow
                                            key={muestra.id || muestra.muestra_id || `muestra-${muestraIndex}`}
                                            className={
                                              isGarantia ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-stone-50'
                                            }
                                          >
                                            <TableCell className="py-2 text-xs">
                                              {muestra.id || muestra.muestra_id || '-'}
                                            </TableCell>
                                            <TableCell className="py-2 text-xs">
                                              {muestra.identificacion || muestra.codigo || '-'}
                                            </TableCell>
                                            <TableCell className="py-2 text-xs">{muestra.tipo_muestra || '-'}</TableCell>
                                            <TableCell className="py-2 text-xs">{muestra.fecha_programada || '-'}</TableCell>
                                            <TableCell className="py-2 text-xs">
                                              {isGarantia ? (
                                                <span className="text-emerald-700 font-medium">Sí</span>
                                              ) : (
                                                <span className="text-stone-500">No</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2 text-xs">
                                              {isGarantia ? (
                                                resistencia ? (
                                                  <span className="text-emerald-700 font-medium">
                                                    {formatMetric(resistencia)} kg/cm² | Cumpl.:{' '}
                                                    {formatMetric(cumplimiento, 2, '%')}
                                                  </span>
                                                ) : (
                                                  <span className="text-amber-600">Sin resistencia a edad garantía</span>
                                                )
                                              ) : (
                                                <span className="text-stone-400">—</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <div className="text-amber-800 text-sm p-4 bg-amber-50 border border-amber-200 rounded-md">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 shrink-0" />
                                      <span>No hay muestras para este muestreo.</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-2 text-xs text-stone-500 p-2 border-t border-stone-100">
                <p>
                  <span className="inline-block bg-emerald-50 px-2 py-0.5 mr-2 rounded">Verde</span>
                  Columnas resaltadas = datos calculados en servidor
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center rounded-md border border-stone-100 bg-stone-50/50">
              <div className="text-center flex flex-col items-center gap-2 text-stone-500">
                <BarChart2 className="h-12 w-12 text-stone-300" />
                <p className="text-sm">No hay datos de eficiencia</p>
                <p className="text-xs text-stone-400">Modifica filtros o el período</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
