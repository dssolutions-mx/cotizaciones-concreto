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
    const datos = mallas
      .filter(malla => malla.numero_malla !== 'Fondo' && malla.abertura_mm > 0)
      .map(malla => {
        const nombreNormalizado = normalizarNombreMalla(malla.numero_malla);
        const limite = limitesMap.get(nombreNormalizado);
        
        return {
          abertura: malla.abertura_mm,
          malla: malla.numero_malla,
          porcentaje_pasa: malla.porcentaje_pasa,
          limite_inferior: limite?.inferior,
          limite_superior: limite?.superior
        };
      })
      .sort((a, b) => b.abertura - a.abertura); // Ordenar de mayor a menor abertura

    return datos;
  };

  const datosGrafica = prepararDatosGrafica();

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
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            Malla {payload[0].payload.malla} ({payload[0].payload.abertura} mm)
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value?.toFixed(2)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Si no hay datos, mostrar mensaje
  if (datosGrafica.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#069e2d]" />
            Curva Granulométrica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>Ingrese los datos de las mallas para visualizar la curva granulométrica</p>
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
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart 
            data={datosGrafica}
            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            
            <XAxis 
              dataKey="abertura"
              type="number"
              scale="log"
              domain={['auto', 'auto']}
              tickFormatter={formatXAxis}
              label={{ 
                value: 'Tamaño de Malla', 
                position: 'bottom',
                offset: 40,
                style: { fontWeight: 'bold' }
              }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            
            <YAxis 
              domain={[0, 100]}
              label={{ 
                value: '% Que Pasa', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontWeight: 'bold' }
              }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />

            {/* Área entre límites si existen */}
            {limites.length > 0 && (
              <>
                <Area
                  type="monotone"
                  dataKey="limite_superior"
                  stroke="none"
                  fill="#fca5a5"
                  fillOpacity={0.3}
                  name="Límite Superior"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="limite_inferior"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                  name="Límite Inferior"
                  connectNulls
                />
              </>
            )}

            {/* Líneas de límites */}
            {limites.length > 0 && (
              <>
                <Line 
                  type="monotone" 
                  dataKey="limite_superior" 
                  stroke="#dc2626" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#dc2626', r: 4 }}
                  name="Límite Superior"
                  connectNulls
                />
                <Line 
                  type="monotone" 
                  dataKey="limite_inferior" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#2563eb', r: 4 }}
                  name="Límite Inferior"
                  connectNulls
                />
              </>
            )}

            {/* Línea de datos reales */}
            <Line 
              type="monotone" 
              dataKey="porcentaje_pasa" 
              stroke="#069e2d" 
              strokeWidth={3}
              dot={{ fill: '#069e2d', r: 6 }}
              name="% Que Pasa"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Leyenda adicional */}
        <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-[#069e2d]"></div>
            <span className="text-gray-700">Curva Real</span>
          </div>
          {limites.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-600 border-dashed"></div>
                <span className="text-gray-700">Límite Superior</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-600 border-dashed"></div>
                <span className="text-gray-700">Límite Inferior</span>
              </div>
            </>
          )}
        </div>

        {/* Indicador de cumplimiento */}
        {limites.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> La curva granulométrica debe encontrarse dentro del área definida por los límites inferior y superior para cumplir con las especificaciones.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

