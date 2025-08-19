'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Calculator, TrendingUp, Info, Download, RefreshCw, AlertTriangle, Database } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import CurvasAbramsCalculator from '@/components/quality/CurvasAbramsCalculator';
import AbramsChartVisualization from '@/components/quality/AbramsChartVisualization';
import { supabase } from '@/lib/supabase';

// Tipos para los datos de las curvas de Abrams
interface AbramsDataPoint {
  waterCementRatio: number;
  compressiveStrength: number;
  age: number;
  cementType: string;
  aggregateType: string;
}

interface AbramsCalculation {
  targetStrength: number;
  waterCementRatio: number;
  cementContent: number;
  waterContent: number;
  efficiency: number;
}

export default function CurvasAbramsPage() {
  const { profile } = useAuthBridge();
  
  // Estados para los cálculos
  const [targetStrength, setTargetStrength] = useState<number>(250);
  const [cementType, setCementType] = useState<string>('CPC-30');
  const [aggregateType, setAggregateType] = useState<string>('basaltic');
  const [age, setAge] = useState<number>(28);
  const [calculationResult, setCalculationResult] = useState<AbramsCalculation | null>(null);
  
  // Estados para datos históricos
  const [historicalData, setHistoricalData] = useState<AbramsDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Datos de ejemplo para las curvas de Abrams (estos deberían venir de la BD)
  const abramsData = useMemo(() => {
    const data = [];
    for (let ratio = 0.3; ratio <= 0.8; ratio += 0.05) {
      // Fórmula simplificada de Abrams: f'c = A / (B^(w/c))
      // Donde A y B son constantes que dependen del tipo de cemento y agregados
      const A = cementType === 'CPC-40' ? 450 : cementType === 'CPC-30' ? 400 : 350;
      const B = aggregateType === 'basaltic' ? 7.5 : aggregateType === 'volcanic' ? 7.0 : 6.5;
      
      const strength28 = A / Math.pow(B, ratio);
      const strengthAge = age === 28 ? strength28 : strength28 * (age === 7 ? 0.75 : age === 14 ? 0.90 : 1.0);
      
      data.push({
        waterCementRatio: parseFloat(ratio.toFixed(2)),
        compressiveStrength: parseFloat(strengthAge.toFixed(2)),
        age,
        cementType,
        aggregateType
      });
    }
    return data;
  }, [cementType, aggregateType, age]);

  // Función para calcular la relación agua/cemento óptima
  const calculateOptimalRatio = () => {
    if (!targetStrength || targetStrength <= 0) return;
    
    // Buscar el punto más cercano en la curva
    const closestPoint = abramsData.reduce((prev, curr) => 
      Math.abs(curr.compressiveStrength - targetStrength) < Math.abs(prev.compressiveStrength - targetStrength) 
        ? curr 
        : prev
    );
    
    // Calcular contenidos de cemento y agua (valores típicos)
    const cementContent = 350; // kg/m³ (valor base)
    const waterContent = cementContent * closestPoint.waterCementRatio;
    const efficiency = targetStrength / cementContent;
    
    setCalculationResult({
      targetStrength,
      waterCementRatio: closestPoint.waterCementRatio,
      cementContent,
      waterContent,
      efficiency
    });
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder a las Curvas de Abrams.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Esta herramienta está restringida a usuarios con roles específicos como Equipo de Calidad,
              Gerentes de Planta, Ejecutivos y Dosificadores.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">
          Curvas de Abrams
        </h1>
        <p className="text-gray-500 mb-4">
          Análisis de la relación agua/cemento y resistencia a la compresión
        </p>
      </div>

      <Tabs defaultValue="calculator" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-white/60 backdrop-blur border border-slate-200/60">
          <TabsTrigger value="calculator">Calculadora</TabsTrigger>
          <TabsTrigger value="curves">Curvas de Análisis</TabsTrigger>
          <TabsTrigger value="historical">Datos Históricos</TabsTrigger>
        </TabsList>

        {/* Calculadora de Relación Agua/Cemento */}
        <TabsContent value="calculator">
          <CurvasAbramsCalculator 
            onCalculationComplete={(result) => {
              // Aquí se puede manejar el resultado del cálculo si es necesario
              console.log('Cálculo completado:', result);
            }}
          />
        </TabsContent>

        {/* Visualización de Curvas */}
        <TabsContent value="curves">
          <AbramsChartVisualization
            cementType={cementType}
            aggregateType={aggregateType}
            age={age}
            targetStrength={targetStrength}
            onPointSelect={(point) => {
              console.log('Punto seleccionado:', point);
            }}
          />
        </TabsContent>

        {/* Datos Históricos */}
        <TabsContent value="historical">
          <Card className="bg-white/80 backdrop-blur border border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Análisis de Datos Históricos
              </CardTitle>
              <p className="text-sm text-gray-500">
                Comparación entre curvas teóricas y resultados reales de ensayos
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-4">
                <Button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Cargar datos reales de ensayos con información de materiales
                      const { data: ensayosData } = await supabase
                        .from('ensayos')
                        .select(`
                          resistencia_calculada,
                          fecha_ensayo,
                          muestra:muestra_id (
                            tipo_muestra,
                            muestreo:muestreo_id (
                              planta,
                              remision:remision_id (
                                recipe:recipe_id (
                                  recipe_code,
                                  strength_fc,
                                  age_days
                                )
                              )
                            )
                          )
                        `)
                        .not('resistencia_calculada', 'is', null)
                        .order('fecha_ensayo', { ascending: false })
                        .limit(100);

                      if (ensayosData && ensayosData.length > 0) {
                        // Procesar datos para extraer relación a/c estimada
                        const processedData: AbramsDataPoint[] = ensayosData
                          .filter(ensayo => ensayo.muestra?.muestreo?.remision?.recipe)
                          .map(ensayo => {
                            const recipe = ensayo.muestra!.muestreo!.remision!.recipe!;
                            const resistance = ensayo.resistencia_calculada!;
                            
                            // Estimar relación a/c basada en resistencia obtenida
                            // Usando fórmula inversa de Abrams
                            const A = 400; // Constante base
                            const B = 7.5; // Constante base
                            const estimatedRatio = Math.log(A / resistance) / Math.log(B);
                            
                            return {
                              waterCementRatio: Math.max(0.3, Math.min(0.8, estimatedRatio)),
                              compressiveStrength: resistance,
                              age: recipe.age_days || 28,
                              cementType: 'CPC-30', // Valor por defecto
                              aggregateType: 'basaltic' // Valor por defecto
                            };
                          });

                        setHistoricalData(processedData);
                      } else {
                        setHistoricalData([]);
                      }
                    } catch (err) {
                      console.error('Error loading historical data:', err);
                      setError('Error al cargar datos históricos');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Cargar Datos Reales
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (historicalData.length > 0) {
                      const csvContent = [
                        'Relacion_a_c,Resistencia_kg_cm2,Edad_dias,Tipo_Cemento,Tipo_Agregado',
                        ...historicalData.map(d => 
                          `${d.waterCementRatio},${d.compressiveStrength},${d.age},${d.cementType},${d.aggregateType}`
                        )
                      ].join('\n');
                      
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `curvas_abrams_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  disabled={historicalData.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Datos
                </Button>
              </div>

              {historicalData.length > 0 ? (
                <div>
                  <div className="h-96 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number"
                          dataKey="waterCementRatio"
                          domain={[0.3, 0.8]}
                          label={{ value: 'Relación Agua/Cemento (a/c)', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis 
                          type="number"
                          dataKey="compressiveStrength"
                          label={{ value: 'Resistencia (kg/cm²)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip 
                          formatter={(value: any, name: string) => [
                            `${value} kg/cm²`, 
                            'Resistencia Real'
                          ]}
                          labelFormatter={(label: any) => `a/c = ${label}`}
                        />
                        <Legend />
                        
                        {/* Curva teórica */}
                        <Line 
                          type="monotone" 
                          dataKey="compressiveStrength" 
                          data={abramsData}
                          stroke="#94a3b8" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name="Curva Teórica"
                        />
                        
                        {/* Datos reales */}
                        <Scatter 
                          data={historicalData} 
                          fill="#ef4444"
                          name="Datos Reales"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Estadísticas de los datos históricos */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-blue-600 font-medium">Total Ensayos</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {historicalData.length}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-green-600 font-medium">Resistencia Promedio</div>
                        <div className="text-2xl font-bold text-green-900">
                          {(historicalData.reduce((sum, d) => sum + d.compressiveStrength, 0) / historicalData.length).toFixed(1)}
                        </div>
                        <div className="text-xs text-green-600">kg/cm²</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-amber-600 font-medium">a/c Promedio</div>
                        <div className="text-2xl font-bold text-amber-900">
                          {(historicalData.reduce((sum, d) => sum + d.waterCementRatio, 0) / historicalData.length).toFixed(3)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-purple-600 font-medium">Desviación Estándar</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {(() => {
                            const mean = historicalData.reduce((sum, d) => sum + d.compressiveStrength, 0) / historicalData.length;
                            const variance = historicalData.reduce((sum, d) => sum + Math.pow(d.compressiveStrength - mean, 2), 0) / historicalData.length;
                            return Math.sqrt(variance).toFixed(1);
                          })()}
                        </div>
                        <div className="text-xs text-purple-600">kg/cm²</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay datos históricos cargados</p>
                  <p className="text-sm">Presiona "Cargar Datos Reales" para ver la comparación con ensayos reales</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Panel de Información */}
      <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Info className="h-5 w-5" />
            Acerca de las Curvas de Abrams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">Principio Fundamental</h4>
              <p className="text-blue-700 text-sm">
                Las curvas de Abrams establecen la relación inversa entre la relación agua/cemento 
                y la resistencia a la compresión del concreto. A menor relación a/c, mayor resistencia.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">Aplicaciones Prácticas</h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Diseño de mezclas de concreto</li>
                <li>• Control de calidad en producción</li>
                <li>• Optimización de dosificaciones</li>
                <li>• Predicción de resistencias</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
