'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  Calculator, 
  Layers, 
  AlertCircle,
  Info,
  Package
} from 'lucide-react';
import { toast } from 'sonner';

interface MasaVolumetricoResultados {
  // Datos del recipiente
  peso_recipiente_vacio: number;
  volumen_recipiente: number;
  
  // Masa volumétrica suelta
  peso_recipiente_muestra_suelta: number;
  peso_muestra_suelta: number;
  masa_volumetrica_suelta: number;
  
  // Masa volumétrica compactada
  peso_recipiente_muestra_compactada: number;
  peso_muestra_compactada: number;
  masa_volumetrica_compactada: number;
  
  // Resultados calculados
  factor_compactacion: number;
  porcentaje_vacios_suelta: number;
  porcentaje_vacios_compactada: number;
  
  // Datos adicionales
  densidad_relativa_agregado: number; // Para calcular % de vacíos
  
  observaciones?: string;
}

interface MasaVolumetricoFormProps {
  estudioId: string;
  initialData?: MasaVolumetricoResultados;
  onSave: (data: MasaVolumetricoResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function MasaVolumetricoForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false 
}: MasaVolumetricoFormProps) {
  const [formData, setFormData] = useState<MasaVolumetricoResultados>(() => {
    if (initialData) return initialData;
    
    return {
      peso_recipiente_vacio: 0,
      volumen_recipiente: 0,
      peso_recipiente_muestra_suelta: 0,
      peso_muestra_suelta: 0,
      masa_volumetrica_suelta: 0,
      peso_recipiente_muestra_compactada: 0,
      peso_muestra_compactada: 0,
      masa_volumetrica_compactada: 0,
      factor_compactacion: 0,
      porcentaje_vacios_suelta: 0,
      porcentaje_vacios_compactada: 0,
      densidad_relativa_agregado: 2.65, // Valor típico para agregados
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcular automáticamente los resultados cuando cambian los valores
  useEffect(() => {
    calcularResultados();
  }, [
    formData.peso_recipiente_vacio,
    formData.volumen_recipiente,
    formData.peso_recipiente_muestra_suelta,
    formData.peso_recipiente_muestra_compactada,
    formData.densidad_relativa_agregado
  ]);

  const calcularResultados = () => {
    const { 
      peso_recipiente_vacio, 
      volumen_recipiente,
      peso_recipiente_muestra_suelta,
      peso_recipiente_muestra_compactada,
      densidad_relativa_agregado
    } = formData;
    
    if (peso_recipiente_vacio <= 0 || volumen_recipiente <= 0) {
      return;
    }

    // Calcular pesos netos de las muestras
    const pesoMuestraSuelta = peso_recipiente_muestra_suelta - peso_recipiente_vacio;
    const pesoMuestraCompactada = peso_recipiente_muestra_compactada - peso_recipiente_vacio;

    // Calcular masas volumétricas (kg/m³)
    const masaVolumetricaSuelta = volumen_recipiente > 0 ? (pesoMuestraSuelta / volumen_recipiente) * 1000 : 0;
    const masaVolumetricaCompactada = volumen_recipiente > 0 ? (pesoMuestraCompactada / volumen_recipiente) * 1000 : 0;

    // Factor de compactación
    const factorCompactacion = masaVolumetricaSuelta > 0 ? masaVolumetricaCompactada / masaVolumetricaSuelta : 0;

    // Porcentaje de vacíos
    // % vacíos = (1 - (masa volumétrica / (densidad relativa × 1000))) × 100
    const densidadAbsoluta = densidad_relativa_agregado * 1000; // kg/m³
    const porcentajeVaciosSuelta = masaVolumetricaSuelta > 0 
      ? (1 - (masaVolumetricaSuelta / densidadAbsoluta)) * 100 
      : 0;
    const porcentajeVaciosCompactada = masaVolumetricaCompactada > 0 
      ? (1 - (masaVolumetricaCompactada / densidadAbsoluta)) * 100 
      : 0;

    setFormData(prev => ({
      ...prev,
      peso_muestra_suelta: Number(pesoMuestraSuelta.toFixed(1)),
      peso_muestra_compactada: Number(pesoMuestraCompactada.toFixed(1)),
      masa_volumetrica_suelta: Number(masaVolumetricaSuelta.toFixed(1)),
      masa_volumetrica_compactada: Number(masaVolumetricaCompactada.toFixed(1)),
      factor_compactacion: Number(factorCompactacion.toFixed(3)),
      porcentaje_vacios_suelta: Number(porcentajeVaciosSuelta.toFixed(1)),
      porcentaje_vacios_compactada: Number(porcentajeVaciosCompactada.toFixed(1))
    }));
  };

  const handleInputChange = (field: keyof MasaVolumetricoResultados, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.peso_recipiente_vacio <= 0) {
      newErrors.peso_recipiente_vacio = 'El peso del recipiente vacío debe ser mayor a 0';
    }

    if (formData.volumen_recipiente <= 0) {
      newErrors.volumen_recipiente = 'El volumen del recipiente debe ser mayor a 0';
    }

    if (formData.peso_recipiente_muestra_suelta <= formData.peso_recipiente_vacio) {
      newErrors.peso_recipiente_muestra_suelta = 'El peso con muestra suelta debe ser mayor al peso vacío';
    }

    if (formData.peso_recipiente_muestra_compactada <= formData.peso_recipiente_vacio) {
      newErrors.peso_recipiente_muestra_compactada = 'El peso con muestra compactada debe ser mayor al peso vacío';
    }

    if (formData.peso_recipiente_muestra_compactada < formData.peso_recipiente_muestra_suelta) {
      newErrors.peso_recipiente_muestra_compactada = 'El peso compactado debe ser mayor o igual al peso suelto';
    }

    if (formData.densidad_relativa_agregado < 2.0 || formData.densidad_relativa_agregado > 3.5) {
      newErrors.densidad_relativa_agregado = 'La densidad relativa debe estar entre 2.0 y 3.5';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
      toast.success('Análisis de masa volumétrico guardado exitosamente');
    } catch (error) {
      console.error('Error saving masa volumetrico:', error);
      toast.error('Error al guardar el análisis de masa volumétrico');
    } finally {
      setSaving(false);
    }
  };

  const getInterpretacionFactorCompactacion = (factor: number) => {
    if (factor < 1.1) return { texto: 'Baja compactabilidad', color: 'text-red-600' };
    if (factor < 1.2) return { texto: 'Compactabilidad moderada', color: 'text-yellow-600' };
    if (factor < 1.3) return { texto: 'Buena compactabilidad', color: 'text-green-600' };
    return { texto: 'Excelente compactabilidad', color: 'text-blue-600' };
  };

  const interpretacionFactor = getInterpretacionFactorCompactacion(formData.factor_compactacion);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Análisis de Masa Volumétrico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Norma:</strong> ASTM C29 / NMX-C-073 - Determinación de la masa volumétrica suelto y compactado
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Datos del Recipiente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del Recipiente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peso_recipiente">Peso Recipiente Vacío (kg) *</Label>
              <Input
                id="peso_recipiente"
                type="number"
                step="0.01"
                value={formData.peso_recipiente_vacio || ''}
                onChange={(e) => handleInputChange('peso_recipiente_vacio', e.target.value)}
                className={errors.peso_recipiente_vacio ? 'border-red-500' : ''}
              />
              {errors.peso_recipiente_vacio && (
                <p className="text-sm text-red-600">{errors.peso_recipiente_vacio}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="volumen_recipiente">Volumen Recipiente (L) *</Label>
              <Input
                id="volumen_recipiente"
                type="number"
                step="0.001"
                value={formData.volumen_recipiente || ''}
                onChange={(e) => handleInputChange('volumen_recipiente', e.target.value)}
                className={errors.volumen_recipiente ? 'border-red-500' : ''}
              />
              {errors.volumen_recipiente && (
                <p className="text-sm text-red-600">{errors.volumen_recipiente}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="densidad_relativa">Densidad Relativa Agregado *</Label>
              <Input
                id="densidad_relativa"
                type="number"
                step="0.01"
                value={formData.densidad_relativa_agregado || ''}
                onChange={(e) => handleInputChange('densidad_relativa_agregado', e.target.value)}
                className={errors.densidad_relativa_agregado ? 'border-red-500' : ''}
              />
              {errors.densidad_relativa_agregado && (
                <p className="text-sm text-red-600">{errors.densidad_relativa_agregado}</p>
              )}
              <p className="text-xs text-gray-500">Valor típico: 2.65</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Masa Volumétrica Suelta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Masa Volumétrica Suelta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peso_suelta">Peso Recipiente + Muestra (kg) *</Label>
              <Input
                id="peso_suelta"
                type="number"
                step="0.01"
                value={formData.peso_recipiente_muestra_suelta || ''}
                onChange={(e) => handleInputChange('peso_recipiente_muestra_suelta', e.target.value)}
                className={errors.peso_recipiente_muestra_suelta ? 'border-red-500' : ''}
              />
              {errors.peso_recipiente_muestra_suelta && (
                <p className="text-sm text-red-600">{errors.peso_recipiente_muestra_suelta}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Peso Neto Muestra (kg)</Label>
              <Input
                value={formData.peso_muestra_suelta.toFixed(1)}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Masa Volumétrica Suelta (kg/m³)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={formData.masa_volumetrica_suelta.toFixed(1)}
                  disabled
                  className="bg-green-50 font-semibold"
                />
                <Badge className="bg-green-600 text-white">
                  Suelta
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Masa Volumétrica Compactada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Masa Volumétrica Compactada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peso_compactada">Peso Recipiente + Muestra (kg) *</Label>
              <Input
                id="peso_compactada"
                type="number"
                step="0.01"
                value={formData.peso_recipiente_muestra_compactada || ''}
                onChange={(e) => handleInputChange('peso_recipiente_muestra_compactada', e.target.value)}
                className={errors.peso_recipiente_muestra_compactada ? 'border-red-500' : ''}
              />
              {errors.peso_recipiente_muestra_compactada && (
                <p className="text-sm text-red-600">{errors.peso_recipiente_muestra_compactada}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Peso Neto Muestra (kg)</Label>
              <Input
                value={formData.peso_muestra_compactada.toFixed(1)}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Masa Volumétrica Compactada (kg/m³)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={formData.masa_volumetrica_compactada.toFixed(1)}
                  disabled
                  className="bg-blue-50 font-semibold"
                />
                <Badge className="bg-blue-600 text-white">
                  Compactada
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados Calculados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resultados Calculados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Factor de Compactación */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Factor de Compactación</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                  <span className="font-medium text-purple-900">Factor de Compactación:</span>
                  <Badge className="bg-purple-600 text-white text-lg px-3 py-1">
                    {formData.factor_compactacion.toFixed(3)}
                  </Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Interpretación:</span>
                    <span className={`text-sm font-medium ${interpretacionFactor.color}`}>
                      {interpretacionFactor.texto}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guía de interpretación */}
              <div className="p-3 bg-purple-50 rounded-lg">
                <h4 className="text-sm font-medium text-purple-900 mb-2">Guía de Interpretación:</h4>
                <div className="text-xs text-purple-700 space-y-1">
                  <div>• &lt; 1.1: Baja compactabilidad</div>
                  <div>• 1.1-1.2: Compactabilidad moderada</div>
                  <div>• 1.2-1.3: Buena compactabilidad</div>
                  <div>• &gt; 1.3: Excelente compactabilidad</div>
                </div>
              </div>
            </div>

            {/* Porcentaje de Vacíos */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Porcentaje de Vacíos</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-900">Vacíos Suelta:</span>
                  <Badge className="bg-green-600 text-white">
                    {formData.porcentaje_vacios_suelta.toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium text-blue-900">Vacíos Compactada:</span>
                  <Badge className="bg-blue-600 text-white">
                    {formData.porcentaje_vacios_compactada.toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="font-medium text-orange-900">Reducción de Vacíos:</span>
                  <Badge className="bg-orange-600 text-white">
                    {(formData.porcentaje_vacios_suelta - formData.porcentaje_vacios_compactada).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Observaciones adicionales del análisis..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Información Técnica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información Técnica</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Masa Volumétrica Suelta:</strong> Masa del agregado por unidad de volumen en estado suelto.</p>
                <p><strong>Masa Volumétrica Compactada:</strong> Masa del agregado por unidad de volumen después de compactación.</p>
                <p><strong>Factor de Compactación:</strong> Relación entre masa volumétrica compactada y suelta.</p>
                <p><strong>Porcentaje de Vacíos:</strong> Volumen de espacios vacíos entre partículas expresado como porcentaje.</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || isLoading}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Análisis
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
