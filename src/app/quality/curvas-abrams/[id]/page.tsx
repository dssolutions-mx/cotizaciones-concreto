'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Plus, AlertTriangle, Beaker, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import DatosElaboracionForm from '@/components/quality/DatosElaboracionForm';

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

  const [refreshData, setRefreshData] = useState(0);
  const [expandedDesigns, setExpandedDesigns] = useState<Set<string>>(new Set());
  const [designSamples, setDesignSamples] = useState<{[key: string]: any[]}>({});
  const [selectedSample, setSelectedSample] = useState<any | null>(null);
  const [showLoadInput, setShowLoadInput] = useState(false);
  const [loadValue, setLoadValue] = useState<string>('');

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

  // Cargar muestras por diseño
  useEffect(() => {
    const loadDesignSamples = async () => {
      if (!matrixDetails?.diseños) return;

      try {
        const samplesData: {[key: string]: any[]} = {};
        
        for (const diseño of matrixDetails.diseños) {
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
              ensayos:ensayos_matrix (
                id,
                fecha_ensayo,
                carga,
                resistencia_calculada,
                observaciones
              )
            `)
            .eq('diseño_id', diseño.id)
            .order('fecha_elaboracion', { ascending: false });

          if (muestrasData) {
            samplesData[diseño.id] = muestrasData;
          }
        }
        
        setDesignSamples(samplesData);
      } catch (err) {
        console.error('Error loading design samples:', err);
      }
    };

    loadDesignSamples();
  }, [matrixDetails, refreshData]);



  // Función para alternar la expansión de un diseño
  const toggleDesignExpansion = (designId: string) => {
    setExpandedDesigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(designId)) {
        newSet.delete(designId);
      } else {
        newSet.add(designId);
      }
      return newSet;
    });
  };

  // Función para seleccionar muestra y mostrar input de carga
  const handleSampleSelect = (sample: any) => {
    setSelectedSample(sample);
    setLoadValue(sample.ensayos?.[0]?.carga?.toString() || '');
    setShowLoadInput(true);
  };

  // Función para guardar la carga del ensayo
  const handleSaveLoad = async () => {
    if (!selectedSample || !loadValue) return;

    try {
      setLoading(true);
      
      // Verificar si ya existe un ensayo para esta muestra
      if (selectedSample.ensayos && selectedSample.ensayos.length > 0) {
        // Actualizar ensayo existente
        const { error } = await supabase
          .from('ensayos_matrix')
          .update({
            carga: parseFloat(loadValue),
            fecha_ensayo: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSample.ensayos[0].id);

        if (error) throw error;
      } else {
        // Crear nuevo ensayo
        const { error } = await supabase
          .from('ensayos_matrix')
          .insert({
            muestra_matrix_id: selectedSample.id,
            carga: parseFloat(loadValue),
            fecha_ensayo: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      // Refrescar datos
      setRefreshData(prev => prev + 1);
      setShowLoadInput(false);
      setSelectedSample(null);
      setLoadValue('');
      
    } catch (err) {
      console.error('Error saving load:', err);
      setError('Error al guardar la carga del ensayo');
    } finally {
      setLoading(false);
    }
  };

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
          

        </div>
      </div>

      {/* Resumen de la matriz */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-sm text-blue-600 font-medium">Total Diseños</div>
            <div className="text-2xl font-bold text-blue-900">
              {matrixDetails.diseños.length}
            </div>
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
            <div className="space-y-6">
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
                        
                        {/* Indicador de estado de muestras */}
                        {designSamples[diseño.id] && designSamples[diseño.id].length > 0 ? (
                          <Badge className="bg-green-100 text-green-700">
                            {designSamples[diseño.id].length} muestra{designSamples[diseño.id].length !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Sin muestras
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Solo mostrar botón de datos de elaboración si no hay muestras registradas */}
                        {(!designSamples[diseño.id] || designSamples[diseño.id].length === 0) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDesignId(diseño.id);
                              setShowElaborationForm(true);
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Datos de elaboración
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDesignExpansion(diseño.id)}
                          className="flex items-center gap-2"
                        >
                          {expandedDesigns.has(diseño.id) ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Ocultar información
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              {designSamples[diseño.id] && designSamples[diseño.id].length > 0 
                                ? 'Ver características y muestras'
                                : 'Ver características'
                              }
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {/* Layout dividido: Características y Muestras (expandible) */}
                  {expandedDesigns.has(diseño.id) && (
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Lado izquierdo: Características del diseño */}
                        <div className="space-y-4">
                          <h5 className="font-semibold text-gray-800 border-b pb-2">Características de la Mezcla</h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Información del cemento */}
                            <div className="space-y-2">
                              <h6 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Cemento</h6>
                              <div className="text-sm space-y-1">
                                <div><strong>Tipo:</strong> {diseño.tipo_cemento || 'No especificado'}</div>
                                <div><strong>Origen:</strong> {diseño.origen_cemento || 'No especificado'}</div>
                                <div><strong>Cantidad:</strong> {diseño.kg_cemento} kg/m³</div>
                              </div>
                            </div>

                            {/* Información del agua */}
                            <div className="space-y-2">
                              <h6 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Agua</h6>
                              <div className="text-sm space-y-1">
                                <div><strong>Consumo:</strong> {diseño.consumo_agua} L/m³</div>
                                <div><strong>Relación a/c:</strong> {(diseño.consumo_agua / diseño.kg_cemento).toFixed(3)}</div>
                                <div><strong>Eficiencia:</strong> {(250 / diseño.kg_cemento).toFixed(2)} kg/cm²/kg</div>
                              </div>
                            </div>

                            {/* Información de agregados */}
                            <div className="space-y-2">
                              <h6 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Agregados</h6>
                              <div className="text-sm space-y-1">
                                <div><strong>Origen:</strong> {diseño.origen_ag || 'No especificado'}</div>
                                <div><strong>Tamaño:</strong> {diseño.tamaño_ag || 'No especificado'}</div>
                              </div>
                            </div>

                            {/* Propiedades del concreto */}
                            <div className="space-y-2">
                              <h6 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Propiedades</h6>
                              <div className="text-sm space-y-1">
                                <div><strong>Revenimiento:</strong> {diseño.rev_diseño} cm</div>
                                <div><strong>Masa Unitaria:</strong> {diseño.masaunitaria_diseño} kg/m³</div>
                              </div>
                            </div>
                          </div>

                          {/* Aditivos */}
                          {diseño.condicion_aditivo && (
                            <div className="p-3 bg-white rounded-lg border">
                              <h6 className="font-medium text-gray-700 mb-2 text-sm uppercase tracking-wide">Condición de Aditivos</h6>
                              <p className="text-sm text-gray-600">{diseño.condicion_aditivo}</p>
                            </div>
                          )}
                        </div>

                        {/* Lado derecho: Muestras del diseño */}
                        <div className="space-y-4">
                          <h5 className="font-semibold text-gray-800 border-b pb-2">Muestras Registradas</h5>
                          
                          {designSamples[diseño.id] && designSamples[diseño.id].length > 0 ? (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {designSamples[diseño.id].map((muestra) => {
                                const hasTest = muestra.ensayos && muestra.ensayos.length > 0;
                                const isToday = muestra.fecha_ensayo === new Date().toISOString().split('T')[0];
                                const isPast = new Date(muestra.fecha_ensayo) < new Date();
                                
                                return (
                                  <Card 
                                    key={muestra.id} 
                                    className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                                      hasTest ? 'bg-blue-50 border-blue-200' :
                                      isToday ? 'bg-green-50 border-green-200' : 
                                      isPast ? 'bg-red-50 border-red-200' : 
                                      'bg-white border-gray-200'
                                    }`}
                                    onClick={() => handleSampleSelect(muestra)}
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-xs">
                                          {muestra.tipo_muestra}
                                        </Badge>
                                        {hasTest && (
                                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                                            ✓ Ensayado
                                          </Badge>
                                        )}
                                        {!hasTest && isToday && (
                                          <Badge className="bg-green-100 text-green-700 text-xs">
                                            ¡Hoy!
                                          </Badge>
                                        )}
                                        {!hasTest && isPast && (
                                          <Badge className="bg-red-100 text-red-700 text-xs">
                                            Vencido
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      <div className="text-sm space-y-1">
                                        <div><strong>Elaboración:</strong> {muestra.fecha_elaboracion}</div>
                                        <div><strong>Ensayo:</strong> {muestra.fecha_ensayo}</div>
                                        <div><strong>Rev. Real:</strong> {muestra.rev_real} cm</div>
                                        {hasTest && (
                                          <div className="text-blue-600">
                                            <strong>Carga:</strong> {muestra.ensayos[0].carga} kg
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center text-gray-500 py-8">
                              <Calculator className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              <p className="text-sm">No hay muestras registradas</p>
                              <p className="text-xs">Agrega datos de elaboración para crear muestras</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
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





      {/* Modal para ingresar carga del ensayo */}
      <Dialog open={showLoadInput} onOpenChange={setShowLoadInput}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ingresar Carga del Ensayo</DialogTitle>
          </DialogHeader>
          
          {selectedSample && (
            <div className="space-y-4">
              {/* Información de la muestra */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Información de la Muestra</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Tipo:</strong> {selectedSample.tipo_muestra}</div>
                  <div><strong>Elaboración:</strong> {selectedSample.fecha_elaboracion}</div>
                  <div><strong>Ensayo programado:</strong> {selectedSample.fecha_ensayo}</div>
                  <div><strong>Rev. Real:</strong> {selectedSample.rev_real} cm</div>
                  {selectedSample.tipo_muestra === 'CILINDRO' && (
                    <div><strong>Diámetro:</strong> {selectedSample.diametro_cilindro} cm</div>
                  )}
                  {selectedSample.tipo_muestra === 'CUBO' && (
                    <div><strong>Lado:</strong> {selectedSample.cube_medida} cm</div>
                  )}
                </div>
              </div>

              {/* Input para la carga */}
              <div className="space-y-2">
                <Label htmlFor="load-input">Carga del Ensayo (kg)</Label>
                <Input
                  id="load-input"
                  type="number"
                  value={loadValue}
                  onChange={(e) => setLoadValue(e.target.value)}
                  placeholder="Ingresa la carga en kg"
                  step="0.1"
                  min="0"
                />
              </div>

              {/* Información adicional si ya tiene ensayo */}
              {selectedSample.ensayos && selectedSample.ensayos.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2 text-blue-800">Ensayo Existente</h4>
                  <div className="text-sm text-blue-700">
                    <div><strong>Carga actual:</strong> {selectedSample.ensayos[0].carga} kg</div>
                    <div><strong>Fecha ensayo:</strong> {selectedSample.ensayos[0].fecha_ensayo}</div>
                    {selectedSample.ensayos[0].resistencia_calculada && (
                      <div><strong>Resistencia:</strong> {selectedSample.ensayos[0].resistencia_calculada} kg/cm²</div>
                    )}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    * Al guardar se actualizará el ensayo existente
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowLoadInput(false);
                setSelectedSample(null);
                setLoadValue('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveLoad}
              disabled={!loadValue || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Guardando...' : 'Guardar Carga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
