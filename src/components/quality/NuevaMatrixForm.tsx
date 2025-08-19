'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthBridge } from '@/adapters/auth-context-bridge';

interface Plant {
  id: string;
  code: string;
  name: string;
}

interface MatrixFormData {
  no_matrix: string;
  plant_id: string;
}

interface DisenoFormData {
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
}

interface NuevaMatrixFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NuevaMatrixForm({ onClose, onSuccess }: NuevaMatrixFormProps) {
  const { profile } = useAuthBridge();
  
  // Estados para plantas disponibles
  const [plants, setPlants] = useState<Plant[]>([]);
  
  // Estados para el formulario de matriz
  const [matrixData, setMatrixData] = useState<MatrixFormData>({
    no_matrix: '',
    plant_id: ''
  });
  
  // Estados para los diseños (múltiples diseños por matriz)
  const [diseños, setDiseños] = useState<DisenoFormData[]>([{
    no_muestra: '',
    nombre_muestra: '',
    origen_cemento: '',
    tipo_cemento: '',
    kg_cemento: 0,
    consumo_agua: 0,
    origen_ag: '',
    tamaño_ag: '',
    condicion_aditivo: '',
    rev_diseño: 0,
    masaunitaria_diseño: 0
  }]);
  
  // Estados de control
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cargar plantas disponibles
  useEffect(() => {
    const loadPlants = async () => {
      try {
        const { data: plantsData } = await supabase
          .from('plants')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code');

        if (plantsData) {
          setPlants(plantsData);
        }
      } catch (err) {
        console.error('Error loading plants:', err);
      }
    };

    loadPlants();
  }, []);

  // Función para agregar un nuevo diseño
  const agregarDiseño = () => {
    setDiseños([...diseños, {
      no_muestra: '',
      nombre_muestra: '',
      origen_cemento: '',
      tipo_cemento: '',
      kg_cemento: 0,
      consumo_agua: 0,
      origen_ag: '',
      tamaño_ag: '',
      condicion_aditivo: '',
      rev_diseño: 0,
      masaunitaria_diseño: 0
    }]);
  };

  // Función para eliminar un diseño
  const eliminarDiseño = (index: number) => {
    if (diseños.length > 1) {
      setDiseños(diseños.filter((_, i) => i !== index));
    }
  };

  // Función para actualizar un diseño específico
  const actualizarDiseño = (index: number, field: keyof DisenoFormData, value: any) => {
    const newDiseños = [...diseños];
    newDiseños[index] = { ...newDiseños[index], [field]: value };
    setDiseños(newDiseños);
  };

  // Calcular relación a/c automáticamente
  const calcularRelacionAC = (kg_cemento: number, consumo_agua: number): string => {
    if (kg_cemento > 0 && consumo_agua > 0) {
      return (consumo_agua / kg_cemento).toFixed(3);
    }
    return '0.000';
  };

  // Validar formulario
  const validarFormulario = (): boolean => {
    if (!matrixData.no_matrix.trim()) {
      setError('El número de matriz es requerido');
      return false;
    }
    
    if (!matrixData.plant_id) {
      setError('Debe seleccionar una planta');
      return false;
    }

    for (let i = 0; i < diseños.length; i++) {
      const diseño = diseños[i];
      if (!diseño.no_muestra.trim()) {
        setError(`El número de muestra es requerido en el diseño ${i + 1}`);
        return false;
      }
      if (!diseño.nombre_muestra.trim()) {
        setError(`El nombre de muestra es requerido en el diseño ${i + 1}`);
        return false;
      }
      if (diseño.kg_cemento <= 0) {
        setError(`La cantidad de cemento debe ser mayor a 0 en el diseño ${i + 1}`);
        return false;
      }
      if (diseño.consumo_agua <= 0) {
        setError(`El consumo de agua debe ser mayor a 0 en el diseño ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  // Función para guardar la matriz y sus diseños
  const guardarMatrix = async () => {
    if (!validarFormulario()) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Crear la matriz principal
      const { data: matrixCreated, error: matrixError } = await supabase
        .from('id_matrix')
        .insert({
          plant_id: matrixData.plant_id,
          no_matrix: matrixData.no_matrix,
          created_by: profile?.id
        })
        .select()
        .single();

      if (matrixError) {
        throw new Error(`Error al crear la matriz: ${matrixError.message}`);
      }

      // 2. Crear todos los diseños asociados
      const diseñosToInsert = diseños.map(diseño => ({
        matrix_id: matrixCreated.id,
        plant_id: matrixData.plant_id,
        no_muestra: diseño.no_muestra,
        nombre_muestra: diseño.nombre_muestra,
        origen_cemento: diseño.origen_cemento || null,
        tipo_cemento: diseño.tipo_cemento || null,
        kg_cemento: diseño.kg_cemento,
        consumo_agua: diseño.consumo_agua,
        origen_ag: diseño.origen_ag || null,
        tamaño_ag: diseño.tamaño_ag || null,
        condicion_aditivo: diseño.condicion_aditivo || null,
        rev_diseño: diseño.rev_diseño,
        masaunitaria_diseño: diseño.masaunitaria_diseño,
        created_by: profile?.id
      }));

      const { error: diseñosError } = await supabase
        .from('diseños_matrix')
        .insert(diseñosToInsert);

      if (diseñosError) {
        throw new Error(`Error al crear los diseños: ${diseñosError.message}`);
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
            <h3 className="text-lg font-semibold text-green-800 mb-2">¡Matriz Creada Exitosamente!</h3>
            <p className="text-green-600">
              La matriz "{matrixData.no_matrix}" se ha guardado con {diseños.length} diseño(s).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header del formulario */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nueva Matriz de Diseño
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Datos de la matriz */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="no-matrix">Número de Matriz *</Label>
              <Input
                id="no-matrix"
                value={matrixData.no_matrix}
                onChange={(e) => setMatrixData({ ...matrixData, no_matrix: e.target.value })}
                placeholder="Ej: MATRIX-P002-001"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="plant">Planta *</Label>
              <Select 
                value={matrixData.plant_id} 
                onValueChange={(value) => setMatrixData({ ...matrixData, plant_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.code} - {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diseños de la matriz */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Diseños de Mezcla</h3>
          <Button onClick={agregarDiseño} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Diseño
          </Button>
        </div>

        {diseños.map((diseño, index) => (
          <Card key={index} className="bg-white/80 backdrop-blur border border-slate-200/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Diseño {index + 1}
                  {diseño.nombre_muestra && (
                    <Badge variant="outline" className="ml-2">
                      {diseño.nombre_muestra}
                    </Badge>
                  )}
                </CardTitle>
                {diseños.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => eliminarDiseño(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Información básica */}
                <div className="space-y-2">
                  <Label>No. Muestra *</Label>
                  <Input
                    value={diseño.no_muestra}
                    onChange={(e) => actualizarDiseño(index, 'no_muestra', e.target.value)}
                    placeholder="Ej: M001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nombre Muestra *</Label>
                  <Input
                    value={diseño.nombre_muestra}
                    onChange={(e) => actualizarDiseño(index, 'nombre_muestra', e.target.value)}
                    placeholder="Ej: Concreto FC 250"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Origen Cemento</Label>
                  <Input
                    value={diseño.origen_cemento}
                    onChange={(e) => actualizarDiseño(index, 'origen_cemento', e.target.value)}
                    placeholder="Ej: CEMEX, HOLCIM"
                  />
                </div>

                {/* Información del cemento */}
                <div className="space-y-2">
                  <Label>Tipo Cemento</Label>
                  <Select 
                    value={diseño.tipo_cemento} 
                    onValueChange={(value) => actualizarDiseño(index, 'tipo_cemento', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPC-30">CPC 30</SelectItem>
                      <SelectItem value="CPC-40">CPC 40</SelectItem>
                      <SelectItem value="CPC-50">CPC 50</SelectItem>
                      <SelectItem value="CPO">CPO</SelectItem>
                      <SelectItem value="CPC-30R">CPC 30R</SelectItem>
                      <SelectItem value="CPC-40R">CPC 40R</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cemento (kg/m³) *</Label>
                  <Input
                    type="number"
                    value={diseño.kg_cemento || ''}
                    onChange={(e) => actualizarDiseño(index, 'kg_cemento', parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 350"
                    min="100"
                    max="600"
                    step="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Consumo Agua (L/m³) *</Label>
                  <Input
                    type="number"
                    value={diseño.consumo_agua || ''}
                    onChange={(e) => actualizarDiseño(index, 'consumo_agua', parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 157.5"
                    min="80"
                    max="250"
                    step="0.1"
                    required
                  />
                </div>

                {/* Información de agregados */}
                <div className="space-y-2">
                  <Label>Origen Agregados</Label>
                  <Input
                    value={diseño.origen_ag}
                    onChange={(e) => actualizarDiseño(index, 'origen_ag', e.target.value)}
                    placeholder="Ej: Cantera Local"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tamaño Agregado</Label>
                  <Select 
                    value={diseño.tamaño_ag} 
                    onValueChange={(value) => actualizarDiseño(index, 'tamaño_ag', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tamaño" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9.5mm">9.5mm</SelectItem>
                      <SelectItem value="12.5mm">12.5mm</SelectItem>
                      <SelectItem value="19mm">19mm</SelectItem>
                      <SelectItem value="20mm">20mm</SelectItem>
                      <SelectItem value="25mm">25mm</SelectItem>
                      <SelectItem value="37.5mm">37.5mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rev. Diseño (cm)</Label>
                  <Input
                    type="number"
                    value={diseño.rev_diseño || ''}
                    onChange={(e) => actualizarDiseño(index, 'rev_diseño', parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 10"
                    min="0"
                    max="25"
                    step="0.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Masa Unitaria (kg/m³)</Label>
                  <Input
                    type="number"
                    value={diseño.masaunitaria_diseño || ''}
                    onChange={(e) => actualizarDiseño(index, 'masaunitaria_diseño', parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 2400"
                    min="2000"
                    max="2600"
                    step="1"
                  />
                </div>
              </div>

              {/* Condición de aditivos - campo más grande */}
              <div className="mt-4 space-y-2">
                <Label>Condición Aditivos</Label>
                <Textarea
                  value={diseño.condicion_aditivo}
                  onChange={(e) => actualizarDiseño(index, 'condicion_aditivo', e.target.value)}
                  placeholder="Ej: Plastificante 0.5%, Fibras sintéticas 600g/m³"
                  rows={2}
                />
              </div>

              {/* Información calculada */}
              {diseño.kg_cemento > 0 && diseño.consumo_agua > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-600 font-medium">Relación a/c:</span>
                      <Badge variant="outline" className="text-blue-700">
                        {calcularRelacionAC(diseño.kg_cemento, diseño.consumo_agua)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-600">Eficiencia:</span>
                      <Badge variant="outline" className="text-blue-700">
                        {diseño.kg_cemento > 0 ? (250 / diseño.kg_cemento).toFixed(2) : '0.00'} kg/cm²/kg
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Botones de acción */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardContent className="p-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={guardarMatrix} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <>
                  <Save className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Matriz
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
