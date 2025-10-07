'use client';

import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface MallaData {
  numero_malla: string;
  abertura_mm: number;
  peso_retenido: number | null;
  porcentaje_retenido: number;
  porcentaje_acumulado: number;
  porcentaje_pasa: number;
}

interface LimiteMalla {
  malla: string;
  limite_inferior: number;
  limite_superior: number;
}

interface CurvaGranulometricaProps {
  mallas: MallaData[];
  limites?: LimiteMalla[];
  tipoMaterial?: 'Arena' | 'Grava';
  tamaño?: string;
}

export default function CurvaGranulometrica({ 
  mallas, 
  limites = [],
  tipoMaterial,
  tamaño
}: CurvaGranulometricaProps) {
  // Normalizar nombre de malla para comparación
  const normalizarNombreMalla = (nombre: string): string => {
    return nombre
      .replace(/No\.\s*/g, '')  // Eliminar "No. " o "No."
      .replace(/"/g, '')         // Eliminar comillas
      .replace(/\s+/g, '')       // Eliminar espacios
      .trim()
      .toLowerCase();
  };

  // Mapeo de nombres de mallas a valores numéricos para el eje X
  const mallaToNumber: Record<string, number> = {
    '3"': 75.0,
    '3': 75.0,
    '2"': 50.0,
    '2': 50.0,
    '1 1/2"': 37.5,
    '11/2': 37.5,
    '1 1/2': 37.5,
    '1"': 25.0,
    '1': 25.0,
    '3/4"': 19.0,
    '3/4': 19.0,
    '1/2"': 12.5,
    '1/2': 12.5,
    '3/8"': 9.5,
    '3/8': 9.5,
    'No. 4': 4.75,
    '4': 4.75,
    'No. 8': 2.36,
    '8': 2.36,
    'No. 16': 1.18,
    '16': 1.18,
    'No. 30': 0.60,
    '30': 0.60,
    'No. 50': 0.30,
    '50': 0.30,
    'No. 100': 0.15,
    '100': 0.15,
    'No. 200': 0.075,
    '200': 0.075,
    'Fondo': 0.0
  };

  // Preparar datos para la gráfica
  const prepararDatosGrafica = () => {
    // Crear mapa de límites por nombre normalizado de malla
    const limitesMap = new Map<string, { inferior: number; superior: number; abertura: number }>();
    
    limites.forEach(limite => {
      const nombreNormalizado = normalizarNombreMalla(limite.malla);
      // Buscar abertura correspondiente
      const aberturaKey = Object.keys(mallaToNumber).find(key => 
        normalizarNombreMalla(key) === nombreNormalizado
      );
      const abertura = aberturaKey ? mallaToNumber[aberturaKey] : undefined;
      
      if (abertura !== undefined) {
        limitesMap.set(nombreNormalizado, {
          inferior: limite.limite_inferior,
          superior: limite.limite_superior,
          abertura: abertura
        });
      }
    });

    // Combinar datos de mallas con límites
    // Solo incluir mallas que fueron llenadas (tienen peso_retenido)
    const mallasFiltradas = mallas.filter(malla => {
      // Excluir Fondo y mallas sin abertura
      if (malla.numero_malla === 'Fondo' || malla.abertura_mm <= 0) return false;
      
      // Solo incluir mallas que fueron llenadas
      if (malla.peso_retenido === null || malla.peso_retenido === undefined) return false;
      
      return true;
    });
    
    // Crear mapa SOLO con las mallas que fueron llenadas
    const mallasRelevantesMap = new Map<number, any>();
    
    // Agregar ÚNICAMENTE las mallas llenadas con sus límites correspondientes
    mallasFiltradas.forEach(malla => {
      const nombreNormalizado = normalizarNombreMalla(malla.numero_malla);
      const limite = limitesMap.get(nombreNormalizado);
      
      mallasRelevantesMap.set(malla.abertura_mm, {
        abertura: malla.abertura_mm,
        malla: malla.numero_malla,
        porcentaje_pasa: malla.porcentaje_pasa,
        limite_inferior: limite?.inferior,
        limite_superior: limite?.superior
      });
    });
    
    // Convertir el map a array y ordenar
    const datos = Array.from(mallasRelevantesMap.values())
      .sort((a, b) => b.abertura - a.abertura); // Ordenar de mayor a menor abertura

    return datos;
  };

  const datosGrafica = prepararDatosGrafica();
  
  // Calcular ticks dinámicamente basados en las mallas con datos
  const ticksDinamicos = datosGrafica.map(d => d.abertura).sort((a, b) => a - b);

  // Formato personalizado para el eje X
  const formatXAxis = (value: number) => {
    // Buscar el nombre de la malla correspondiente
    const entrada = Object.entries(mallaToNumber).find(([_, val]) => val === value);
    if (entrada) {
      return entrada[0].replace('No. ', '').replace('"', '');
    }
    return value.toString();
  };

  // Formato personalizado para el tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border-2 border-gray-300 rounded-lg shadow-xl">
          <p className="font-bold text-gray-900 mb-3 text-base border-b pb-2">
            Malla {data.malla}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Abertura: <span className="font-semibold">{data.abertura} mm</span>
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm font-medium text-gray-700">{entry.name}:</span>
              </div>
              <span className="text-sm font-bold" style={{ color: entry.color }}>
                {entry.value?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Si no hay datos de granulometría real, mostrar mensaje
  const tieneDatosGranulometria = datosGrafica.some(d => d.porcentaje_pasa !== undefined);
  
  if (datosGrafica.length === 0 || !tieneDatosGranulometria) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#069e2d]" />
            Curva Granulométrica
            {tipoMaterial && tamaño && (
              <span className="text-sm font-normal text-gray-600">
                ({tipoMaterial} - {tamaño})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <BarChart3 className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-700 font-medium text-lg mb-2">
              Sin datos para graficar
            </p>
            <p className="text-gray-500 text-sm max-w-md">
              Ingrese los pesos retenidos en las mallas para visualizar la curva granulométrica.
              {limites.length > 0 && ' Solo se mostrarán las mallas correspondientes al tamaño seleccionado.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#069e2d]" />
          Curva Granulométrica
          {tipoMaterial && tamaño && (
            <span className="text-sm font-normal text-gray-600">
              ({tipoMaterial} - {tamaño})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white p-6 rounded-lg border">
          <ResponsiveContainer width="100%" height={700}>
            <ComposedChart 
              data={datosGrafica}
              margin={{ top: 40, right: 60, left: 60, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
              
              <XAxis 
                dataKey="abertura"
                type="number"
                scale="log"
                domain={['dataMin', 'dataMax']}
                ticks={ticksDinamicos}
                tickFormatter={formatXAxis}
                label={{ 
                  value: 'Abertura del tamiz (mm)', 
                  position: 'bottom',
                  offset: 60,
                  style: { fontWeight: '600', fontSize: 14, fill: '#1f2937' }
                }}
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12, fill: '#4b5563', fontWeight: '500' }}
                stroke="#9ca3af"
                strokeWidth={1.5}
              />
              
              <YAxis 
                domain={[0, 100]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                label={{ 
                  value: '% Que Pasa', 
                  angle: -90, 
                  position: 'insideLeft',
                  offset: 10,
                  style: { fontWeight: '600', fontSize: 14, fill: '#1f2937' }
                }}
                tick={{ fontSize: 12, fill: '#4b5563', fontWeight: '500' }}
                stroke="#9ca3af"
                strokeWidth={1.5}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ 
                  paddingBottom: '20px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
                iconType="line"
                iconSize={18}
              />

              {/* Área entre límites si existen - Color azul claro */}
              {limites.length > 0 && datosGrafica.some(d => d.limite_inferior !== undefined) && (
                <>
                  <Area
                    type="linear"
                    dataKey="limite_superior"
                    stroke="none"
                    fill="#60a5fa"
                    fillOpacity={0.2}
                    name="Área de Especificación"
                  />
                  <Area
                    type="linear"
                    dataKey="limite_inferior"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                  />
                </>
              )}

              {/* Líneas de límites - Azul */}
              {limites.length > 0 && datosGrafica.some(d => d.limite_superior !== undefined) && (
                <Line 
                  type="linear" 
                  dataKey="limite_superior" 
                  stroke="#1e40af" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: '#1e40af', r: 4, strokeWidth: 0 }}
                  name="Límite Superior"
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              
              {limites.length > 0 && datosGrafica.some(d => d.limite_inferior !== undefined) && (
                <Line 
                  type="linear" 
                  dataKey="limite_inferior" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                  name="Límite Inferior"
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}

              {/* Línea de datos reales - Verde del logo */}
              {datosGrafica.some(d => d.porcentaje_pasa !== undefined) && (
                <Line 
                  type="linear" 
                  dataKey="porcentaje_pasa" 
                  stroke="#069e2d" 
                  strokeWidth={4}
                  dot={{ fill: '#069e2d', r: 6, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 9, strokeWidth: 2 }}
                  name="Granulometría Real"
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

