'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, Plus, Calculator, Eye, Download, AlertTriangle, Beaker, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import DatosElaboracionForm from '@/components/quality/DatosElaboracionForm';
import CalendarioEnsayos from '@/components/quality/CalendarioEnsayos';

interface MatrixDetails {
  id: string;
  no_matrix: string;
  created_at: string;
  plant: {
    id: string;
    code: string;
    name: string;
  };
  diseños: Array<{
    id: string;
    no_muestra: string;
    nombre_muestra: string;
    origen_cemento: string;
    tipo_cemento: string;
    kg_cemento: number;
    consumo_agua: number;
    origen_ag: string;
    tamaño_ag: string;
    condicion_aditivo: string;
    rev_diseño: number;
    masaunitaria_diseño: number;
  }>;
}

export default function MatrixDesignsPage() {
  const { profile } = useAuthBridge();
  const params = useParams();
  const router = useRouter();
  const matrixId = params.id as string;

  // Estados
  const [matrixDetails, setMatrixDetails] = useState<MatrixDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showElaborationForm, setShowElaborationForm] = useState(false);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [pendingTests, setPendingTests] = useState<any[]>([]);
  const [refreshData, setRefreshData] = useState(0);

  // Cargar detalles de la matriz
  useEffect(() => {
    const loadMatrixDetails = async () => {
      if (!matrixId) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('id_matrix')
          .select(`
            id,
            no_matrix,
            created_at,
            plant:plant_id (
              id,
              code,
              name
            ),
            diseños:diseños_matrix (
              id,
              no_muestra,
              nombre_muestra,
              origen_cemento,
              tipo_cemento,
              kg_cemento,
              consumo_agua,
              origen_ag,
              tamaño_ag,
              condicion_aditivo,
              rev_diseño,
              masaunitaria_diseño
            )
          `)
          .eq('id', matrixId)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setMatrixDetails(data as MatrixDetails);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar detalles');
      } finally {
        setLoading(false);
      }
    };

    loadMatrixDetails();
  }, [matrixId, refreshData]);

  // Cargar muestras pendientes de ensayo
  useEffect(() => {
    const loadPendingTests = async () => {
      if (!matrixId) return;

      try {
        // Primero obtener los diseños de esta matriz
        const { data: diseñosData } = await supabase
          .from('diseños_matrix')
          .select('id')
          .eq('matrix_id', matrixId);
        
        if (!diseñosData || diseñosData.length === 0) {
          setPendingTests([]);
          return;
        }
        
        const diseñoIds = diseñosData.map(d => d.id);
        
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
              nombre_muestra
            )
          `)
          .in('diseño_id', diseñoIds)
          .order('fecha_ensayo', { ascending: true });

        if (muestrasData) {
          // Filtrar solo muestras que aún no han sido ensayadas
          // Por ahora mostraremos todas, pero se puede filtrar por estado
          setPendingTests(muestrasData);
        }
      } catch (err) {
        console.error('Error loading pending tests:', err);
      }
    };

    loadPendingTests();
  }, [matrixId, refreshData]);

  // Función para exportar matriz a CSV
  const exportarMatriz = () => {
    if (!matrixDetails) return;

    const csvContent = [
      'No_Matriz,Planta,No_Muestra,Nombre_Muestra,Origen_Cemento,Tipo_Cemento,Kg_Cemento,Consumo_Agua,Relacion_AC,Origen_Agregados,Tamaño_Agregado,Condicion_Aditivo,Rev_Diseño,Masa_Unitaria',
      ...matrixDetails.diseños.map(d => 
        `${matrixDetails.no_matrix},${matrixDetails.plant.code},${d.no_muestra},"${d.nombre_muestra}","${d.origen_cemento}",${d.tipo_cemento},${d.kg_cemento},${d.consumo_agua},${(d.consumo_agua / d.kg_cemento).toFixed(3)},"${d.origen_ag}",${d.tamaño_ag},"${d.condicion_aditivo}",${d.rev_diseño},${d.masaunitaria_diseño}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matriz_${matrixDetails.no_matrix}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            No tienes permiso para acceder a los diseños de matrices.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-pulse" />
          <p>Cargando detalles de la matriz...</p>
        </div>
      </div>
    );
  }

  if (error || !matrixDetails) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/quality/curvas-abrams')}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Curvas de Abrams
        </Button>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'No se pudieron cargar los detalles de la matriz'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header con navegación */}
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/quality/curvas-abrams')}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Curvas de Abrams
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">
              Diseños de Matriz: {matrixDetails.no_matrix}
            </h1>
            <p className="text-gray-500">
              {matrixDetails.plant.code} - {matrixDetails.plant.name}
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportarMatriz}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Matriz
            </Button>
            <Button 
              onClick={() => setShowElaborationForm(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              + Datos de elaboración
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen de la matriz */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-sm text-blue-600 font-medium">Total Diseños</div>
            <div className="text-2xl font-bold text-blue-900">
              {matrixDetails.diseños.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-sm text-green-600 font-medium">a/c Promedio</div>
            <div className="text-2xl font-bold text-green-900">
              {matrixDetails.diseños.length > 0 
                ? (matrixDetails.diseños.reduce((sum, d) => sum + (d.consumo_agua / d.kg_cemento), 0) / matrixDetails.diseños.length).toFixed(3)
                : '0.000'
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="text-sm text-amber-600 font-medium">Cemento Promedio</div>
            <div className="text-2xl font-bold text-amber-900">
              {matrixDetails.diseños.length > 0 
                ? Math.round(matrixDetails.diseños.reduce((sum, d) => sum + d.kg_cemento, 0) / matrixDetails.diseños.length)
                : 0
              }
            </div>
            <div className="text-xs text-amber-600">kg/m³</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="text-sm text-purple-600 font-medium">Fecha Creación</div>
            <div className="text-lg font-bold text-purple-900">
              {new Date(matrixDetails.created_at).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diseños de la matriz */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Diseños de Mezcla
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matrixDetails.diseños.length > 0 ? (
            <div className="space-y-4">
              {matrixDetails.diseños.map((diseño) => (
                <Card key={diseño.id} className="bg-gray-50 border border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-blue-700">
                          {diseño.no_muestra}
                        </Badge>
                        <h4 className="font-semibold text-gray-900 text-lg">
                          {diseño.nombre_muestra}
                        </h4>
                        <Badge className="bg-blue-100 text-blue-700">
                          a/c = {(diseño.consumo_agua / diseño.kg_cemento).toFixed(3)}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDesignId(diseño.id);
                          setShowElaborationForm(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Datos de elaboración
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Información del cemento */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Cemento</h5>
                        <div className="text-sm space-y-1">
                          <div><strong>Tipo:</strong> {diseño.tipo_cemento || 'No especificado'}</div>
                          <div><strong>Origen:</strong> {diseño.origen_cemento || 'No especificado'}</div>
                          <div><strong>Cantidad:</strong> {diseño.kg_cemento} kg/m³</div>
                        </div>
                      </div>

                      {/* Información del agua */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Agua</h5>
                        <div className="text-sm space-y-1">
                          <div><strong>Consumo:</strong> {diseño.consumo_agua} L/m³</div>
                          <div><strong>Relación a/c:</strong> {(diseño.consumo_agua / diseño.kg_cemento).toFixed(3)}</div>
                          <div><strong>Eficiencia:</strong> {(250 / diseño.kg_cemento).toFixed(2)} kg/cm²/kg</div>
                        </div>
                      </div>

                      {/* Información de agregados */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Agregados</h5>
                        <div className="text-sm space-y-1">
                          <div><strong>Origen:</strong> {diseño.origen_ag || 'No especificado'}</div>
                          <div><strong>Tamaño:</strong> {diseño.tamaño_ag || 'No especificado'}</div>
                        </div>
                      </div>

                      {/* Propiedades del concreto */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Propiedades</h5>
                        <div className="text-sm space-y-1">
                          <div><strong>Revenimiento:</strong> {diseño.rev_diseño} cm</div>
                          <div><strong>Masa Unitaria:</strong> {diseño.masaunitaria_diseño} kg/m³</div>
                        </div>
                      </div>
                    </div>

                    {/* Aditivos */}
                    {diseño.condicion_aditivo && (
                      <div className="mt-4 p-3 bg-white rounded-lg border">
                        <h5 className="font-medium text-gray-700 mb-2 text-sm uppercase tracking-wide">Condición de Aditivos</h5>
                        <p className="text-sm text-gray-600">{diseño.condicion_aditivo}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Beaker className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No hay diseños registrados</p>
              <p className="text-sm">Esta matriz no tiene diseños de mezcla asociados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sección de Muestras Pendientes de Ensayo */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Muestras Pendientes de Ensayo
          </CardTitle>
          <p className="text-sm text-gray-500">
            Muestras programadas para ensayo de resistencia
          </p>
        </CardHeader>
        <CardContent>
          {pendingTests.length > 0 ? (
            <div className="space-y-4">
              {/* Resumen de muestras por fecha */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="text-sm text-blue-600 font-medium">Total Muestras</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {pendingTests.length}
                    </div>
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
                  </CardContent>
                </Card>
                
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="text-sm text-purple-600 font-medium">Tipos</div>
                    <div className="text-sm font-bold text-purple-900">
                      {Array.from(new Set(pendingTests.map(m => m.tipo_muestra))).join(', ')}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de muestras pendientes */}
              <div className="space-y-3">
                {pendingTests.map((muestra) => {
                  const isToday = muestra.fecha_ensayo === new Date().toISOString().split('T')[0];
                  const isPast = new Date(muestra.fecha_ensayo) < new Date();
                  
                  return (
                    <Card 
                      key={muestra.id} 
                      className={`border ${
                        isToday ? 'border-green-300 bg-green-50' : 
                        isPast ? 'border-red-300 bg-red-50' : 
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                              <div><strong>Hora:</strong> {muestra.hora_elaboracion}</div>
                              <div><strong>Rev. Real:</strong> {muestra.rev_real} cm</div>
                            </div>
                          </div>

                          {/* Dimensiones de la muestra */}
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Dimensiones</div>
                            <div className="text-sm">
                              {muestra.tipo_muestra === 'CILINDRO' && (
                                <div><strong>Diámetro:</strong> {muestra.diametro_cilindro} cm</div>
                              )}
                              {muestra.tipo_muestra === 'CUBO' && (
                                <div><strong>Lado:</strong> {muestra.cube_medida} cm</div>
                              )}
                              {muestra.tipo_muestra === 'VIGA' && (
                                <div><strong>Dimensiones:</strong> {muestra.beam_width}×{muestra.beam_height}×{muestra.beam_span} cm</div>
                              )}
                              <div><strong>Masa:</strong> {muestra.masa_real} kg/m³</div>
                            </div>
                          </div>

                          {/* Programación de ensayo */}
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Ensayo Programado</div>
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
                            {isToday && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                ¡Ensayo Hoy!
                              </Badge>
                            )}
                            {isPast && (
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                Vencido
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-2 mt-4">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              // Navegar al módulo de ensayos con esta muestra
                              window.open(`/quality/ensayos/new?muestra_matrix_id=${muestra.id}`, '_blank');
                            }}
                          >
                            <Calculator className="h-4 w-4 mr-1" />
                            Realizar Ensayo
                          </Button>
                          
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              // Editar programación de ensayo
                              alert('Funcionalidad de edición en desarrollo');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No hay muestras pendientes de ensayo</p>
              <p className="text-sm">Agrega datos de elaboración a los diseños para generar muestras</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendario de Ensayos */}
      {pendingTests.length > 0 && (
        <CalendarioEnsayos 
          muestras={pendingTests}
          onMuestraClick={(muestra) => {
            // Mostrar detalles de la muestra seleccionada
            console.log('Muestra seleccionada:', muestra);
          }}
        />
      )}

      {/* Modal para datos de elaboración */}
      {showElaborationForm && selectedDesignId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <DatosElaboracionForm
                diseñoId={selectedDesignId}
                diseñoNombre={matrixDetails?.diseños.find(d => d.id === selectedDesignId)?.nombre_muestra || 'Diseño'}
                plantId={matrixDetails?.plant?.id || ''}
                onClose={() => {
                  setShowElaborationForm(false);
                  setSelectedDesignId(null);
                }}
                onSuccess={() => {
                  // Refrescar datos para mostrar las nuevas muestras
                  setRefreshData(prev => prev + 1);
                  setShowElaborationForm(false);
                  setSelectedDesignId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
