'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Calculator, TrendingUp, Info, Download, RefreshCw, AlertTriangle, Database, Plus, Eye, Clock } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import CurvasAbramsCalculator from '@/components/quality/CurvasAbramsCalculator';
import AbramsChartVisualization from '@/components/quality/AbramsChartVisualization';
import NuevaMatrixForm from '@/components/quality/NuevaMatrixForm';
import CalendarioEnsayos from '@/components/quality/CalendarioEnsayos';
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
  
  // Estados para gestión de matrices
  const [showNewMatrixForm, setShowNewMatrixForm] = useState(false);
  const [matrices, setMatrices] = useState<any[]>([]);
  const [refreshMatrices, setRefreshMatrices] = useState(0);
  
  // Estados para muestras pendientes globales
  const [pendingTests, setPendingTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  // Cargar matrices existentes
  useEffect(() => {
    const loadMatrices = async () => {
      try {
        const { data: matricesData } = await supabase
          .from('id_matrix')
          .select(`
            id,
            no_matrix,
            created_at,
            plant:plant_id (
              code,
              name
            ),
            diseños:diseños_matrix (
              id,
              no_muestra,
              nombre_muestra,
              tipo_cemento,
              kg_cemento,
              consumo_agua
            )
          `)
          .order('created_at', { ascending: false });

        if (matricesData) {
          setMatrices(matricesData);
        }
      } catch (err) {
        console.error('Error loading matrices:', err);
      }
    };

    loadMatrices();
  }, [refreshMatrices]);

  // Cargar todas las muestras pendientes de ensayo
  useEffect(() => {
    const loadAllPendingTests = async () => {
      try {
        setLoadingTests(true);
        const { data: muestrasData } = await supabase
          .from('muestras_matrix')
          .select(`
            id,
            fecha_elaboracion,
            hora_elaboracion,
            masa_real,
            rev_real,
            contenido_aire,
            tipo_muestra,
            cube_medida,
            beam_width,
            beam_height,
            beam_span,
            diametro_cilindro,
            unidad_tiempo,
            cantidad_tiempo,
            fecha_ensayo,
            hora_ensayo,
            diseño:diseño_id (
              id,
              no_muestra,
              nombre_muestra,
              matrix:matrix_id (
                id,
                no_matrix,
                plant:plant_id (
                  code,
                  name
                )
              )
            ),
            ensayos:ensayos_matrix (
              id,
              fecha_ensayo,
              carga,
              resistencia_calculada,
              observaciones
            )
          `)
          .order('fecha_ensayo', { ascending: true });

        if (muestrasData) {
          setPendingTests(muestrasData);
        }
      } catch (err) {
        console.error('Error loading pending tests:', err);
      } finally {
        setLoadingTests(false);
      }
    };

    loadAllPendingTests();
  }, [refreshMatrices]); // Refrescar cuando se actualicen las matrices
  
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

      {/* Botón para agregar nueva matriz */}
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <Button 
          onClick={() => setShowNewMatrixForm(true)}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Nueva Matrix
        </Button>
      </div>

      {/* Formulario de nueva matriz (modal overlay) */}
      {showNewMatrixForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <NuevaMatrixForm
                onClose={() => setShowNewMatrixForm(false)}
                onSuccess={() => {
                  setRefreshMatrices(prev => prev + 1);
                  setShowNewMatrixForm(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="matrices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-white/60 backdrop-blur border border-slate-200/60">
          <TabsTrigger value="matrices">Matrices</TabsTrigger>
          <TabsTrigger value="ensayos">Ensayos Programados</TabsTrigger>
          <TabsTrigger value="calculator">Calculadora</TabsTrigger>
          <TabsTrigger value="curves">Curvas de Análisis</TabsTrigger>
          <TabsTrigger value="historical">Datos Históricos</TabsTrigger>
        </TabsList>

        {/* Gestión de Matrices */}
        <TabsContent value="matrices">
          <Card className="bg-white/80 backdrop-blur border border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Matrices de Diseño Existentes
              </CardTitle>
              <p className="text-sm text-gray-500">
                Gestiona las matrices de diseño de concreto por planta
              </p>
            </CardHeader>
            <CardContent>
              {matrices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matrices.map((matrix) => (
                    <Card 
                      key={matrix.id} 
                      className="bg-white border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => window.location.href = `/quality/curvas-abrams/${matrix.id}`}
                    >
                      <CardContent className="p-6">
                        <div className="text-center space-y-3">
                          <Badge variant="outline" className="text-blue-700 text-lg px-4 py-2">
                            {matrix.no_matrix}
                          </Badge>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">
                              {matrix.plant?.code} - {matrix.plant?.name}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {matrix.diseños?.length || 0} diseño(s) registrado(s)
                            </p>
                          </div>
                          <div className="text-xs text-gray-400">
                            Creado: {new Date(matrix.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No hay matrices registradas</p>
                  <p className="text-sm">Crea tu primera matriz de diseño para comenzar</p>
                  <Button 
                    onClick={() => setShowNewMatrixForm(true)}
                    className="mt-4 bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Matrix
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ensayos Programados */}
        <TabsContent value="ensayos">
          <div className="space-y-6">
            {/* Resumen de ensayos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="text-sm text-blue-600 font-medium">Total Muestras</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {pendingTests.length}
                  </div>
                  <div className="text-xs text-blue-600">En todas las matrices</div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="text-sm text-green-600 font-medium">Para Hoy</div>
                  <div className="text-2xl font-bold text-green-900">
                    {pendingTests.filter(m => {
                      const today = new Date().toISOString().split('T')[0];
                      return m.fecha_ensayo === today;
                    }).length}
                  </div>
                  <div className="text-xs text-green-600">Ensayos urgentes</div>
                </CardContent>
              </Card>
              
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="text-sm text-amber-600 font-medium">Esta Semana</div>
                  <div className="text-2xl font-bold text-amber-900">
                    {pendingTests.filter(m => {
                      const today = new Date();
                      const weekFromNow = new Date();
                      weekFromNow.setDate(today.getDate() + 7);
                      const ensayoDate = new Date(m.fecha_ensayo);
                      return ensayoDate >= today && ensayoDate <= weekFromNow;
                    }).length}
                  </div>
                  <div className="text-xs text-amber-600">Próximos 7 días</div>
                </CardContent>
              </Card>
              
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="text-sm text-purple-600 font-medium">Completados</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {pendingTests.filter(m => m.ensayos && m.ensayos.length > 0).length}
                  </div>
                  <div className="text-xs text-purple-600">Ensayos realizados</div>
                </CardContent>
              </Card>
            </div>

            {/* Calendario de ensayos */}
            {pendingTests.length > 0 && (
              <CalendarioEnsayos 
                muestras={pendingTests}
                onMuestraClick={(muestra) => {
                  console.log('Muestra seleccionada:', muestra);
                  // Aquí se puede abrir un modal con detalles o navegar
                }}
              />
            )}

            {/* Lista detallada de muestras pendientes */}
            <Card className="bg-white/80 backdrop-blur border border-slate-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Muestras Pendientes de Ensayo
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Todas las muestras programadas para ensayo de resistencia
                </p>
              </CardHeader>
              <CardContent>
                {loadingTests ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 mx-auto mb-4 text-gray-300 animate-spin" />
                    <p>Cargando ensayos programados...</p>
                  </div>
                ) : pendingTests.length > 0 ? (
                  <div className="space-y-3">
                    {pendingTests.map((muestra) => {
                      const isToday = muestra.fecha_ensayo === new Date().toISOString().split('T')[0];
                      const isPast = new Date(muestra.fecha_ensayo) < new Date();
                      const isCompleted = muestra.ensayos && muestra.ensayos.length > 0;
                      
                      return (
                        <Card 
                          key={muestra.id} 
                          className={`border ${
                            isCompleted ? 'border-blue-300 bg-blue-50' :
                            isToday ? 'border-green-300 bg-green-50' : 
                            isPast ? 'border-red-300 bg-red-50' : 
                            'border-gray-200 bg-white'
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                              {/* Información de la matriz */}
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Matriz</div>
                                <div className="font-medium text-gray-900">
                                  {muestra.diseño?.matrix?.no_matrix}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {muestra.diseño?.matrix?.plant?.code} - {muestra.diseño?.matrix?.plant?.name}
                                </div>
                              </div>

                              {/* Información del diseño */}
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Diseño</div>
                                <div className="font-medium text-gray-900">
                                  {muestra.diseño?.no_muestra} - {muestra.diseño?.nombre_muestra}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {muestra.tipo_muestra}
                                </Badge>
                              </div>

                              {/* Datos de elaboración */}
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Elaboración</div>
                                <div className="text-sm">
                                  <div><strong>Fecha:</strong> {muestra.fecha_elaboracion}</div>
                                  <div><strong>Rev. Real:</strong> {muestra.rev_real} cm</div>
                                </div>
                              </div>

                              {/* Dimensiones */}
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Dimensiones</div>
                                <div className="text-sm">
                                  {muestra.tipo_muestra === 'CILINDRO' && (
                                    <div><strong>Ø:</strong> {muestra.diametro_cilindro} cm</div>
                                  )}
                                  {muestra.tipo_muestra === 'CUBO' && (
                                    <div><strong>Lado:</strong> {muestra.cube_medida} cm</div>
                                  )}
                                  {muestra.tipo_muestra === 'VIGA' && (
                                    <div><strong>Dim:</strong> {muestra.beam_width}×{muestra.beam_height}×{muestra.beam_span}</div>
                                  )}
                                  <div><strong>Masa:</strong> {muestra.masa_real} kg/m³</div>
                                </div>
                              </div>

                              {/* Programación de ensayo */}
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Ensayo</div>
                                <div className="text-sm">
                                  <div className={`font-medium ${
                                    isToday ? 'text-green-700' : 
                                    isPast ? 'text-red-700' : 
                                    'text-gray-700'
                                  }`}>
                                    <strong>Fecha:</strong> {muestra.fecha_ensayo}
                                  </div>
                                  <div><strong>Hora:</strong> {muestra.hora_ensayo}</div>
                                  <div><strong>Edad:</strong> {muestra.cantidad_tiempo} {muestra.unidad_tiempo.toLowerCase()}</div>
                                </div>
                                {isCompleted && (
                                  <Badge className="bg-blue-100 text-blue-700 text-xs">
                                    ✓ Ensayado
                                  </Badge>
                                )}
                                {!isCompleted && isToday && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                    ¡Hoy!
                                  </Badge>
                                )}
                                {!isCompleted && isPast && (
                                  <Badge className="bg-red-100 text-red-700 text-xs">
                                    Vencido
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Mostrar resultados si están disponibles */}
                            {isCompleted && muestra.ensayos && muestra.ensayos.length > 0 && (
                              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                                <h5 className="font-medium text-blue-800 mb-2">Resultados del Ensayo</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-blue-600">Carga:</span>
                                    <div className="font-medium">{muestra.ensayos[0].carga} kg</div>
                                  </div>
                                  <div>
                                    <span className="text-blue-600">Resistencia:</span>
                                    <div className="font-medium">{muestra.ensayos[0].resistencia_calculada} kg/cm²</div>
                                  </div>
                                  <div>
                                    <span className="text-blue-600">Fecha Real:</span>
                                    <div className="font-medium">{muestra.ensayos[0].fecha_ensayo}</div>
                                  </div>
                                  <div>
                                    <span className="text-blue-600">Estado:</span>
                                    <div className="font-medium text-green-600">Completado</div>
                                  </div>
                                </div>
                                {muestra.ensayos[0].observaciones && (
                                  <div className="mt-2">
                                    <span className="text-blue-600 text-sm">Observaciones:</span>
                                    <p className="text-sm text-gray-700 mt-1">{muestra.ensayos[0].observaciones}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex gap-2 mt-4">
                              {!isCompleted ? (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    window.open(`/quality/ensayos/new?muestra_matrix_id=${muestra.id}`, '_blank');
                                  }}
                                  className={isToday ? 'border-green-600 text-green-700 hover:bg-green-50' : ''}
                                >
                                  <Calculator className="h-4 w-4 mr-1" />
                                  {isToday ? '¡Realizar Hoy!' : 'Realizar Ensayo'}
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    window.open(`/quality/ensayos/${muestra.ensayos[0].id}`, '_blank');
                                  }}
                                  className="border-blue-600 text-blue-700 hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Resultado
                                </Button>
                              )}
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  window.location.href = `/quality/curvas-abrams/${muestra.diseño?.matrix?.id}`;
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Matriz
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No hay ensayos programados</p>
                    <p className="text-sm">Crea matrices y agrega datos de elaboración para generar ensayos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
