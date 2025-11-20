import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3 } from 'lucide-react';
import { ScatterChart, ChartsReferenceLine } from '@mui/x-charts';
import type { ScatterItemIdentifier } from '@mui/x-charts';
import type { DatoGraficoResistencia } from '@/types/quality';
import DetailedPointAnalysis from './DetailedPointAnalysis';

interface QualityChartSectionProps {
  datosGrafico: DatoGraficoResistencia[];
  loading: boolean;
  soloEdadGarantia: boolean;
  constructionSites: any[];
}

export function QualityChartSection({
  datosGrafico,
  loading,
  soloEdadGarantia,
  constructionSites
}: QualityChartSectionProps) {
  const [selectedPoint, setSelectedPoint] = useState<DatoGraficoResistencia | null>(null);



  // Split into meaningful buckets by age for better readability
  const seriesBuckets = useMemo(() => {
    // Group data by age
    const ageGroups = new Map<number, typeof datosGrafico>();

    for (const p of datosGrafico) {
      const age = p.edad || 28; // Default to 28 days if no age specified
      if (!ageGroups.has(age)) {
        ageGroups.set(age, []);
      }
      ageGroups.get(age)!.push(p);
    }

    // Convert to array of age groups, sorted by age
    const sortedAges = Array.from(ageGroups.keys()).sort((a, b) => a - b);

    return sortedAges.reduce((acc, age) => {
      const ageKey = `age_${age}`;
      acc[ageKey] = ageGroups.get(age)!;
      return acc;
    }, {} as Record<string, typeof datosGrafico>);
  }, [datosGrafico]);

    const mapChartPoint = (item: DatoGraficoResistencia, idx: number) => {
    const dateObj = new Date(item.x);
    const formattedDate = format(dateObj, 'dd/MM/yyyy');

    // For MUI X Charts, we need a simpler data structure
    // The chart expects basic x, y coordinates plus any additional data for tooltips
    return {
      id: idx,
      x: item.x, // Timestamp for x-axis
      y: item.y, // Compliance percentage for y-axis
      fecha_muestreo: formattedDate,
      fecha_ensayo: item.fecha_ensayo,
      cumplimiento: `${item.y.toFixed(2)}%`,
      resistencia_real: item.resistencia_calculada,
      clasificacion: item.clasificacion,
      edad: item.edad,
      original_data: item
    };
  };

  const chartSeries = useMemo(() => {
    // Define colors for different ages
    const ageColors = [
      '#ef4444', // Red
      '#f59e0b', // Orange
      '#10b981', // Green
      '#3b82f6', // Blue
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316', // Orange-600
      '#6366f1', // Indigo
      '#84cc16'  // Lime
    ];

    // Get sorted ages from seriesBuckets
    const ageKeys = Object.keys(seriesBuckets).sort((a, b) => {
      const ageA = parseInt(a.replace('age_', ''));
      const ageB = parseInt(b.replace('age_', ''));
      return ageA - ageB;
    });

    return ageKeys.map((ageKey, index) => {
      const age = parseInt(ageKey.replace('age_', ''));
      const colorIndex = index % ageColors.length;

      // Get the first data point to check if it has original age unit info
      const firstDataPoint = seriesBuckets[ageKey][0];
      const hasOriginalAge = firstDataPoint?.edadOriginal !== undefined && firstDataPoint?.unidadEdad !== undefined;

      // Generate label based on original unit if available
      let label = age === 1 ? '1 día' : `${age} días`;
      if (hasOriginalAge) {
        const originalAge = firstDataPoint.edadOriginal!;
        const unit = firstDataPoint.unidadEdad!;

        if (unit === 'HORA' || unit === 'H') {
          label = originalAge === 1 ? '1 hora' : `${originalAge} horas`;
        } else if (unit === 'DÍA' || unit === 'D') {
          label = originalAge === 1 ? '1 día' : `${originalAge} días`;
        }
      }

      return {
        id: ageKey,
        label,
        color: ageColors[colorIndex],
        markerSize: 5,
        data: seriesBuckets[ageKey].map(mapChartPoint)
      };
    });
  }, [seriesBuckets]);

  // Custom tooltip formatter for MUI X Charts
  const formatTooltipContent = (params: any) => {
    if (!params || !params.datum) return '';

    const muestreoDate = params.datum.fecha_muestreo || format(new Date(params.datum.x), 'dd/MM/yyyy');
    const ensayoDate = params.datum.fecha_ensayo || 'N/A';
    const compliance = params.datum.cumplimiento || `${params.datum.y.toFixed(2)}%`;

    return `<div style="padding: 2px">
      <div><b>Fecha Muestreo:</b> ${muestreoDate}</div>
      <div><b>Fecha Ensayo:</b> ${ensayoDate}</div>
      <div><b>Cumplimiento:</b> ${compliance}</div>
    </div>`;
  };

  if (loading) {
    return (
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="h-6 w-[250px] bg-slate-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Cargando datos del gráfico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-semibold text-slate-900 tracking-tight">
            Cumplimiento de Resistencia
          </CardTitle>
          <span className="text-sm text-slate-500">
            {datosGrafico.length} punto{datosGrafico.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Age Information Display */}
        {soloEdadGarantia && datosGrafico.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs text-blue-700">
              <strong>Edad de Garantía:</strong> Mostrando solo ensayos realizados en la edad de garantía especificada en la receta.
              {(() => {
                const ages = Array.from(new Set(datosGrafico.map(d => d.edad))).sort((a, b) => a - b);
                if (ages.length > 0) {
                  return ` Edades encontradas: ${ages.join(', ')} días`;
                }
                return '';
              })()}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {typeof window !== 'undefined' && datosGrafico.length > 0 ? (
          <div>
            <div style={{ height: 400, width: '100%' }}>
                            <ScatterChart
                series={chartSeries}
                xAxis={[{
                  scaleType: 'time',
                  data: datosGrafico.map(d => new Date(d.x)),
                  valueFormatter: (value) => format(new Date(value), 'dd/MM'),
                  tickNumber: Math.min(7, datosGrafico.length),
                  tickMinStep: 24 * 3600 * 1000, // 1 day minimum interval
                  tickLabelStyle: {
                    angle: 0,
                    textAnchor: 'middle',
                    fontSize: 12
                  }
                }]}
                yAxis={[{
                  min: 0,
                  max: Math.max(110, ...datosGrafico.map(d => d.y)) + 10,
                  scaleType: 'linear',
                  label: 'Porcentaje de Cumplimiento (%)',
                  tickLabelStyle: {
                    fontSize: 12
                  }
                }]}
                height={400}
                grid={{
                  vertical: true,
                  horizontal: true
                }}
                margin={{ top: 20, right: 40, bottom: 50, left: 60 }}
                onItemClick={(_: React.MouseEvent<SVGElement>, itemData: ScatterItemIdentifier) => {
                  if (itemData?.dataIndex !== undefined && itemData?.seriesId) {
                    // Find the correct series and data point
                    const series = chartSeries.find(s => s.id === itemData.seriesId);
                    if (series && series.data[itemData.dataIndex]) {
                      const datum = series.data[itemData.dataIndex];
                      console.log('🔍 Point clicked:', {
                        datum: datum,
                        original_data: datum?.original_data,
                        hasMuestra: !!datum?.original_data?.muestra,
                        hasMuestreo: !!datum?.original_data?.muestra?.muestreo,
                        muestreoId: datum?.original_data?.muestra?.muestreo?.id
                      });
                      setSelectedPoint(datum?.original_data || null);
                    }
                  }
                }}
                slotProps={{
                  tooltip: {
                    sx: {
                      zIndex: 100,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(229,231,235,0.8)',
                      borderRadius: '12px',
                      padding: '16px',
                      minWidth: '280px',
                      // Enhanced tooltip styling
                      '& .MuiChartsTooltip-table': {
                        padding: '0',
                        fontSize: '13px',
                        margin: 0,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        width: '100%'
                      },
                      // Hide marker and series cells for cleaner look
                      '& .MuiChartsTooltip-markCell': {
                        display: 'none'
                      },
                      '& .MuiChartsTooltip-seriesCell': {
                        display: 'none'
                      },
                      // Enhanced cell styling
                      '& .MuiChartsTooltip-cell': {
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(229,231,235,0.5)',
                        verticalAlign: 'top'
                      },
                      '& .MuiChartsTooltip-labelCell': {
                        fontWeight: '600',
                        color: '#374151',
                        minWidth: '120px',
                        paddingRight: '16px'
                      },
                      '& .MuiChartsTooltip-valueCell': {
                        fontWeight: '500',
                        color: '#6b7280',
                        textAlign: 'left'
                      },
                      // Header styling
                      '& .MuiChartsTooltip-header': {
                        backgroundColor: 'rgba(59,130,246,0.1)',
                        borderBottom: '2px solid rgba(59,130,246,0.2)',
                        padding: '12px 16px',
                        margin: '-16px -16px 16px -16px',
                        borderRadius: '12px 12px 0 0',
                        color: '#1e40af',
                        fontWeight: '600'
                      }
                    }
                  }
                }}
                axisHighlight={{
                  x: 'none',
                  y: 'none'
                }}
              >
                {/* Reference lines for quick thresholds */}
                <ChartsReferenceLine
                  y={90}
                  lineStyle={{
                    stroke: '#94a3b8',
                    strokeWidth: 1,
                    strokeDasharray: '4 4'
                  }}
                  label="90%"
                  labelAlign="end"
                  labelStyle={{
                    fill: '#64748b',
                    fontSize: 11
                  }}
                />
                <ChartsReferenceLine
                  y={100}
                  lineStyle={{
                    stroke: '#FF4560',
                    strokeWidth: 1.5,
                    strokeDasharray: '5 5'
                  }}
                  label="100% Cumplimiento"
                  labelAlign="end"
                  labelStyle={{
                    fill: '#FF4560',
                    fontSize: 12
                  }}
                />
              </ScatterChart>
            </div>

            {/* Enhanced Point Information Panel */}
            {selectedPoint && (
              <DetailedPointAnalysis
                point={selectedPoint}
                onClose={() => setSelectedPoint(null)}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <BarChart3 className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-base font-medium text-slate-600 mb-1">
              No hay datos para mostrar
            </p>
            <p className="text-sm text-slate-500 text-center max-w-md">
              Ajusta los filtros o el rango de fechas para visualizar datos en el gráfico
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
