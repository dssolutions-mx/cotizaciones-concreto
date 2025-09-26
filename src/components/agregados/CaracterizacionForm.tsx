'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Scale, 
  Save, 
  ArrowLeft, 
  Calculator,
  TestTube,
  BarChart3,
  AlertCircle,
  CheckCircle2 
} from 'lucide-react';
import { caracterizacionService } from '@/services/caracterizacionService';
import { toast } from 'sonner';
import type { AltaEstudio } from '@/types/agregados';

interface CaracterizacionFormProps {
  estudioId: string;
  estudio?: AltaEstudio;
  tipoFormulario: 'masa-especifica' | 'granulometria' | 'absorcion' | 'masa-volumetrica';
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface MasaEspecificaData {
  // Datos de entrada
  masa_muestra_sss: number | null; // A - Masa de la muestra S.S.S (kg)
  masa_canastilla_muestra_agua: number | null; // B - Masa canastilla + muestra en agua (kg)
  masa_canastilla_agua: number | null; // C - Masa canastilla en agua (kg)
  volumen_desplazado: number | null; // V - Volumen desplazado (dm³)
  masa_muestra_seca_lavada: number | null; // Ms - Masa muestra seca (kg)
  
  // Datos calculados
  masa_especifica_sss: number | null; // Me s.s.s = A - (B - C)
  masa_especifica: number | null; // Me s = A / V
  masa_especifica_seca: number | null; // Me = Ms / (Ms + B + C)
}

interface GranulometriaData {
  peso_total_muestra: number | null;
  mallas: Array<{
    no_malla: string;
    retenido: number | null;
    porc_retenido: number | null;
    porc_acumulado: number | null;
    porc_pasa: number | null;
    orden_malla: number;
  }>;
}

// Mallas estándar
const MALLAS_ESTANDAR = [
  { no_malla: '3"', orden: 1 },
  { no_malla: '2 1/2"', orden: 2 },
  { no_malla: '2"', orden: 3 },
  { no_malla: '1 1/2"', orden: 4 },
  { no_malla: '1"', orden: 5 },
  { no_malla: '3/4"', orden: 6 },
  { no_malla: '1/2"', orden: 7 },
  { no_malla: '3/8"', orden: 8 },
  { no_malla: '1/4"', orden: 9 },
  { no_malla: 'No. 4', orden: 10 },
  { no_malla: 'No. 8', orden: 11 },
  { no_malla: 'No. 16', orden: 12 },
  { no_malla: 'No. 30', orden: 13 },
  { no_malla: 'No. 50', orden: 14 },
  { no_malla: 'No. 100', orden: 15 },
  { no_malla: 'No. 200', orden: 16 },
  { no_malla: 'Fondo', orden: 17 }
];

export default function CaracterizacionForm({
  estudioId,
  estudio,
  tipoFormulario,
  onSuccess,
  onCancel
}: CaracterizacionFormProps) {
  const router = useRouter();
  // Using toast from sonner import
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para cada tipo de formulario
  const [masaEspecificaData, setMasaEspecificaData] = useState<MasaEspecificaData>({
    masa_muestra_sss: null,
    masa_canastilla_muestra_agua: null,
    masa_canastilla_agua: null,
    volumen_desplazado: null,
    masa_muestra_seca_lavada: null,
    masa_especifica_sss: null,
    masa_especifica: null,
    masa_especifica_seca: null
  });

  const [granulometriaData, setGranulometriaData] = useState<GranulometriaData>({
    peso_total_muestra: null,
    mallas: MALLAS_ESTANDAR.map(malla => ({
      ...malla,
      retenido: null,
      porc_retenido: null,
      porc_acumulado: null,
      porc_pasa: null
    }))
  });

  const [observaciones, setObservaciones] = useState('');

  // Cargar datos existentes al inicializar
  useEffect(() => {
    const cargarDatosExistentes = async () => {
      try {
        setIsLoadingData(true);
        
        if (tipoFormulario === 'masa-especifica') {
          const datos = await caracterizacionService.getCaracterizacion(estudioId);
          if (datos) {
            setMasaEspecificaData({
              masa_muestra_sss: datos.masa_muestra_sss || null,
              masa_canastilla_muestra_agua: datos.masa_canastilla_muestra_agua || null,
              masa_canastilla_agua: datos.masa_canastilla_agua || null,
              volumen_desplazado: datos.volumen_desplazado || null,
              masa_muestra_seca_lavada: datos.masa_muestra_seca_lavada || null,
              masa_especifica_sss: datos.masa_especifica_sss || null,
              masa_especifica: datos.masa_especifica || null,
              masa_especifica_seca: datos.masa_especifica_seca || null
            });
          }
        } else if (tipoFormulario === 'granulometria') {
          const datos = await caracterizacionService.getGranulometria(estudioId);
          if (datos && datos.length > 0) {
            const mallasConDatos = MALLAS_ESTANDAR.map(mallaEstandar => {
              const datoExistente = datos.find(d => d.no_malla === mallaEstandar.no_malla);
              return {
                ...mallaEstandar,
                retenido: datoExistente?.retenido || null,
                porc_retenido: datoExistente?.porc_retenido || null,
                porc_acumulado: datoExistente?.porc_acumulado || null,
                porc_pasa: datoExistente?.porc_pasa || null
              };
            });
            
            setGranulometriaData({
              peso_total_muestra: datos[0]?.peso_total_muestra || null,
              mallas: mallasConDatos
            });
          }
        }
      } catch (error) {
        console.error('Error al cargar datos existentes:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    cargarDatosExistentes();
  }, [estudioId, tipoFormulario]);

  // Cálculos automáticos para masa específica
  useEffect(() => {
    if (tipoFormulario === 'masa-especifica') {
      const { masa_muestra_sss, masa_canastilla_muestra_agua, masa_canastilla_agua, volumen_desplazado, masa_muestra_seca_lavada } = masaEspecificaData;
      
      let nuevosCalculos = { ...masaEspecificaData };
      
      // Me s.s.s = A - (B - C)
      if (masa_muestra_sss && masa_canastilla_muestra_agua && masa_canastilla_agua) {
        nuevosCalculos.masa_especifica_sss = masa_muestra_sss - (masa_canastilla_muestra_agua - masa_canastilla_agua);
      }
      
      // Me s = A / V
      if (masa_muestra_sss && volumen_desplazado) {
        nuevosCalculos.masa_especifica = masa_muestra_sss / volumen_desplazado;
      }
      
      // Me = Ms / (Ms + B + C)
      if (masa_muestra_seca_lavada && masa_canastilla_muestra_agua && masa_canastilla_agua) {
        const denominador = masa_muestra_seca_lavada + masa_canastilla_muestra_agua + masa_canastilla_agua;
        if (denominador !== 0) {
          nuevosCalculos.masa_especifica_seca = masa_muestra_seca_lavada / denominador;
        }
      }
      
      setMasaEspecificaData(nuevosCalculos);
    }
  }, [
    masaEspecificaData.masa_muestra_sss,
    masaEspecificaData.masa_canastilla_muestra_agua,
    masaEspecificaData.masa_canastilla_agua,
    masaEspecificaData.volumen_desplazado,
    masaEspecificaData.masa_muestra_seca_lavada
  ]);

  // Cálculos automáticos para granulometría
  const calcularGranulometria = () => {
    if (!granulometriaData.peso_total_muestra || granulometriaData.peso_total_muestra === 0) return;

    const mallasActualizadas = [...granulometriaData.mallas];
    let acumulado = 0;

    mallasActualizadas.forEach((malla) => {
      if (malla.retenido !== null) {
        // Porcentaje retenido
        malla.porc_retenido = (malla.retenido / granulometriaData.peso_total_muestra!) * 100;
        
        // Porcentaje acumulado
        acumulado += malla.porc_retenido;
        malla.porc_acumulado = acumulado;
        
        // Porcentaje que pasa
        malla.porc_pasa = 100 - acumulado;
      }
    });

    setGranulometriaData(prev => ({
      ...prev,
      mallas: mallasActualizadas
    }));
  };

  const actualizarRetenido = (index: number, valor: string) => {
    const valorNumerico = valor === '' ? null : parseFloat(valor);
    const mallasActualizadas = [...granulometriaData.mallas];
    mallasActualizadas[index].retenido = valorNumerico;
    
    setGranulometriaData(prev => ({
      ...prev,
      mallas: mallasActualizadas
    }));
    
    // Recalcular después de un breve delay
    setTimeout(calcularGranulometria, 100);
  };

  const validarFormulario = (): boolean => {
    if (tipoFormulario === 'masa-especifica') {
      const { masa_muestra_sss, masa_canastilla_muestra_agua, masa_canastilla_agua, volumen_desplazado, masa_muestra_seca_lavada } = masaEspecificaData;
      
      if (!masa_muestra_sss || !masa_canastilla_muestra_agua || !masa_canastilla_agua || !volumen_desplazado || !masa_muestra_seca_lavada) {
        setError('Todos los campos son requeridos para el cálculo de masa específica');
        return false;
      }
    } else if (tipoFormulario === 'granulometria') {
      if (!granulometriaData.peso_total_muestra) {
        setError('El peso total de la muestra es requerido');
        return false;
      }
      
      const hayDatos = granulometriaData.mallas.some(malla => malla.retenido !== null && malla.retenido >= 0);
      if (!hayDatos) {
        setError('Debe ingresar al menos un valor de retenido');
        return false;
      }
    }
    
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validarFormulario()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (tipoFormulario === 'masa-especifica') {
        await caracterizacionService.guardarCaracterizacion(estudioId, masaEspecificaData);
        
        toast.success("Los datos de masa específica han sido guardados correctamente");
      } else if (tipoFormulario === 'granulometria') {
        // Filtrar solo las mallas que tienen datos
        const mallasConDatos = granulometriaData.mallas.filter(malla => 
          malla.retenido !== null && malla.retenido >= 0
        );
        
        await caracterizacionService.guardarGranulometria(estudioId, mallasConDatos);
        
        toast.success("Los datos de granulometría han sido guardados correctamente");
      }
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.back();
      }
      
    } catch (error) {
      console.error('Error al guardar:', error);
      setError(`Error al guardar los datos: ${(error as Error).message}`);
      
      toast.error("No se pudieron guardar los datos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const getTituloFormulario = () => {
    switch (tipoFormulario) {
      case 'masa-especifica':
        return 'Masa Específica (s.s.s. y seca)';
      case 'granulometria':
        return 'Análisis Granulométrico';
      case 'absorcion':
        return 'Absorción (%)';
      case 'masa-volumetrica':
        return 'Masa Volumétrica (suelta y compactada)';
      default:
        return 'Caracterización de Material';
    }
  };

  const getIconoFormulario = () => {
    switch (tipoFormulario) {
      case 'masa-especifica':
        return <Scale className="h-5 w-5" />;
      case 'granulometria':
        return <BarChart3 className="h-5 w-5" />;
      case 'absorcion':
      case 'masa-volumetrica':
        return <TestTube className="h-5 w-5" />;
      default:
        return <Calculator className="h-5 w-5" />;
    }
  };

  if (isLoadingData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Cargando datos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          {getIconoFormulario()}
          <h1 className="text-2xl font-bold text-gray-900">
            {getTituloFormulario()}
          </h1>
        </div>
        
        {estudio && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Material: <strong>{estudio.nombre_material}</strong></span>
            <Badge variant="outline">{estudio.tipo_material}</Badge>
            <span>Técnico: {estudio.tecnico}</span>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {tipoFormulario === 'masa-especifica' && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de Laboratorio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Datos de entrada */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="masa_muestra_sss">Masa de la muestra S.S.S (A) - kg *</Label>
                  <Input
                    id="masa_muestra_sss"
                    type="number"
                    step="0.001"
                    value={masaEspecificaData.masa_muestra_sss || ''}
                    onChange={(e) => setMasaEspecificaData(prev => ({
                      ...prev,
                      masa_muestra_sss: e.target.value ? parseFloat(e.target.value) : null
                    }))}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="masa_canastilla_muestra_agua">Masa canastilla + muestra en agua (B) - kg *</Label>
                  <Input
                    id="masa_canastilla_muestra_agua"
                    type="number"
                    step="0.001"
                    value={masaEspecificaData.masa_canastilla_muestra_agua || ''}
                    onChange={(e) => setMasaEspecificaData(prev => ({
                      ...prev,
                      masa_canastilla_muestra_agua: e.target.value ? parseFloat(e.target.value) : null
                    }))}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="masa_canastilla_agua">Masa canastilla en agua (C) - kg *</Label>
                  <Input
                    id="masa_canastilla_agua"
                    type="number"
                    step="0.001"
                    value={masaEspecificaData.masa_canastilla_agua || ''}
                    onChange={(e) => setMasaEspecificaData(prev => ({
                      ...prev,
                      masa_canastilla_agua: e.target.value ? parseFloat(e.target.value) : null
                    }))}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="volumen_desplazado">Volumen desplazado (V) - dm³ *</Label>
                  <Input
                    id="volumen_desplazado"
                    type="number"
                    step="0.001"
                    value={masaEspecificaData.volumen_desplazado || ''}
                    onChange={(e) => setMasaEspecificaData(prev => ({
                      ...prev,
                      volumen_desplazado: e.target.value ? parseFloat(e.target.value) : null
                    }))}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="masa_muestra_seca_lavada">Masa muestra seca (Ms) - kg *</Label>
                  <Input
                    id="masa_muestra_seca_lavada"
                    type="number"
                    step="0.001"
                    value={masaEspecificaData.masa_muestra_seca_lavada || ''}
                    onChange={(e) => setMasaEspecificaData(prev => ({
                      ...prev,
                      masa_muestra_seca_lavada: e.target.value ? parseFloat(e.target.value) : null
                    }))}
                    placeholder="0.000"
                  />
                </div>
              </div>

              {/* Resultados calculados */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Resultados Calculados</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <Label className="text-sm font-medium text-blue-900">
                      Me s.s.s = A - (B - C)
                    </Label>
                    <div className="text-2xl font-bold text-blue-700">
                      {masaEspecificaData.masa_especifica_sss ? masaEspecificaData.masa_especifica_sss.toFixed(3) : '--'} kg/dm³
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <Label className="text-sm font-medium text-green-900">
                      Me s = A / V
                    </Label>
                    <div className="text-2xl font-bold text-green-700">
                      {masaEspecificaData.masa_especifica ? masaEspecificaData.masa_especifica.toFixed(3) : '--'} kg/dm³
                    </div>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <Label className="text-sm font-medium text-purple-900">
                      Me = Ms / (Ms + B + C)
                    </Label>
                    <div className="text-2xl font-bold text-purple-700">
                      {masaEspecificaData.masa_especifica_seca ? masaEspecificaData.masa_especifica_seca.toFixed(3) : '--'} kg/dm³
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {tipoFormulario === 'granulometria' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="peso_total_muestra">Peso Total de la Muestra (g) *</Label>
                    <Input
                      id="peso_total_muestra"
                      type="number"
                      step="0.1"
                      value={granulometriaData.peso_total_muestra || ''}
                      onChange={(e) => {
                        const valor = e.target.value ? parseFloat(e.target.value) : null;
                        setGranulometriaData(prev => ({
                          ...prev,
                          peso_total_muestra: valor
                        }));
                        if (valor) {
                          setTimeout(calcularGranulometria, 100);
                        }
                      }}
                      placeholder="0.0"
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-sm text-blue-600">Suma Retenidos</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {granulometriaData.mallas.reduce((suma, malla) => suma + (malla.retenido || 0), 0).toFixed(1)} g
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribución Granulométrica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">Malla</th>
                        <th className="border border-gray-200 px-4 py-2 text-center">Retenido (g)</th>
                        <th className="border border-gray-200 px-4 py-2 text-center">% Retenido</th>
                        <th className="border border-gray-200 px-4 py-2 text-center">% Acumulado</th>
                        <th className="border border-gray-200 px-4 py-2 text-center">% Que Pasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {granulometriaData.mallas.map((malla, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2 font-medium">
                            {malla.no_malla}
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <Input
                              type="number"
                              step="0.1"
                              value={malla.retenido || ''}
                              onChange={(e) => actualizarRetenido(index, e.target.value)}
                              placeholder="0.0"
                              className="w-24 text-center"
                            />
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-center">
                            {malla.porc_retenido ? malla.porc_retenido.toFixed(2) : '--'}%
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-center">
                            {malla.porc_acumulado ? malla.porc_acumulado.toFixed(2) : '--'}%
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-center">
                            {malla.porc_pasa !== null ? malla.porc_pasa.toFixed(2) : '--'}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Observaciones */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales del ensayo..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Datos
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
