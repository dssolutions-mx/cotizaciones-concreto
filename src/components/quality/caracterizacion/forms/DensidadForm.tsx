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
  Scale, 
  AlertCircle,
  Info,
  Droplets
} from 'lucide-react';
import { toast } from 'sonner';

interface DensidadResultados {
  // Pesos de la muestra
  peso_muestra_seca: number;
  peso_muestra_sss: number; // Saturada Superficie Seca
  peso_muestra_sumergida: number;
  
  // Resultados calculados
  densidad_relativa: number;
  densidad_sss: number;
  densidad_aparente: number;
  absorcion: number;
  
  // Datos adicionales
  temperatura_agua: number;
  factor_correccion_temperatura: number;
  
  observaciones?: string;
}

interface DensidadFormProps {
  estudioId: string;
  initialData?: DensidadResultados;
  onSave: (data: DensidadResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DensidadForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false 
}: DensidadFormProps) {
  const [formData, setFormData] = useState<DensidadResultados>(() => {
    if (initialData) return initialData;
    
    return {
      peso_muestra_seca: 0,
      peso_muestra_sss: 0,
      peso_muestra_sumergida: 0,
      densidad_relativa: 0,
      densidad_sss: 0,
      densidad_aparente: 0,
      absorcion: 0,
      temperatura_agua: 23,
      factor_correccion_temperatura: 1.0,
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcular automáticamente los resultados cuando cambian los pesos
  useEffect(() => {
    calcularResultados();
  }, [
    formData.peso_muestra_seca, 
    formData.peso_muestra_sss, 
    formData.peso_muestra_sumergida,
    formData.temperatura_agua
  ]);

  const calcularResultados = () => {
    const { peso_muestra_seca, peso_muestra_sss, peso_muestra_sumergida, temperatura_agua } = formData;
    
    if (peso_muestra_seca <= 0 || peso_muestra_sss <= 0 || peso_muestra_sumergida <= 0) {
      return;
    }

    // Factor de corrección por temperatura (simplificado)
    const factorCorreccion = 1.0 + (temperatura_agua - 23) * 0.0002;

    // Densidad relativa (bulk specific gravity)
    const densidadRelativa = peso_muestra_seca / (peso_muestra_sss - peso_muestra_sumergida) * factorCorreccion;

    // Densidad SSS (saturated surface-dry specific gravity)
    const densidadSss = peso_muestra_sss / (peso_muestra_sss - peso_muestra_sumergida) * factorCorreccion;

    // Densidad aparente (apparent specific gravity)
    const densidadAparente = peso_muestra_seca / (peso_muestra_seca - peso_muestra_sumergida) * factorCorreccion;

    // Absorción (%)
    const absorcion = ((peso_muestra_sss - peso_muestra_seca) / peso_muestra_seca) * 100;

    setFormData(prev => ({
      ...prev,
      densidad_relativa: Number(densidadRelativa.toFixed(3)),
      densidad_sss: Number(densidadSss.toFixed(3)),
      densidad_aparente: Number(densidadAparente.toFixed(3)),
      absorcion: Number(absorcion.toFixed(2)),
      factor_correccion_temperatura: Number(factorCorreccion.toFixed(4))
    }));
  };

  const handleInputChange = (field: keyof DensidadResultados, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.peso_muestra_seca <= 0) {
      newErrors.peso_muestra_seca = 'El peso de la muestra seca debe ser mayor a 0';
    }

    if (formData.peso_muestra_sss <= 0) {
      newErrors.peso_muestra_sss = 'El peso de la muestra SSS debe ser mayor a 0';
    }

    if (formData.peso_muestra_sumergida <= 0) {
      newErrors.peso_muestra_sumergida = 'El peso de la muestra sumergida debe ser mayor a 0';
    }

    if (formData.peso_muestra_sss < formData.peso_muestra_seca) {
      newErrors.peso_muestra_sss = 'El peso SSS debe ser mayor o igual al peso seco';
    }

    if (formData.peso_muestra_sumergida >= formData.peso_muestra_seca) {
      newErrors.peso_muestra_sumergida = 'El peso sumergido debe ser menor al peso seco';
    }

    if (formData.temperatura_agua < 15 || formData.temperatura_agua > 35) {
      newErrors.temperatura_agua = 'La temperatura debe estar entre 15°C y 35°C';
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
      toast.success('Análisis de densidad guardado exitosamente');
    } catch (error) {
      console.error('Error saving densidad:', error);
      toast.error('Error al guardar el análisis de densidad');
    } finally {
      setSaving(false);
    }
  };

  const getInterpretacionAbsorcion = (absorcion: number) => {
    if (absorcion < 1) return { texto: 'Muy baja', color: 'text-green-600' };
    if (absorcion < 2) return { texto: 'Baja', color: 'text-blue-600' };
    if (absorcion < 3) return { texto: 'Moderada', color: 'text-yellow-600' };
    if (absorcion < 5) return { texto: 'Alta', color: 'text-orange-600' };
    return { texto: 'Muy alta', color: 'text-red-600' };
  };

  const interpretacionAbsorcion = getInterpretacionAbsorcion(formData.absorcion);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#069e2d]" />
            Análisis de Densidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Norma:</strong> NMX-C-164 / NMX-C-165 - Determinación de la densidad relativa del agregado
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Datos de Entrada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pesos de la Muestra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peso_seca">Peso Muestra Seca (g) *</Label>
              <Input
                id="peso_seca"
                type="number"
                step="0.1"
                value={formData.peso_muestra_seca || ''}
                onChange={(e) => handleInputChange('peso_muestra_seca', e.target.value)}
                className={errors.peso_muestra_seca ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_seca && (
                <p className="text-sm text-red-600">{errors.peso_muestra_seca}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="peso_sss">Peso Muestra SSS (g) *</Label>
              <Input
                id="peso_sss"
                type="number"
                step="0.1"
                value={formData.peso_muestra_sss || ''}
                onChange={(e) => handleInputChange('peso_muestra_sss', e.target.value)}
                className={errors.peso_muestra_sss ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_sss && (
                <p className="text-sm text-red-600">{errors.peso_muestra_sss}</p>
              )}
              <p className="text-xs text-gray-500">Saturada Superficie Seca</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="peso_sumergida">Peso Sumergida (g) *</Label>
              <Input
                id="peso_sumergida"
                type="number"
                step="0.1"
                value={formData.peso_muestra_sumergida || ''}
                onChange={(e) => handleInputChange('peso_muestra_sumergida', e.target.value)}
                className={errors.peso_muestra_sumergida ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_sumergida && (
                <p className="text-sm text-red-600">{errors.peso_muestra_sumergida}</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperatura">Temperatura del Agua (°C) *</Label>
              <Input
                id="temperatura"
                type="number"
                step="0.1"
                value={formData.temperatura_agua || ''}
                onChange={(e) => handleInputChange('temperatura_agua', e.target.value)}
                className={errors.temperatura_agua ? 'border-red-500' : ''}
              />
              {errors.temperatura_agua && (
                <p className="text-sm text-red-600">{errors.temperatura_agua}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Factor de Corrección</Label>
              <Input
                value={formData.factor_correccion_temperatura.toFixed(4)}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">Calculado automáticamente</p>
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
            {/* Densidades */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Densidades</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#069e2d]/10 rounded-lg">
                  <span className="font-medium text-[#069e2d]">Densidad Relativa:</span>
                  <Badge className="bg-[#069e2d] text-white">
                    {formData.densidad_relativa.toFixed(3)}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-[#069e2d]/10 rounded-lg">
                  <span className="font-medium text-[#069e2d]">Densidad SSS:</span>
                  <Badge className="bg-[#069e2d] text-white">
                    {formData.densidad_sss.toFixed(3)}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-[#069e2d]/10 rounded-lg">
                  <span className="font-medium text-[#069e2d]">Densidad Aparente:</span>
                  <Badge className="bg-[#069e2d] text-white">
                    {formData.densidad_aparente.toFixed(3)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Absorción */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Absorción</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-[#069e2d]/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-[#069e2d]" />
                    <span className="font-medium text-[#069e2d]">Absorción:</span>
                  </div>
                  <Badge className="bg-[#069e2d] text-white text-lg px-3 py-1">
                    {formData.absorcion.toFixed(2)}%
                  </Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Interpretación:</span>
                    <span className={`text-sm font-medium ${interpretacionAbsorcion.color}`}>
                      {interpretacionAbsorcion.texto}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guía de interpretación */}
              <div className="p-3 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/20">
                <h4 className="text-sm font-medium text-[#069e2d] mb-2">Guía de Interpretación:</h4>
                <div className="text-xs text-gray-700 space-y-1">
                  <div>• &lt; 1%: Muy baja absorción</div>
                  <div>• 1-2%: Baja absorción</div>
                  <div>• 2-3%: Absorción moderada</div>
                  <div>• 3-5%: Alta absorción</div>
                  <div>• &gt; 5%: Muy alta absorción</div>
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
                <p><strong>Densidad Relativa:</strong> Relación entre la masa del agregado seco y la masa de un volumen igual de agua.</p>
                <p><strong>Densidad SSS:</strong> Densidad del agregado saturado con superficie seca.</p>
                <p><strong>Densidad Aparente:</strong> Densidad considerando solo el volumen de partículas sólidas.</p>
                <p><strong>Absorción:</strong> Cantidad de agua que puede absorber el agregado expresada como porcentaje de su peso seco.</p>
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
