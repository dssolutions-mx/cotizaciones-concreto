'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';

interface QualityChartProps {
  type: 'line' | 'bar' | 'scatter' | 'area' | 'muestreos-timeline' | 'compliance-distribution' | 'resistance-trend' | 'volumetric-trend' | 'resistance-performance';
  data: any[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

export function QualityChart({ 
  type, 
  data, 
  height = 400,
  showLegend = true,
  showGrid = true 
}: QualityChartProps) {
  // Custom tooltip with iOS 26 styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const cumplimiento = data?.cumplimiento;
      const resistencia = data?.resistencia;
      const objetivo = data?.objetivo;
      const rendimiento = data?.rendimiento;
      
      // Volumetric tooltip
      if (rendimiento !== null && rendimiento !== undefined) {
        return (
          <div className="glass-thick rounded-xl p-4 border border-white/20 shadow-xl min-w-[220px]">
            <p className="text-footnote font-semibold text-label-primary mb-3">
              {label}
            </p>
            
            <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-white/10">
              <span className="text-caption text-label-secondary">Rendimiento:</span>
              <span className={`text-title-3 font-bold ${
                rendimiento >= 100 ? 'text-systemGreen' : 
                rendimiento >= 98 ? 'text-systemOrange' : 
                'text-systemRed'
              }`}>
                {rendimiento?.toFixed(1)}%
              </span>
            </div>
            
            <div className="text-caption text-label-tertiary">
              {rendimiento >= 100 ? 'Objetivo alcanzado' : 
               rendimiento >= 98 ? 'Dentro del rango aceptable' : 
               'Por debajo del objetivo'}
            </div>
          </div>
        );
      }
      
      // Compliance tooltip
      return (
        <div className="glass-thick rounded-xl p-4 border border-white/20 shadow-xl min-w-[220px]">
          <p className="text-footnote font-semibold text-label-primary mb-3">
            {label}
          </p>
          
          {/* Compliance percentage - main metric */}
          <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-white/10">
            <span className="text-caption text-label-secondary">Cumplimiento:</span>
            <span className={`text-title-3 font-bold ${
              cumplimiento >= 100 ? 'text-systemGreen' : 
              cumplimiento >= 85 ? 'text-systemOrange' : 
              'text-systemRed'
            }`}>
              {cumplimiento?.toFixed(1)}%
            </span>
          </div>
          
          {/* Resistance details */}
          {resistencia !== null && resistencia !== undefined && (
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-caption text-label-tertiary">Resistencia obtenida:</span>
              <span className="text-callout text-label-secondary">
                {resistencia} kg/cm²
              </span>
            </div>
          )}
          
          {/* Target resistance */}
          {objetivo !== null && objetivo !== undefined && objetivo > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-caption text-label-tertiary">f'c diseño:</span>
              <span className="text-callout text-label-secondary">
                {objetivo} kg/cm²
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Muestreos Timeline Chart
  if (type === 'muestreos-timeline') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            label={{ value: 'Rendimiento (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            label={{ value: 'Cumplimiento (%)', angle: 90, position: 'insideRight', fill: 'rgba(255,255,255,0.6)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
          
          <ReferenceLine 
            yAxisId="right" 
            y={95} 
            stroke="#34C759" 
            strokeDasharray="3 3" 
            label={{ value: "Meta 95%", fill: '#34C759', fontSize: 11 }}
          />
          
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="rendimiento"
            stroke="#007AFF"
            name="Rendimiento Vol."
            strokeWidth={3}
            dot={{ fill: '#007AFF', r: 5, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7 }}
          />
          
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumplimiento"
            stroke="#34C759"
            name="Cumplimiento"
            strokeWidth={3}
            dot={{ fill: '#34C759', r: 5, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Compliance Distribution Chart
  if (type === 'compliance-distribution') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="range" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            label={{ value: 'Cantidad', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          <Bar 
            dataKey="count" 
            fill="#007AFF" 
            name="Ensayos"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Resistance Trend Chart (Legacy - simple version)
  if (type === 'resistance-trend') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            label={{ value: 'Resistencia (kg/cm²)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          
          <defs>
            <linearGradient id="resistenciaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#AF52DE" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#AF52DE" stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <Area
            type="monotone"
            dataKey="resistencia"
            stroke="#AF52DE"
            strokeWidth={3}
            fill="url(#resistenciaGradient)"
            name="Resistencia Promedio"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Resistance Performance Chart - Shows Compliance Percentage (iOS 26 Clean Design)
  if (type === 'resistance-performance') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
            stroke="rgba(255,255,255,0.1)"
            axisLine={false}
            tickLine={false}
          />
          
          <YAxis 
            domain={[90, 105]}
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
            stroke="rgba(255,255,255,0.1)"
            axisLine={false}
            tickLine={false}
            width={35}
          />
          
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          
          {/* Subtle reference line at 100% */}
          <ReferenceLine 
            y={100}
            stroke="rgba(52, 199, 89, 0.3)" 
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          
          {/* Bars for compliance percentage */}
          <Bar 
            dataKey="cumplimiento" 
            radius={[12, 12, 0, 0]}
            maxBarSize={40}
          >
            {/* Color bars based on compliance level */}
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={
                  entry.cumplimiento >= 100 ? '#34C759' : 
                  entry.cumplimiento >= 98 ? '#FF9500' : 
                  '#FF3B30'
                }
                opacity={entry.cumplimiento >= 100 ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Volumetric Trend Chart
  if (type === 'volumetric-trend') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            domain={[88, 110]}
            label={{ value: 'Rendimiento Volumétrico (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          
          {/* Reference lines for target ranges */}
          <ReferenceLine 
            y={100} 
            stroke="#34C759" 
            strokeDasharray="3 3" 
            label={{ value: "Objetivo 100%", fill: '#34C759', fontSize: 11 }}
          />
          <ReferenceLine 
            y={98} 
            stroke="#FF9500" 
            strokeDasharray="3 3" 
            label={{ value: "Mínimo 98%", fill: '#FF9500', fontSize: 11 }}
          />
          
          <defs>
            <linearGradient id="volumetricGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <Area
            type="monotone"
            dataKey="rendimiento"
            stroke="#007AFF"
            strokeWidth={3}
            fill="url(#volumetricGradient)"
            name="Rendimiento Volumétrico"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Generic Line Chart
  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#007AFF"
            strokeWidth={2}
            dot={{ fill: '#007AFF', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Generic Bar Chart
  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          <Bar dataKey="value" fill="#007AFF" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Scatter Chart
  if (type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
          <XAxis 
            dataKey="x" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            name="X"
          />
          <YAxis 
            dataKey="y"
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.3)"
            name="Y"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          {showLegend && <Legend />}
          <Scatter name="Data" data={data} fill="#007AFF" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

export default QualityChart;

