import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3 } from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DatoGraficoResistencia } from '@/types/quality';
import DetailedPointAnalysis from './DetailedPointAnalysis';
import ClientPointAnalysis from '@/components/client-portal/quality/ClientPointAnalysis';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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

export type ChartColorMode = 'edad' | 'clasificacion';

interface QualityChartSectionProps {
  datosGrafico: DatoGraficoResistencia[];
  loading: boolean;
  soloEdadGarantia: boolean;
  constructionSites: any[];
  useClientPortalAnalysis?: boolean;
}

export function QualityChartSection({
  datosGrafico,
  loading,
  soloEdadGarantia,
  constructionSites: _constructionSites,
  useClientPortalAnalysis = false,
}: QualityChartSectionProps) {
  const [selectedPoint, setSelectedPoint] = useState<DatoGraficoResistencia | null>(null);
  const [showTrend, setShowTrend] = useState(true);
  const [showRef100, setShowRef100] = useState(true);
  const [colorMode, setColorMode] = useState<ChartColorMode>('edad');

  const dateTicks = useMemo(() => {
    if (datosGrafico.length === 0) return [];

    const uniqueDates = new Set<number>();
    datosGrafico.forEach((d) => {
      const date = new Date(d.x).getTime();
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      uniqueDates.add(dayStart.getTime());
    });

    const sortedDates = Array.from(uniqueDates).sort((a, b) => a - b);

    if (sortedDates.length > 20) {
      const step = Math.ceil(sortedDates.length / 20);
      return sortedDates.filter((_, index) => index % step === 0);
    }

    return sortedDates;
  }, [datosGrafico]);

  const trendLineData = useMemo(() => {
    if (!showTrend || datosGrafico.length < 2) return [];
    const sorted = [...datosGrafico].sort((a, b) => a.x - b.x);
    const window = Math.min(7, Math.max(2, Math.ceil(sorted.length / 12)));
    return sorted.map((pt, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = sorted.slice(start, i + 1);
      const ma = slice.reduce((s, p) => s + p.y, 0) / slice.length;
      return { x: pt.x, ma: Number(ma.toFixed(2)) };
    });
  }, [datosGrafico, showTrend]);

  const mapChartPoint = (item: DatoGraficoResistencia, idx: number) => {
    const dateValue = new Date(item.x).getTime();
    return {
      id: idx,
      x: dateValue,
      y: Number(item.y.toFixed(2)),
      fecha_muestreo: format(new Date(item.x), 'dd/MM/yyyy'),
      fecha_ensayo: item.fecha_ensayo || 'N/A',
      cumplimiento: Number(item.y.toFixed(2)),
      resistencia_real: item.resistencia_calculada,
      clasificacion: item.clasificacion,
      edad: item.edad,
      original_data: item,
    };
  };

  const parseAgeKey = (key: string): number => {
    if (key.startsWith('age_')) {
      return parseInt(key.replace('age_', ''), 10);
    }
    const [value, unit] = key.split('_');
    const valor = parseInt(value, 10);
    if (!valor || isNaN(valor)) return 28;
    if (unit === 'HORA' || unit === 'H') return valor / 24;
    if (unit === 'DÍA' || unit === 'D') return valor;
    return valor;
  };

  const seriesBucketsByAge = useMemo(() => {
    const ageGroups = new Map<string, typeof datosGrafico>();

    for (const p of datosGrafico) {
      const edadOriginal = p.edadOriginal;
      const unidadEdad = p.unidadEdad;
      let ageKey: string;
      if (edadOriginal !== undefined && unidadEdad) {
        ageKey = `${edadOriginal}_${unidadEdad}`;
      } else {
        const age = p.edad || 28;
        ageKey = `age_${age}`;
      }
      if (!ageGroups.has(ageKey)) ageGroups.set(ageKey, []);
      ageGroups.get(ageKey)!.push(p);
    }

    const sortedAgeKeys = Array.from(ageGroups.keys()).sort((a, b) => parseAgeKey(a) - parseAgeKey(b));

    return sortedAgeKeys.reduce(
      (acc, ageKey) => {
        acc[ageKey] = ageGroups.get(ageKey)!;
        return acc;
      },
      {} as Record<string, typeof datosGrafico>
    );
  }, [datosGrafico]);

  const seriesBucketsByClasificacion = useMemo(() => {
    const fc: typeof datosGrafico = [];
    const mr: typeof datosGrafico = [];
    for (const p of datosGrafico) {
      if (p.clasificacion === 'MR') mr.push(p);
      else fc.push(p);
    }
    const out: Record<string, typeof datosGrafico> = {};
    if (fc.length) out['FC'] = fc;
    if (mr.length) out['MR'] = mr;
    return out;
  }, [datosGrafico]);

  const ageColors = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
    '#6366f1',
    '#84cc16',
  ];

  const chartSeries = useMemo(() => {
    const buckets = colorMode === 'edad' ? seriesBucketsByAge : seriesBucketsByClasificacion;
    const keys = Object.keys(buckets).sort((a, b) => {
      if (colorMode === 'clasificacion') return a.localeCompare(b);
      return parseAgeKey(a) - parseAgeKey(b);
    });

    return keys.map((key, index) => {
      const colorIndex = colorMode === 'clasificacion' ? (key === 'MR' ? 1 : 3) : index % ageColors.length;
      const firstDataPoint = buckets[key][0];

      let label: string;
      if (colorMode === 'clasificacion') {
        label = key === 'MR' ? 'MR' : 'FC';
      } else if (firstDataPoint?.edadOriginal !== undefined && firstDataPoint?.unidadEdad) {
        const originalAge = firstDataPoint.edadOriginal;
        const unit = firstDataPoint.unidadEdad;
        if (unit === 'HORA' || unit === 'H') {
          label = originalAge === 1 ? '1 hora' : `${originalAge} horas`;
        } else if (unit === 'DÍA' || unit === 'D') {
          label = originalAge === 1 ? '1 día' : `${originalAge} días`;
        } else {
          label = `${originalAge} ${unit}`;
        }
      } else if (key.startsWith('age_')) {
        const age = parseInt(key.replace('age_', ''), 10);
        label = age === 1 ? '1 día' : `${age} días`;
      } else {
        const [value, unit] = key.split('_');
        const valor = parseInt(value, 10);
        if (unit === 'HORA' || unit === 'H') {
          label = valor === 1 ? '1 hora' : `${valor} horas`;
        } else if (unit === 'DÍA' || unit === 'D') {
          label = valor === 1 ? '1 día' : `${valor} días`;
        } else {
          label = `${valor} ${unit}`;
        }
      }

      return {
        id: key,
        name: label,
        data: buckets[key].map(mapChartPoint),
        fill: ageColors[colorIndex % ageColors.length],
      };
    });
  }, [seriesBucketsByAge, seriesBucketsByClasificacion, colorMode]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data) return null;

      const dateValue = new Date(data.x);
      const formattedDate = format(dateValue, 'dd/MM/yyyy');
      const percentage = Number(data.cumplimiento || data.y || 0);
      const formattedPercentage = percentage.toFixed(2);

      return (
        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-md min-w-[200px]">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-stone-500">Fecha</span>
              <span className="font-medium text-stone-900">{formattedDate}</span>
            </div>
            <div className="flex justify-between gap-6 border-t border-stone-100 pt-2">
              <span className="text-stone-500">Cumplimiento</span>
              <span className="font-semibold text-stone-900">{formattedPercentage}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <CardHeader>
          <div className="h-6 w-[250px] bg-stone-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
            <p className="text-sm text-stone-500">Cargando datos del gráfico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const yMax = Math.max(110, ...datosGrafico.map((d) => d.y)) + 10;

  return (
    <>
      <Card className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <CardHeader className="pb-2 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold text-stone-900">Cumplimiento de resistencia</CardTitle>
            <span className="text-xs text-stone-500">
              {datosGrafico.length} muestreo{datosGrafico.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-md border border-stone-100 bg-stone-50/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <Switch id="chart-trend" checked={showTrend} onCheckedChange={setShowTrend} />
              <Label htmlFor="chart-trend" className="text-xs font-medium text-stone-700 cursor-pointer">
                Media móvil
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="chart-ref100" checked={showRef100} onCheckedChange={setShowRef100} />
              <Label htmlFor="chart-ref100" className="text-xs font-medium text-stone-700 cursor-pointer">
                Línea 100%
              </Label>
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-xs text-stone-600 whitespace-nowrap">Color</span>
              <Select value={colorMode} onValueChange={(v) => setColorMode(v as ChartColorMode)}>
                <SelectTrigger className="h-8 text-xs border-stone-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edad">Por edad</SelectItem>
                  <SelectItem value="clasificacion">FC / MR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {soloEdadGarantia && datosGrafico.length > 0 && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <strong>Edad de garantía:</strong> solo ensayos en edad de garantía de la receta.
              {(() => {
                const ages = Array.from(new Set(datosGrafico.map((d) => d.edad))).sort((a, b) => a - b);
                if (ages.length > 0) return ` Edades (días agrupados): ${ages.join(', ')}.`;
                return '';
              })()}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {typeof window !== 'undefined' && datosGrafico.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120, 113, 108, 0.2)" vertical horizontal />
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
                    tick={{ fontSize: 12, fill: '#44403c' }}
                    tickMargin={10}
                    stroke="#a8a29e"
                    allowDecimals={false}
                    label={{
                      value: 'Fecha',
                      position: 'insideBottom',
                      offset: -20,
                      style: { textAnchor: 'middle', fontSize: 12, fill: '#44403c', fontWeight: 500 },
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0, yMax]}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    tick={{ fontSize: 12, fill: '#44403c' }}
                    tickMargin={10}
                    stroke="#a8a29e"
                    label={{
                      value: 'Cumplimiento (%)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: -5,
                      style: { textAnchor: 'middle', fontSize: 12, fill: '#44403c', fontWeight: 500 },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#a8a29e', strokeWidth: 1 }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {showTrend && trendLineData.length > 0 && (
                    <Line
                      type="monotone"
                      data={trendLineData}
                      dataKey="ma"
                      stroke="#57534e"
                      strokeWidth={2}
                      dot={false}
                      name="Media móvil"
                      isAnimationActive={false}
                    />
                  )}
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
                  <ReferenceLine
                    y={90}
                    stroke="#a8a29e"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    label={{
                      value: '90%',
                      position: 'insideTopRight',
                      offset: 5,
                      style: { fill: '#57534e', fontSize: 11, fontWeight: 500 },
                    }}
                  />
                  {showRef100 && (
                    <ReferenceLine
                      y={100}
                      stroke="#b91c1c"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      label={{
                        value: '100%',
                        position: 'insideTopRight',
                        offset: 5,
                        style: { fill: '#b91c1c', fontSize: 12, fontWeight: 600 },
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <BarChart3 className="h-10 w-10 text-stone-300 mb-3" />
              <p className="text-sm font-medium text-stone-600 mb-1">No hay datos para mostrar</p>
              <p className="text-xs text-stone-500 text-center max-w-md">
                Ajusta los filtros o el rango de fechas para visualizar datos en el gráfico
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedPoint} onOpenChange={(open) => !open && setSelectedPoint(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle del punto</SheetTitle>
            <SheetDescription>Muestreo y ensayos asociados</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {selectedPoint &&
              (useClientPortalAnalysis ? (
                <ClientPointAnalysis point={selectedPoint} onClose={() => setSelectedPoint(null)} />
              ) : (
                <DetailedPointAnalysis point={selectedPoint} onClose={() => setSelectedPoint(null)} />
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
