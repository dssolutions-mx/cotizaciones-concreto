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
import { typography } from '@/lib/design-system/typography';

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
    if (!nombre) return '';
    return nombre
      .replace(/No\.\s*/gi, '')  // Eliminar "No. " o "No." (case insensitive)
      .replace(/no\.\s*/gi, '')  // Eliminar "no. " o "no."
      .replace(/"/g, '')         // Eliminar comillas
      .replace(/'/g, '')         // Eliminar comillas simples
      .replace(/\s+/g, '')       // Eliminar espacios
      .replace(/\//g, '/')       // Normalizar slash
      .trim()
      .toLowerCase();
  };

  // Mapeo de nombres de mallas a valores numéricos para el eje X
  const mallaToNumber: Record<string, number> = {
    // Pulgadas grandes
    '3"': 75.0,
    '3': 75.0,
    '3in': 75.0,
    '2"': 50.0,
    '2': 50.0,
    '2in': 50.0,
    '1 1/2"': 37.5,
    '11/2"': 37.5,
    '11/2': 37.5,
    '1.5"': 37.5,
    '1.5': 37.5,
    '1 1/2': 37.5,
    '1"': 25.0,
    '1': 25.0,
    '1in': 25.0,
    '3/4"': 19.0,
    '3/4': 19.0,
    '.75': 19.0,
    '0.75': 19.0,
    '1/2"': 12.5,
    '1/2': 12.5,
    '.5': 12.5,
    '0.5': 12.5,
    '3/8"': 9.5,
    '3/8': 9.5,
    '.375': 9.5,
    '0.375': 9.5,
    // Números de malla
    'No. 4': 4.75,
    'no. 4': 4.75,
    '4': 4.75,
    '#4': 4.75,
    'No. 8': 2.36,
    'no. 8': 2.36,
    '8': 2.36,
    '#8': 2.36,
    'No. 16': 1.18,
    'no. 16': 1.18,
    '16': 1.18,
    '#16': 1.18,
    'No. 30': 0.60,
    'no. 30': 0.60,
    '30': 0.60,
    '#30': 0.60,
    'No. 50': 0.30,
    'no. 50': 0.30,
    '50': 0.30,
    '#50': 0.30,
    'No. 100': 0.15,
    'no. 100': 0.15,
    '100': 0.15,
    '#100': 0.15,
    'No. 200': 0.075,
    'no. 200': 0.075,
    '200': 0.075,
    '#200': 0.075,
    // Fondo
    'Fondo': 0.0,
    'fondo': 0.0,
    'pan': 0.0
  };

  // Preparar datos para la gráfica
  const prepararDatosGrafica = () => {
    // Crear mapa de límites por abertura (mm)
    const limitesMap = new Map<number, { inferior: number; superior: number }>();
    
    limites.forEach(limite => {
      const nombreNormalizado = normalizarNombreMalla(limite.malla);
      
      // Buscar abertura correspondiente con búsqueda más flexible
      let abertura: number | undefined;
      
      // Primero intentar búsqueda exacta normalizada
      const aberturaKey = Object.keys(mallaToNumber).find(key => 
        normalizarNombreMalla(key) === nombreNormalizado
      );
      
      if (aberturaKey) {
        abertura = mallaToNumber[aberturaKey];
      }
      
      // Si no se encuentra, intentar búsqueda por valor directo
      if (abertura === undefined && mallaToNumber[limite.malla]) {
        abertura = mallaToNumber[limite.malla];
      }
      
      // Si aún no se encuentra, intentar sin normalizar
      if (abertura === undefined) {
        const keyDirecto = Object.keys(mallaToNumber).find(key => 
          key.toLowerCase() === limite.malla.toLowerCase()
        );
        if (keyDirecto) {
          abertura = mallaToNumber[keyDirecto];
        }
      }
      
      if (abertura !== undefined) {
        limitesMap.set(abertura, {
          inferior: limite.limite_inferior,
          superior: limite.limite_superior
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
      // Buscar límite usando abertura directamente
      const limite = limitesMap.get(malla.abertura_mm);
      
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
        <div 
          className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl border border-gray-200/60 shadow-lg"
          style={{ fontFamily: typography.body.fontFamily }}
        >
          <p 
            className="text-gray-900 mb-2 pb-2 border-b border-gray-200"
            style={{
              fontSize: typography.callout.fontSize,
              fontWeight: 600,
              letterSpacing: typography.callout.letterSpacing
            }}
          >
            Malla {data.malla}
          </p>
          <p 
            className="text-gray-600 mb-3"
            style={{
              fontSize: typography.footnote.fontSize,
              letterSpacing: typography.footnote.letterSpacing
            }}
          >
            Abertura: <span className="font-semibold text-gray-900">{data.abertura} mm</span>
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span 
                  className="text-gray-700"
                  style={{
                    fontSize: typography.footnote.fontSize,
                    fontWeight: 500,
                    letterSpacing: typography.footnote.letterSpacing
                  }}
                >
                  {entry.name}:
                </span>
              </div>
              <span 
                className="font-semibold tabular-nums"
                style={{ 
                  color: entry.color,
                  fontSize: typography.callout.fontSize,
                  letterSpacing: typography.callout.letterSpacing
                }}
              >
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
        <div className="bg-white p-4 rounded-2xl border border-gray-200/60 shadow-sm">
          <ResponsiveContainer width="100%" height={750}>
            <ComposedChart 
              data={datosGrafica}
              margin={{ top: 60, right: 80, left: 70, bottom: 95 }}
            >
              <CartesianGrid 
                strokeDasharray="1 3" 
                stroke="#e5e7eb" 
                opacity={0.3}
                vertical={false}
              />
              
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
                  offset: 28,
                  style: { 
                    ...typography.title3,
                    fill: '#1d1d1f',
                    textAnchor: 'middle'
                  }
                }}
                angle={-45}
                textAnchor="end"
                height={90}
                tick={{ 
                  ...typography.callout,
                  fill: '#424245'
                }}
                stroke="#d2d2d7"
                strokeWidth={1.5}
                interval={0}
              />
              
              <YAxis 
                domain={[0, 100]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                label={{ 
                  value: '% Que pasa', 
                  angle: -90, 
                  position: 'insideLeft',
                  offset: 5,
                  style: { 
                    ...typography.title3,
                    fill: '#1d1d1f',
                    textAnchor: 'middle'
                  }
                }}
                tick={{ 
                  ...typography.callout,
                  fill: '#424245'
                }}
                stroke="#d2d2d7"
                strokeWidth={1.5}
                width={90}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                verticalAlign="top"
                align="left"
                height={50}
                wrapperStyle={{ 
                  paddingLeft: '20px',
                  paddingTop: '10px',
                  ...typography.callout,
                  fontWeight: 600,
                  color: '#1d1d1f'
                }}
                iconType="line"
                iconSize={16}
              />

              {/* Área entre límites si existen - Color gris suave */}
              {limites.length > 0 && datosGrafica.some(d => d.limite_inferior !== undefined) && (
                <>
                  <Area
                    type="monotone"
                    dataKey="limite_superior"
                    stroke="none"
                    fill="#0C1F28"
                    fillOpacity={0.08}
                    name="Área de Especificación"
                  />
                  <Area
                    type="monotone"
                    dataKey="limite_inferior"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                  />
                </>
              )}

              {/* Líneas de límites - Color del logo #0C1F28 */}
              {limites.length > 0 && datosGrafica.some(d => d.limite_superior !== undefined) && (
                <Line 
                  type="monotone" 
                  dataKey="limite_superior" 
                  stroke="#0C1F28" 
                  strokeWidth={3}
                  strokeDasharray="8 4"
                  dot={{ 
                    fill: '#0C1F28', 
                    r: 5, 
                    strokeWidth: 2, 
                    stroke: '#fff' 
                  }}
                  name="Límite superior"
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-in-out"
                  connectNulls={true}
                />
              )}
              
              {limites.length > 0 && datosGrafica.some(d => d.limite_inferior !== undefined) && (
                <Line 
                  type="monotone" 
                  dataKey="limite_inferior" 
                  stroke="#0C1F28" 
                  strokeWidth={3}
                  strokeDasharray="8 4"
                  dot={{ 
                    fill: '#0C1F28', 
                    r: 5, 
                    strokeWidth: 2, 
                    stroke: '#fff' 
                  }}
                  name="Límite inferior"
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-in-out"
                  connectNulls={true}
                />
              )}

              {/* Línea de datos reales - Verde del logo #069E2D */}
              {datosGrafica.some(d => d.porcentaje_pasa !== undefined) && (
                <Line 
                  type="monotone" 
                  dataKey="porcentaje_pasa" 
                  stroke="#069E2D" 
                  strokeWidth={4}
                  dot={{ 
                    fill: '#069E2D', 
                    r: 6, 
                    strokeWidth: 2.5, 
                    stroke: '#fff'
                  }}
                  activeDot={{ 
                    r: 8, 
                    strokeWidth: 3,
                    stroke: '#fff',
                    fill: '#069E2D'
                  }}
                  name="Granulometría"
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-in-out"
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

