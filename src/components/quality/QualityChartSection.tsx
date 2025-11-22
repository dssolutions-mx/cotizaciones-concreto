import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3 } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import type { DatoGraficoResistencia } from '@/types/quality';
import DetailedPointAnalysis from './DetailedPointAnalysis';
import ClientPointAnalysis from '@/components/client-portal/quality/ClientPointAnalysis';

// Custom shape for scatter points - Apple HIG styling
// Per Apple HIG: Data points should be clearly visible with appropriate size
const CustomScatterPoint = (props: any) => {
  const { cx, cy, fill } = props;
  if (cx === undefined || cy === undefined) {
    return <circle />;
  }
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="#FFFFFF"
      strokeWidth={2}
      opacity={1}
      style={{ transition: 'all 0.2s ease-out' }}
    />
  );
};

interface QualityChartSectionProps {
  datosGrafico: DatoGraficoResistencia[];
  loading: boolean;
  soloEdadGarantia: boolean;
  constructionSites: any[];
  useClientPortalAnalysis?: boolean; // Use client portal point analysis instead of internal one
}

export function QualityChartSection({
  datosGrafico,
  loading,
  soloEdadGarantia,
  constructionSites,
  useClientPortalAnalysis = false
}: QualityChartSectionProps) {
  const [selectedPoint, setSelectedPoint] = useState<DatoGraficoResistencia | null>(null);

  // Calculate date ticks for X-axis - show all available date labels
  const dateTicks = useMemo(() => {
    if (datosGrafico.length === 0) return [];
    
    // Get all unique dates from the data
    const uniqueDates = new Set<number>();
    datosGrafico.forEach(d => {
      const date = new Date(d.x).getTime();
      // Round to start of day to group by day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      uniqueDates.add(dayStart.getTime());
    });
    
    // Sort dates
    const sortedDates = Array.from(uniqueDates).sort((a, b) => a - b);
    
    // If we have too many dates (> 20), we might need to thin them out
    // But let's show all unique dates first
    if (sortedDates.length > 20) {
      // For very large datasets, show every Nth date
      const step = Math.ceil(sortedDates.length / 20);
      return sortedDates.filter((_, index) => index % step === 0);
    }
    
    return sortedDates;
  }, [datosGrafico]);

  // Split into meaningful buckets by age for better readability
  // CRITICAL: Group by original age from concrete_specs (edadOriginal + unidadEdad)
  // instead of converted edad value to preserve distinct hour values
  const seriesBuckets = useMemo(() => {
    // Group data by original age from concrete_specs (valor_edad + unidad_edad)
    // Use composite key: `${edadOriginal}_${unidadEdad}` to preserve distinct ages
    const ageGroups = new Map<string, typeof datosGrafico>();

    for (const p of datosGrafico) {
      // Get original age from concrete_specs (already stored as edadOriginal and unidadEdad)
      const edadOriginal = p.edadOriginal;
      const unidadEdad = p.unidadEdad;

      // Create composite key for grouping
      let ageKey: string;
      if (edadOriginal !== undefined && unidadEdad) {
        // Use original age from concrete_specs
        ageKey = `${edadOriginal}_${unidadEdad}`;
      } else {
        // Fallback to converted edad if original age not available
        const age = p.edad || 28;
        ageKey = `age_${age}`;
      }

      if (!ageGroups.has(ageKey)) {
        ageGroups.set(ageKey, []);
      }
      ageGroups.get(ageKey)!.push(p);
    }

    // Convert to array of age groups, sorted properly
    const sortedAgeKeys = Array.from(ageGroups.keys()).sort((a, b) => {
      // Parse age keys for proper sorting
      // Format: "valor_unidad" (e.g., "16_HORA", "28_DÍA") or "age_valor" (fallback)
      
      const parseAgeKey = (key: string): number => {
        if (key.startsWith('age_')) {
          // Fallback format: "age_28"
          return parseInt(key.replace('age_', ''));
        }
        
        // Parse "valor_unidad" format
        const [value, unit] = key.split('_');
        const valor = parseInt(value);
        
        if (!valor || isNaN(valor)) {
          return 28; // Default fallback
        }
        
        // Convert to days for sorting (hours -> days, days stay as days)
        if (unit === 'HORA' || unit === 'H') {
          return valor / 24; // Convert hours to days for sorting
        } else if (unit === 'DÍA' || unit === 'D') {
          return valor;
        }
        
        return valor; // Default: assume days
      };

      return parseAgeKey(a) - parseAgeKey(b);
    });

    return sortedAgeKeys.reduce((acc, ageKey) => {
      acc[ageKey] = ageGroups.get(ageKey)!;
      return acc;
    }, {} as Record<string, typeof datosGrafico>);
  }, [datosGrafico]);

  // Map data point for Recharts format
  const mapChartPoint = (item: DatoGraficoResistencia, idx: number) => {
    // Recharts ScatterChart expects numeric x values (timestamps) and numeric y values
    const dateValue = new Date(item.x).getTime(); // Convert to timestamp for x-axis
    return {
      id: idx,
      x: dateValue, // Timestamp for x-axis
      y: Number(item.y.toFixed(2)), // Compliance percentage rounded to 2 decimals
      fecha_muestreo: format(new Date(item.x), 'dd/MM/yyyy'),
      fecha_ensayo: item.fecha_ensayo || 'N/A',
      cumplimiento: Number(item.y.toFixed(2)),
      resistencia_real: item.resistencia_calculada,
      clasificacion: item.clasificacion,
      edad: item.edad,
      original_data: item
    };
  };

  // Custom tooltip component - clean and minimal with Apple HIG styling
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data) return null;

      // Format date from timestamp
      const dateValue = new Date(data.x);
      const formattedDate = format(dateValue, 'dd/MM/yyyy');
      
      // Format percentage with 2 decimals
      const percentage = Number(data.cumplimiento || data.y || 0);
      const formattedPercentage = percentage.toFixed(2);

      return (
        <div className="glass-thick rounded-xl p-4 border border-white/20 shadow-lg min-w-[200px] transition-all duration-200 ease-out">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-6">
              <span className="text-footnote text-label-secondary">Fecha</span>
              <span className="text-body font-medium text-label-primary">{formattedDate}</span>
            </div>
            <div className="flex items-center justify-between gap-6 pt-2 border-t border-white/10">
              <span className="text-footnote text-label-secondary">Cumplimiento</span>
              <span className="text-title-2 font-bold text-label-primary">{formattedPercentage}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const chartSeries = useMemo(() => {
    // Original color palette - restored as requested
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

    // Get sorted age keys from seriesBuckets
    // Age keys are now in format: "${edadOriginal}_${unidadEdad}" (e.g., "16_HORA", "28_DÍA")
    // or fallback format: "age_${edad}" for legacy data
    const ageKeys = Object.keys(seriesBuckets).sort((a, b) => {
      // Parse age keys for proper sorting
      const parseAgeKey = (key: string): number => {
        if (key.startsWith('age_')) {
          // Fallback format: "age_28"
          return parseInt(key.replace('age_', ''));
        }
        
        // Parse "valor_unidad" format (e.g., "16_HORA", "28_DÍA")
        const [value, unit] = key.split('_');
        const valor = parseInt(value);
        
        if (!valor || isNaN(valor)) {
          return 28; // Default fallback
        }
        
        // Convert to days for sorting (hours -> days, days stay as days)
        if (unit === 'HORA' || unit === 'H') {
          return valor / 24; // Convert hours to days for sorting
        } else if (unit === 'DÍA' || unit === 'D') {
          return valor;
        }
        
        return valor; // Default: assume days
      };

      return parseAgeKey(a) - parseAgeKey(b);
    });

    return ageKeys.map((ageKey, index) => {
      const colorIndex = index % ageColors.length;

      // Get the first data point to extract age information
      const firstDataPoint = seriesBuckets[ageKey][0];
      
      // Generate label based on original age from concrete_specs
      let label: string;
      
      // Check if we have original age from concrete_specs
      if (firstDataPoint?.edadOriginal !== undefined && firstDataPoint?.unidadEdad) {
        const originalAge = firstDataPoint.edadOriginal;
        const unit = firstDataPoint.unidadEdad;

        // Format label based on unit from concrete_specs
        if (unit === 'HORA' || unit === 'H') {
          label = originalAge === 1 ? '1 hora' : `${originalAge} horas`;
        } else if (unit === 'DÍA' || unit === 'D') {
          label = originalAge === 1 ? '1 día' : `${originalAge} días`;
        } else {
          label = `${originalAge} ${unit}`;
        }
      } else {
        // Fallback: parse from ageKey format
        if (ageKey.startsWith('age_')) {
          const age = parseInt(ageKey.replace('age_', ''));
          label = age === 1 ? '1 día' : `${age} días`;
        } else {
          // Parse "valor_unidad" format
          const [value, unit] = ageKey.split('_');
          const valor = parseInt(value);
          if (unit === 'HORA' || unit === 'H') {
            label = valor === 1 ? '1 hora' : `${valor} horas`;
          } else if (unit === 'DÍA' || unit === 'D') {
            label = valor === 1 ? '1 día' : `${valor} días`;
          } else {
            label = `${valor} ${unit}`;
          }
        }
      }

      return {
        id: ageKey,
        name: label,
        data: seriesBuckets[ageKey].map(mapChartPoint),
        fill: ageColors[colorIndex],
        line: { stroke: ageColors[colorIndex] }
      };
    });
  }, [seriesBuckets]);


  if (loading) {
    return (
      <Card className="glass-thick rounded-xl border border-slate-200">
        <CardHeader>
          <div className="h-6 w-[250px] bg-slate-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-footnote text-slate-500">Cargando datos del gráfico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-thick rounded-xl border border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-title-2 font-semibold text-slate-900">
            Cumplimiento de Resistencia
          </CardTitle>
          <span className="text-footnote text-slate-500">
            {datosGrafico.length} punto{datosGrafico.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Age Information Display */}
        {soloEdadGarantia && datosGrafico.length > 0 && (
          <div className="mt-3 p-3 glass-thin rounded-xl border border-systemBlue/20 bg-systemBlue/10">
            <div className="text-footnote text-systemBlue">
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
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart
                margin={{ top: 20, right: 80, bottom: 75, left: 72 }}
                onClick={(data: any) => {
                  if (data && data.activePayload && data.activePayload.length > 0) {
                    const payload = data.activePayload[0].payload;
                    if (payload?.original_data) {
                      setSelectedPoint(payload.original_data);
                    }
                  }
                }}
              >
                {/* Grid lines - Apple HIG: Visible but not distracting */}
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="rgba(142, 142, 147, 0.25)" 
                  vertical={true}
                  horizontal={true}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={['dataMin', 'dataMax']}
                  ticks={dateTicks}
                  tickFormatter={(value) => {
                    try {
                      return format(new Date(value), 'dd/MM');
                    } catch {
                      return '';
                    }
                  }}
                  tick={{ 
                    fontSize: 13, 
                    fill: 'rgba(0, 0, 0, 0.85)', 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                    fontWeight: 400
                  }}
                  tickMargin={10}
                  stroke="rgba(142, 142, 147, 0.4)"
                  strokeWidth={1}
                  allowDecimals={false}
                  label={{ 
                    value: 'Fecha', 
                    position: 'insideBottom', 
                    offset: -20,
                    style: { 
                      textAnchor: 'middle',
                      fontSize: 13,
                      fill: 'rgba(0, 0, 0, 0.85)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                      fontWeight: 500
                    }
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, Math.max(110, ...datosGrafico.map(d => d.y)) + 10]}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ 
                    fontSize: 13, 
                    fill: 'rgba(0, 0, 0, 0.85)', 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                    fontWeight: 400
                  }}
                  tickMargin={10}
                  stroke="rgba(142, 142, 147, 0.4)"
                  strokeWidth={1}
                  label={{ 
                    value: 'Porcentaje de Cumplimiento (%)', 
                    angle: -90, 
                    position: 'insideLeft',
                    offset: -5,
                    style: { 
                      textAnchor: 'middle',
                      fontSize: 13,
                      fill: 'rgba(0, 0, 0, 0.85)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                      fontWeight: 500
                    }
                  }}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ 
                    strokeDasharray: '3 3', 
                    stroke: 'rgba(142, 142, 147, 0.3)', 
                    strokeWidth: 1
                  }} 
                />
                <Legend 
                  wrapperStyle={{ 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                    fontSize: 13,
                    paddingTop: 20,
                    paddingBottom: 4
                  }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ 
                      color: 'rgba(0, 0, 0, 0.85)',
                      fontSize: 13,
                      fontWeight: 400
                    }}>
                      {value}
                    </span>
                  )}
                />
                {chartSeries.map((series) => (
                  <Scatter
                    key={series.id}
                    name={series.name}
                    data={series.data}
                    fill={series.fill}
                    shape={CustomScatterPoint}
                    isAnimationActive={false}
                  />
                ))}
                {/* Reference lines - Apple HIG: Clear but not overwhelming */}
                <ReferenceLine
                  y={90}
                  stroke="rgba(142, 142, 147, 0.5)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  label={{ 
                    value: "90%", 
                    position: "insideTopRight",
                    offset: 5,
                    style: {
                      fill: 'rgba(0, 0, 0, 0.6)',
                      fontSize: 12,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                      fontWeight: 500,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }
                  }}
                />
                <ReferenceLine
                  y={100}
                  stroke="#FF3B30"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  label={{ 
                    value: "100%", 
                    position: "insideTopRight",
                    offset: 5,
                    style: {
                      fill: '#FF3B30',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>

            {/* Enhanced Point Information Panel */}
            {selectedPoint && (
              useClientPortalAnalysis ? (
                <ClientPointAnalysis
                  point={selectedPoint}
                  onClose={() => setSelectedPoint(null)}
                />
              ) : (
                <DetailedPointAnalysis
                  point={selectedPoint}
                  onClose={() => setSelectedPoint(null)}
                />
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <BarChart3 className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-body font-medium text-slate-600 mb-1">
              No hay datos para mostrar
            </p>
            <p className="text-footnote text-slate-500 text-center max-w-md">
              Ajusta los filtros o el rango de fechas para visualizar datos en el gráfico
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
