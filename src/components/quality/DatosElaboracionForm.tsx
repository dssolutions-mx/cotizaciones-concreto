'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Calculator, AlertTriangle, CheckCircle, Trash2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthBridge } from '@/adapters/auth-context-bridge';

interface DatosElaboracion {
  fecha_elaboracion: string;
  hora_elaboracion: string;
  masa_real: number;
  rev_real: number;
  contenido_aire: number;
}

interface MuestraData {
  tipo_muestra: string;
  // Dimensiones específicas por tipo de muestra
  cube_medida: number;
  beam_width: number;
  beam_height: number;
  beam_span: number;
  diametro_cilindro: number;
  // Datos de ensayo
  unidad_tiempo: string;
  cantidad_tiempo: number;
  fecha_ensayo: string;
  hora_ensayo: string;
}

interface DatosElaboracionFormProps {
  diseñoId: string;
  diseñoNombre: string;
  plantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DatosElaboracionForm({ 
  diseñoId, 
  diseñoNombre, 
  plantId, 
  onClose, 
  onSuccess 
}: DatosElaboracionFormProps) {
  const { profile } = useAuthBridge();
  
  // Estados para datos de elaboración (sección 1)
  const [datosElaboracion, setDatosElaboracion] = useState<DatosElaboracion>({
    fecha_elaboracion: new Date().toISOString().split('T')[0],
    hora_elaboracion: new Date().toTimeString().slice(0, 5),
    masa_real: 0,
    rev_real: 0,
    contenido_aire: 0
  });

  // Estados para muestras (sección 2)
  const [muestras, setMuestras] = useState<MuestraData[]>([{
    tipo_muestra: '',
    cube_medida: 0,
    beam_width: 0,
    beam_height: 0,
    beam_span: 0,
    diametro_cilindro: 0,
    unidad_tiempo: 'DIAS',
    cantidad_tiempo: 28,
    fecha_ensayo: '',
    hora_ensayo: '08:00'
  }]);

  // Estados de control
  const [currentStep, setCurrentStep] = useState<'elaboracion' | 'muestras'>('elaboracion');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Función para agregar una nueva muestra
  const agregarMuestra = () => {
    setMuestras([...muestras, {
      tipo_muestra: '',
      cube_medida: 0,
      beam_width: 0,
      beam_height: 0,
      beam_span: 0,
      diametro_cilindro: 0,
      unidad_tiempo: 'DIAS',
      cantidad_tiempo: 28,
      fecha_ensayo: '',
      hora_ensayo: '08:00'
    }]);
  };

  // Función para eliminar una muestra
  const eliminarMuestra = (index: number) => {
    if (muestras.length > 1) {
      setMuestras(muestras.filter((_, i) => i !== index));
    }
  };

  // Función para actualizar una muestra específica
  const actualizarMuestra = (index: number, field: keyof MuestraData, value: any) => {
    const newMuestras = [...muestras];
    newMuestras[index] = { ...newMuestras[index], [field]: value };
    setMuestras(newMuestras);
  };

  // Función para manejar cambio de tipo de muestra con auto-llenado
  const cambiarTipoMuestra = (index: number, tipoMuestra: string) => {
    const newMuestras = [...muestras];
    const muestra = { ...newMuestras[index] };
    
    // Limpiar todas las dimensiones primero
    muestra.cube_medida = 0;
    muestra.beam_width = 0;
    muestra.beam_height = 0;
    muestra.beam_span = 0;
    muestra.diametro_cilindro = 0;
    
    // Asignar valores según tipo de muestra
    muestra.tipo_muestra = tipoMuestra;
    
    if (tipoMuestra === 'VIGA') {
      // Auto-llenar dimensiones de viga: 15 x 15 x 50
      muestra.beam_width = 15;
      muestra.beam_height = 15;
      muestra.beam_span = 50;
    } else if (tipoMuestra === 'CILINDRO') {
      // Valor por defecto para cilindro
      muestra.diametro_cilindro = 15;
    } else if (tipoMuestra === 'CUBO') {
      // Valor por defecto para cubo
      muestra.cube_medida = 15;
    }
    
    newMuestras[index] = muestra;
    setMuestras(newMuestras);
  };

  // Calcular fecha de ensayo automáticamente
  const calcularFechaEnsayo = (fechaElaboracion: string, cantidad: number, unidad: string): string => {
    if (!fechaElaboracion) return '';
    
    const fecha = new Date(fechaElaboracion);
    if (unidad === 'DIAS') {
      fecha.setDate(fecha.getDate() + cantidad);
    } else if (unidad === 'HORAS') {
      fecha.setHours(fecha.getHours() + cantidad);
    }
    
    return fecha.toISOString().split('T')[0];
  };

  // Validar datos de elaboración
  const validarElaboracion = (): boolean => {
    if (!datosElaboracion.fecha_elaboracion) {
      setError('La fecha de elaboración es requerida');
      return false;
    }
    if (!datosElaboracion.hora_elaboracion) {
      setError('La hora de elaboración es requerida');
      return false;
    }
    if (datosElaboracion.masa_real <= 0) {
      setError('La masa real debe ser mayor a 0');
      return false;
    }
    if (datosElaboracion.rev_real < 0) {
      setError('El revenimiento real no puede ser negativo');
      return false;
    }
    if (datosElaboracion.contenido_aire < 0 || datosElaboracion.contenido_aire > 10) {
      setError('El contenido de aire debe estar entre 0 y 10%');
      return false;
    }
    return true;
  };

  // Validar muestras
  const validarMuestras = (): boolean => {
    for (let i = 0; i < muestras.length; i++) {
      const muestra = muestras[i];
      if (!muestra.tipo_muestra) {
        setError(`El tipo de muestra es requerido en la muestra ${i + 1}`);
        return false;
      }
      // Validar dimensiones según tipo de muestra
      if (muestra.tipo_muestra === 'CUBO' && muestra.cube_medida <= 0) {
        setError(`La medida del cubo debe ser mayor a 0 en la muestra ${i + 1}`);
        return false;
      }
      if (muestra.tipo_muestra === 'CILINDRO' && muestra.diametro_cilindro <= 0) {
        setError(`El diámetro del cilindro debe ser mayor a 0 en la muestra ${i + 1}`);
        return false;
      }
      if (muestra.tipo_muestra === 'VIGA' && (muestra.beam_width <= 0 || muestra.beam_height <= 0 || muestra.beam_span <= 0)) {
        setError(`Las dimensiones de la viga deben ser mayores a 0 en la muestra ${i + 1}`);
        return false;
      }
      if (muestra.cantidad_tiempo <= 0) {
        setError(`La cantidad de tiempo debe ser mayor a 0 en la muestra ${i + 1}`);
        return false;
      }
      if (!muestra.fecha_ensayo) {
        setError(`La fecha de ensayo es requerida en la muestra ${i + 1}`);
        return false;
      }
    }
    return true;
  };

  // Pasar a la siguiente sección
  const continuarAMuestras = () => {
    if (validarElaboracion()) {
      setError(null);
      setCurrentStep('muestras');
      
      // Auto-calcular fechas de ensayo para las muestras existentes
      const muestrasActualizadas = muestras.map(muestra => ({
        ...muestra,
        fecha_ensayo: muestra.fecha_ensayo || calcularFechaEnsayo(
          datosElaboracion.fecha_elaboracion, 
          muestra.cantidad_tiempo, 
          muestra.unidad_tiempo
        )
      }));
      setMuestras(muestrasActualizadas);
    }
  };

  // Guardar todos los datos
  const guardarDatosElaboracion = async () => {
    if (!validarMuestras()) return;

    setLoading(true);
    setError(null);

    try {
      // Preparar datos para insertar (una fila por muestra)
      const datosParaInsertar = muestras.map(muestra => ({
        diseño_id: diseñoId,
        plant_id: plantId,
        fecha_elaboracion: datosElaboracion.fecha_elaboracion,
        hora_elaboracion: datosElaboracion.hora_elaboracion,
        masa_real: datosElaboracion.masa_real,
        rev_real: datosElaboracion.rev_real,
        contenido_aire: datosElaboracion.contenido_aire,
        tipo_muestra: muestra.tipo_muestra,
        cube_medida: muestra.tipo_muestra === 'CUBO' ? muestra.cube_medida : null,
        beam_width: muestra.tipo_muestra === 'VIGA' ? muestra.beam_width : null,
        beam_height: muestra.tipo_muestra === 'VIGA' ? muestra.beam_height : null,
        beam_span: muestra.tipo_muestra === 'VIGA' ? muestra.beam_span : null,
        diametro_cilindro: muestra.tipo_muestra === 'CILINDRO' ? muestra.diametro_cilindro : null,
        unidad_tiempo: muestra.unidad_tiempo,
        cantidad_tiempo: muestra.cantidad_tiempo,
        fecha_ensayo: muestra.fecha_ensayo,
        hora_ensayo: muestra.hora_ensayo,
        created_by: profile?.id
      }));

      const { error: insertError } = await supabase
        .from('muestras_matrix')
        .insert(datosParaInsertar);

      if (insertError) {
        throw new Error(`Error al guardar: ${insertError.message}`);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al guardar');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">¡Datos Guardados Exitosamente!</h3>
            <p className="text-green-600">
              Se guardaron {muestras.length} muestra(s) para el diseño "{diseñoNombre}".
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Datos de Elaboración
              </CardTitle>
              <p className="text-sm text-gray-500">Diseño: {diseñoNombre}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Indicador de progreso */}
          <div className="flex items-center gap-4 mt-4">
            <div className={`flex items-center gap-2 ${currentStep === 'elaboracion' ? 'text-blue-600' : 'text-green-600'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'elaboracion' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Datos de Elaboración</span>
            </div>
            <div className={`w-8 h-0.5 ${currentStep === 'muestras' ? 'bg-blue-300' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center gap-2 ${currentStep === 'muestras' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'muestras' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Muestras</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sección 1: Datos de Elaboración */}
      {currentStep === 'elaboracion' && (
        <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Datos de Elaboración de Mezcla
            </CardTitle>
            <p className="text-sm text-gray-500">
              Información general de la elaboración (se aplicará a todas las muestras)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha-elaboracion">Fecha de Elaboración *</Label>
                <Input
                  id="fecha-elaboracion"
                  type="date"
                  value={datosElaboracion.fecha_elaboracion}
                  onChange={(e) => setDatosElaboracion({ ...datosElaboracion, fecha_elaboracion: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora-elaboracion">Hora de Elaboración *</Label>
                <Input
                  id="hora-elaboracion"
                  type="time"
                  value={datosElaboracion.hora_elaboracion}
                  onChange={(e) => setDatosElaboracion({ ...datosElaboracion, hora_elaboracion: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="masa-real">Masa Real (kg/m³) *</Label>
                <Input
                  id="masa-real"
                  type="number"
                  value={datosElaboracion.masa_real || ''}
                  onChange={(e) => setDatosElaboracion({ ...datosElaboracion, masa_real: parseFloat(e.target.value) || 0 })}
                  placeholder="Ej: 2400"
                  min="2000"
                  max="2600"
                  step="1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rev-real">Revenimiento Real (cm) *</Label>
                <Input
                  id="rev-real"
                  type="number"
                  value={datosElaboracion.rev_real || ''}
                  onChange={(e) => setDatosElaboracion({ ...datosElaboracion, rev_real: parseFloat(e.target.value) || 0 })}
                  placeholder="Ej: 10.5"
                  min="0"
                  max="25"
                  step="0.5"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contenido-aire">Contenido de Aire (%) *</Label>
                <Input
                  id="contenido-aire"
                  type="number"
                  value={datosElaboracion.contenido_aire || ''}
                  onChange={(e) => setDatosElaboracion({ ...datosElaboracion, contenido_aire: parseFloat(e.target.value) || 0 })}
                  placeholder="Ej: 2.5"
                  min="0"
                  max="10"
                  step="0.1"
                  required
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end mt-6">
              <Button onClick={continuarAMuestras} variant="ghost" className="!bg-blue-600 !hover:bg-blue-700 !text-white">
                Continuar a Muestras
                <Plus className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 2: Muestras */}
      {currentStep === 'muestras' && (
        <div className="space-y-4">
          {/* Resumen de datos de elaboración */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-blue-800 mb-2">Datos de Elaboración Confirmados</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Fecha:</span>
                  <div className="font-medium">{datosElaboracion.fecha_elaboracion}</div>
                </div>
                <div>
                  <span className="text-blue-600">Hora:</span>
                  <div className="font-medium">{datosElaboracion.hora_elaboracion}</div>
                </div>
                <div>
                  <span className="text-blue-600">Masa Real:</span>
                  <div className="font-medium">{datosElaboracion.masa_real} kg/m³</div>
                </div>
                <div>
                  <span className="text-blue-600">Rev. Real:</span>
                  <div className="font-medium">{datosElaboracion.rev_real} cm</div>
                </div>
                <div>
                  <span className="text-blue-600">Aire:</span>
                  <div className="font-medium">{datosElaboracion.contenido_aire}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Muestras */}
          <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Muestras para Ensayo
                </CardTitle>
                <Button onClick={agregarMuestra} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Muestra
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {muestras.map((muestra, index) => (
                  <Card key={index} className="bg-gray-50 border border-gray-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">
                          Muestra {index + 1}
                        </h4>
                        {muestras.length > 1 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => eliminarMuestra(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo de Muestra *</Label>
                          <Select 
                            value={muestra.tipo_muestra} 
                            onValueChange={(value) => cambiarTipoMuestra(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CILINDRO">Cilindro</SelectItem>
                              <SelectItem value="VIGA">Viga</SelectItem>
                              <SelectItem value="CUBO">Cubo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Campos de dimensiones según tipo de muestra */}
                        {muestra.tipo_muestra === 'CILINDRO' && (
                          <div className="space-y-2">
                            <Label>Diámetro Cilindro (cm) *</Label>
                            <Select 
                              value={muestra.diametro_cilindro.toString()} 
                              onValueChange={(value) => actualizarMuestra(index, 'diametro_cilindro', parseFloat(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar diámetro" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10 cm</SelectItem>
                                <SelectItem value="15">15 cm</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {muestra.tipo_muestra === 'CUBO' && (
                          <div className="space-y-2">
                            <Label>Medida del Cubo (cm) *</Label>
                            <Input
                              type="number"
                              value={muestra.cube_medida || ''}
                              onChange={(e) => actualizarMuestra(index, 'cube_medida', parseFloat(e.target.value) || 0)}
                              placeholder="Ej: 15"
                              min="5"
                              max="30"
                              step="0.1"
                              required
                            />
                          </div>
                        )}

                        {muestra.tipo_muestra === 'VIGA' && (
                          <div className="md:col-span-3 space-y-2">
                            <Label>Dimensiones de Viga (cm)</Label>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Ancho</Label>
                                <Input
                                  type="number"
                                  value={muestra.beam_width || ''}
                                  onChange={(e) => actualizarMuestra(index, 'beam_width', parseFloat(e.target.value) || 0)}
                                  placeholder="15"
                                  min="5"
                                  max="30"
                                  step="0.1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Alto</Label>
                                <Input
                                  type="number"
                                  value={muestra.beam_height || ''}
                                  onChange={(e) => actualizarMuestra(index, 'beam_height', parseFloat(e.target.value) || 0)}
                                  placeholder="15"
                                  min="5"
                                  max="30"
                                  step="0.1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Longitud</Label>
                                <Input
                                  type="number"
                                  value={muestra.beam_span || ''}
                                  onChange={(e) => actualizarMuestra(index, 'beam_span', parseFloat(e.target.value) || 0)}
                                  placeholder="50"
                                  min="30"
                                  max="80"
                                  step="0.1"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Dimensiones estándar: 15 x 15 x 50 cm (se llenan automáticamente)
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Unidad de Tiempo</Label>
                          <Select 
                            value={muestra.unidad_tiempo} 
                            onValueChange={(value) => {
                              actualizarMuestra(index, 'unidad_tiempo', value);
                              // Recalcular fecha de ensayo
                              const nuevaFecha = calcularFechaEnsayo(
                                datosElaboracion.fecha_elaboracion,
                                muestra.cantidad_tiempo,
                                value
                              );
                              actualizarMuestra(index, 'fecha_ensayo', nuevaFecha);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar unidad" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HORAS">Horas</SelectItem>
                              <SelectItem value="DIAS">Días</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Cantidad de Tiempo *</Label>
                          <Input
                            type="number"
                            value={muestra.cantidad_tiempo || ''}
                            onChange={(e) => {
                              const cantidad = parseInt(e.target.value) || 0;
                              actualizarMuestra(index, 'cantidad_tiempo', cantidad);
                              // Recalcular fecha de ensayo
                              const nuevaFecha = calcularFechaEnsayo(
                                datosElaboracion.fecha_elaboracion,
                                cantidad,
                                muestra.unidad_tiempo
                              );
                              actualizarMuestra(index, 'fecha_ensayo', nuevaFecha);
                            }}
                            placeholder={muestra.unidad_tiempo === 'DIAS' ? 'Ej: 28' : 'Ej: 24'}
                            min="1"
                            max={muestra.unidad_tiempo === 'DIAS' ? '365' : '8760'}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Fecha de Ensayo *</Label>
                          <Input
                            type="date"
                            value={muestra.fecha_ensayo}
                            onChange={(e) => actualizarMuestra(index, 'fecha_ensayo', e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Hora de Ensayo</Label>
                          <Input
                            type="time"
                            value={muestra.hora_ensayo}
                            onChange={(e) => actualizarMuestra(index, 'hora_ensayo', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Información calculada */}
                      <div className="mt-4 p-3 bg-white rounded-lg border">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Tipo:</span>
                            <div className="font-medium">{muestra.tipo_muestra || 'No seleccionado'}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Dimensiones:</span>
                            <div className="font-medium">
                              {muestra.tipo_muestra === 'CILINDRO' && `Ø ${muestra.diametro_cilindro} cm`}
                              {muestra.tipo_muestra === 'CUBO' && `${muestra.cube_medida} cm³`}
                              {muestra.tipo_muestra === 'VIGA' && `${muestra.beam_width}×${muestra.beam_height}×${muestra.beam_span} cm`}
                              {!muestra.tipo_muestra && 'No definidas'}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Tiempo ensayo:</span>
                            <div className="font-medium">{muestra.cantidad_tiempo} {muestra.unidad_tiempo.toLowerCase()}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Fecha ensayo:</span>
                            <div className="font-medium">{muestra.fecha_ensayo || 'No calculada'}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('elaboracion')}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Volver a Elaboración
                </Button>
                
                <Button 
                  onClick={guardarDatosElaboracion} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Save className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar {muestras.length} Muestra(s)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
