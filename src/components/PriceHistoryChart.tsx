/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import React, { useMemo, memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ClientPriceHistory,
  RecipePriceHistory,
  PriceHistoryEntry,
} from '@/types/priceHistory';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface PriceHistoryChartProps {
  data: ClientPriceHistory[] | RecipePriceHistory[];
  groupBy: 'client' | 'recipe';
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | null;
}

const COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#0891b2', // cyan-600
];

// Define proper interfaces for the memoized components
interface XAxisProps {
  dataKey: string;
  tick: object;
  height?: number;
  interval?: number | "preserveStart" | "preserveEnd" | "preserveStartEnd";
}

interface YAxisProps {
  tickFormatter?: (value: number) => string;
  tick: object;
  width?: number;
}

interface TooltipProps {
  formatter?: (value: number, name: string, props: object) => React.ReactNode;
  labelFormatter?: (label: string) => React.ReactNode;
}

interface LegendProps {
  className?: string;
  layout?: "horizontal" | "vertical";
  verticalAlign?: "top" | "middle" | "bottom";
  align?: "left" | "center" | "right";
}

// Componentes memoizados para mejor rendimiento
const MemoizedCartesianGrid = memo(({ strokeDasharray }: { strokeDasharray: string }) => (
  <CartesianGrid strokeDasharray={strokeDasharray} stroke="#e5e7eb" strokeOpacity={0.7} />
));
MemoizedCartesianGrid.displayName = 'MemoizedCartesianGrid';

const MemoizedXAxis = memo(({ dataKey, tick, height, interval }: XAxisProps) => (
  <XAxis
    dataKey={dataKey}
    tick={tick}
    height={height}
    interval={interval}
    axisLine={{ stroke: '#d1d5db' }}
  />
));
MemoizedXAxis.displayName = 'MemoizedXAxis';

const MemoizedYAxis = memo(({ tickFormatter, tick, width }: YAxisProps) => (
  <YAxis
    tickFormatter={tickFormatter}
    tick={tick}
    width={width}
    axisLine={{ stroke: '#d1d5db' }}
  />
));
MemoizedYAxis.displayName = 'MemoizedYAxis';

const MemoizedTooltip = memo(({ formatter, labelFormatter }: TooltipProps) => (
  <Tooltip
    formatter={formatter}
    labelFormatter={labelFormatter}
    cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
  />
));
MemoizedTooltip.displayName = 'MemoizedTooltip';

const MemoizedLegend = memo(({ className, layout, verticalAlign, align }: LegendProps) => (
  <Legend
    className={className}
    layout={layout}
    verticalAlign={verticalAlign}
    align={align}
    wrapperStyle={{ paddingTop: 10 }}
  />
));
MemoizedLegend.displayName = 'MemoizedLegend';

// Versión altamente optimizada del componente de gráficos
const PriceHistoryChartComponent: React.FC<PriceHistoryChartProps> = memo(({
  data,
  groupBy,
}) => {
  // Reducir complejidad de procesamiento de datos
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Limitar el número de puntos para mejorar rendimiento
    const allDates = new Set<string>();
    const series: { [key: string]: { [date: string]: number } } = {};
    
    console.log('Processing chart data:', { groupBy, data });
    
    if (groupBy === 'client') {
      const clientData = data as ClientPriceHistory[];
      clientData.forEach(client => {
        if (!client.recipes) {
          console.log('Client has no recipes:', client);
          return;
        }

        client.recipes.forEach(recipe => {
          if (!recipe.priceHistory) {
            console.log('Recipe has no price history:', recipe);
            return;
          }

          const seriesKey = `${client.businessName} - ${recipe.recipeCode}`;
          series[seriesKey] = {};
          
          recipe.priceHistory.forEach(entry => {
            const dateStr = formatDate(entry.effectiveDate);
            allDates.add(dateStr);
            series[seriesKey][dateStr] = entry.base_price;
          });
        });
      });
    } else {
      const recipeData = data as RecipePriceHistory[];
      recipeData.forEach(recipe => {
        if (!recipe.clients) {
          console.log('Recipe has no clients:', recipe);
          return;
        }

        recipe.clients.forEach(client => {
          if (!client.priceHistory) {
            console.log('Client has no price history:', client);
            return;
          }

          const seriesKey = `${recipe.recipeCode} (${recipe.strengthFc} kg/cm²) - ${client.businessName}`;
          series[seriesKey] = {};
          
          client.priceHistory.forEach(entry => {
            const dateStr = formatDate(entry.effectiveDate);
            allDates.add(dateStr);
            series[seriesKey][dateStr] = entry.base_price;
          });
        });
      });
    }

    console.log('Generated series data:', series);

    // Si tenemos más de 20 puntos, reducir para móviles
    const sortedDates = Array.from(allDates).sort();
    const isMobile = window.innerWidth < 768;
    
    // En móviles, reducir dramáticamente la cantidad de puntos de datos
    const filteredDates = isMobile && sortedDates.length > 10 
      ? sortedDates.filter((_, index) => index % 3 === 0 || index === sortedDates.length - 1)
      : sortedDates;
    
    const chartPoints = filteredDates.map(date => {
      const point: ChartDataPoint = { date };
      Object.entries(series).forEach(([key, values]) => {
        point[key] = values[date] || null;
      });
      return point;
    });
    
    return chartPoints;
  }, [data, groupBy]);

  const seriesKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    
    // Limitar el número de series para móviles (mejor rendimiento)
    const isMobile = window.innerWidth < 768;
    const allKeys = Object.keys(chartData[0]).filter(key => key !== 'date');
    
    return isMobile && allKeys.length > 3 
      ? allKeys.slice(0, 3) // Solo mostrar las 3 primeras series en móvil
      : allKeys;
  }, [chartData]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos disponibles
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos históricos para mostrar
      </div>
    );
  }
  
  // Reducir la complejidad del renderizado en móviles
  const isMobile = window.innerWidth < 768;
  const chartHeight = isMobile ? '250px' : '500px';
  const strokeWidth = isMobile ? 1.5 : 2;
  const dotRadius = isMobile ? 2 : 4;
  
  return (
    <div className="w-full gpu-accelerated" style={{height: chartHeight, marginTop: '1rem'}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData}
          margin={{ 
            top: 10, 
            right: 10, 
            left: 0, 
            bottom: 20
          }}
        >
          <MemoizedCartesianGrid strokeDasharray="3 3" />
          <MemoizedXAxis
            dataKey="date"
            tick={{ 
              fontSize: 12,
              className: "chart-x-axis-tick"
            }}
            height={30}
            interval="preserveStartEnd"
          />
          <MemoizedYAxis
            tickFormatter={(value: number) => formatCurrency(value)}
            tick={{ fontSize: 12 }}
            width={60}
          />
          <MemoizedTooltip
            formatter={(value: number) => [formatCurrency(value)]}
            labelFormatter={(label: string) => `Fecha: ${label}`}
          />
          <MemoizedLegend 
            className="chart-legend"
            layout="vertical"
            verticalAlign="middle"
            align="right"
          />
          {seriesKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={strokeWidth}
              className="chart-line"
              dot={{ r: dotRadius }}
              activeDot={{ r: dotRadius + 2 }}
              connectNulls
              name={key}
              isAnimationActive={!isMobile} // Deshabilitar animaciones en móvil
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

PriceHistoryChartComponent.displayName = 'PriceHistoryChart';

export const PriceHistoryChart = PriceHistoryChartComponent; 