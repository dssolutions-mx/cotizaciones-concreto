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
  TestTube, 
  AlertCircle,
  Info,
  Timer,
  Thermometer
} from 'lucide-react';
import { toast } from 'sonner';

interface AbsorcionResultados {
  // Pesos de la muestra
  peso_muestra_seca: number;
  peso_muestra_saturada: number;
  
  // Condiciones del ensayo
  tiempo_saturacion: number; // en horas
  temperatura_agua: number;
  metodo_secado: string;
  
  // Resultados calculados
  absorcion_porcentaje: number;
  incremento_peso: number;
  
  // Clasificación
  clasificacion_absorcion: string;
  
  observaciones?: string;
}

interface AbsorcionFormProps {
  estudioId: string;
  initialData?: AbsorcionResultados;
  onSave: (data: AbsorcionResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function AbsorcionForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false 
}: AbsorcionFormProps) {
  const [formData, setFormData] = useState<AbsorcionResultados>(() => {
    if (initialData) return initialData;
    
    return {
      peso_muestra_seca: 0,
      peso_muestra_saturada: 0,
      tiempo_saturacion: 24,
      temperatura_agua: 23,
      metodo_secado: 'Horno 110°C',
      absorcion_porcentaje: 0,
      incremento_peso: 0,
      clasificacion_absorcion: '',
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcular automáticamente los resultados cuando cambian los pesos
  useEffect(() => {
    calcularResultados();
  }, [formData.peso_muestra_seca, formData.peso_muestra_saturada]);

  const calcularResultados = () => {
    const { peso_muestra_seca, peso_muestra_saturada } = formData;
    
    if (peso_muestra_seca <= 0 || peso_muestra_saturada <= 0) {
      return;
    }

    // Calcular incremento de peso
    const incrementoPeso = peso_muestra_saturada - peso_muestra_seca;

    // Calcular porcentaje de absorción
    const absorcionPorcentaje = peso_muestra_seca > 0 
      ? (incrementoPeso / peso_muestra_seca) * 100 
      : 0;

    // Clasificar absorción
    let clasificacionAbsorcion = '';
    if (absorcionPorcentaje < 0.5) {
      clasificacionAbsorcion = 'Muy baja';
    } else if (absorcionPorcentaje < 1.0) {
      clasificacionAbsorcion = 'Baja';
    } else if (absorcionPorcentaje < 2.0) {
      clasificacionAbsorcion = 'Moderada';
    } else if (absorcionPorcentaje < 4.0) {
      clasificacionAbsorcion = 'Alta';
    } else {
      clasificacionAbsorcion = 'Muy alta';
    }

    setFormData(prev => ({
      ...prev,
      incremento_peso: Number(incrementoPeso.toFixed(1)),
      absorcion_porcentaje: Number(absorcionPorcentaje.toFixed(2)),
      clasificacion_absorcion: clasificacionAbsorcion
    }));
  };

  const handleInputChange = (field: keyof AbsorcionResultados, value: string | number) => {
    if (typeof value === 'string' && ['metodo_secado', 'clasificacion_absorcion', 'observaciones'].includes(field)) {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    } else {
      const numericValue = typeof value === 'string' ? (parseFloat(value) || 0) : value;
      setFormData(prev => ({
        ...prev,
        [field]: numericValue
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.peso_muestra_seca <= 0) {
      newErrors.peso_muestra_seca = 'El peso de la muestra seca debe ser mayor a 0';
    }

    if (formData.peso_muestra_saturada <= 0) {
      newErrors.peso_muestra_saturada = 'El peso de la muestra saturada debe ser mayor a 0';
    }

    if (formData.peso_muestra_saturada < formData.peso_muestra_seca) {
      newErrors.peso_muestra_saturada = 'El peso saturado debe ser mayor o igual al peso seco';
    }

    if (formData.tiempo_saturacion < 12 || formData.tiempo_saturacion > 48) {
      newErrors.tiempo_saturacion = 'El tiempo de saturación debe estar entre 12 y 48 horas';
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
      toast.success('Análisis de absorción guardado exitosamente');
    } catch (error) {
      console.error('Error saving absorcion:', error);
      toast.error('Error al guardar el análisis de absorción');
    } finally {
      setSaving(false);
    }
  };

  const getColorClasificacion = (clasificacion: string) => {
    switch (clasificacion) {
      case 'Muy baja': return 'text-green-700 bg-green-100';
      case 'Baja': return 'text-green-600 bg-green-50';
      case 'Moderada': return 'text-yellow-700 bg-yellow-100';
      case 'Alta': return 'text-orange-700 bg-orange-100';
      case 'Muy alta': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getIconClasificacion = (clasificacion: string) => {
    switch (clasificacion) {
      case 'Muy baja':
      case 'Baja':
        return '✅';
      case 'Moderada':
        return '⚠️';
      case 'Alta':
      case 'Muy alta':
        return '❌';
      default:
        return '❓';
    }
  };

  const getRecomendacion = (absorcion: number) => {
    if (absorcion < 1) {
      return 'Excelente para concreto de alta resistencia y durabilidad.';
    } else if (absorcion < 2) {
      return 'Bueno para la mayoría de aplicaciones de concreto estructural.';
    } else if (absorcion < 4) {
      return 'Aceptable para concreto convencional, considerar ajustes en diseño de mezcla.';
    } else {
      return 'Requiere evaluación especial. Puede necesitar tratamiento o rechazo.';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-[#069e2d]" />
            Análisis de Absorción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Norma:</strong> ASTM C127/C128 - Determinación de la capacidad de absorción de agua del agregado
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Datos de la Muestra */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pesos de la Muestra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label htmlFor="peso_saturada">Peso Muestra Saturada (g) *</Label>
              <Input
                id="peso_saturada"
                type="number"
                step="0.1"
                value={formData.peso_muestra_saturada || ''}
                onChange={(e) => handleInputChange('peso_muestra_saturada', e.target.value)}
                className={errors.peso_muestra_saturada ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_saturada && (
                <p className="text-sm text-red-600">{errors.peso_muestra_saturada}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Incremento de Peso (g)</Label>
              <Input
                value={formData.incremento_peso.toFixed(1)}
                disabled
                className="bg-[#069e2d]/10 font-semibold text-[#069e2d]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condiciones del Ensayo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Condiciones del Ensayo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tiempo">Tiempo de Saturación (horas) *</Label>
              <Input
                id="tiempo"
                type="number"
                step="1"
                value={formData.tiempo_saturacion || ''}
                onChange={(e) => handleInputChange('tiempo_saturacion', e.target.value)}
                className={errors.tiempo_saturacion ? 'border-red-500' : ''}
              />
              {errors.tiempo_saturacion && (
                <p className="text-sm text-red-600">{errors.tiempo_saturacion}</p>
              )}
              <p className="text-xs text-gray-500">Típicamente 24 horas</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="temperatura">Temperatura del Agua (°C) *</Label>
              <div className="relative">
                <Thermometer className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="temperatura"
                  type="number"
                  step="0.1"
                  value={formData.temperatura_agua || ''}
                  onChange={(e) => handleInputChange('temperatura_agua', e.target.value)}
                  className={`pl-10 ${errors.temperatura_agua ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.temperatura_agua && (
                <p className="text-sm text-red-600">{errors.temperatura_agua}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="metodo">Método de Secado</Label>
              <select
                id="metodo"
                value={formData.metodo_secado}
                onChange={(e) => handleInputChange('metodo_secado', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Horno 110°C">Horno 110°C</option>
                <option value="Horno 105°C">Horno 105°C</option>
                <option value="Aire libre">Aire libre</option>
                <option value="Estufa">Estufa</option>
              </select>
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
            {/* Absorción */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Absorción</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-[#069e2d]/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TestTube className="h-5 w-5 text-[#069e2d]" />
                    <span className="font-medium text-[#069e2d]">Absorción:</span>
                  </div>
                  <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                    {formData.absorcion_porcentaje.toFixed(2)}%
                  </Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Fórmula utilizada:</div>
                  <div className="text-xs font-mono bg-white p-2 rounded border">
                    Absorción (%) = [(Peso Saturado - Peso Seco) / Peso Seco] × 100
                  </div>
                </div>
              </div>
            </div>

            {/* Clasificación */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Clasificación</h3>
              
              <div className="space-y-3">
                <div className={`p-4 rounded-lg ${getColorClasificacion(formData.clasificacion_absorcion)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Clasificación:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getIconClasificacion(formData.clasificacion_absorcion)}</span>
                      <Badge variant="outline" className="font-semibold">
                        {formData.clasificacion_absorcion}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm opacity-90">
                    {getRecomendacion(formData.absorcion_porcentaje)}
                  </p>
                </div>
              </div>

              {/* Guía de interpretación */}
                <div className="p-3 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/20">
                  <h4 className="text-sm font-medium text-[#069e2d] mb-2">Guía de Interpretación:</h4>
                <div className="text-xs text-gray-700 space-y-1">
                  <div>• &lt; 0.5%: Muy baja absorción ✅</div>
                  <div>• 0.5-1.0%: Baja absorción ✅</div>
                  <div>• 1.0-2.0%: Absorción moderada ⚠️</div>
                  <div>• 2.0-4.0%: Alta absorción ❌</div>
                  <div>• &gt; 4.0%: Muy alta absorción ❌</div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Análisis Técnico */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Análisis Técnico
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-800 mb-2">
                  <strong>Impacto en el concreto:</strong>
                </p>
                <ul className="text-blue-700 space-y-1 text-xs">
                  <li>• Afecta la relación agua/cemento efectiva</li>
                  <li>• Influye en la trabajabilidad de la mezcla</li>
                  <li>• Impacta la durabilidad del concreto</li>
                </ul>
              </div>
              <div>
                <p className="text-blue-800 mb-2">
                  <strong>Consideraciones de diseño:</strong>
                </p>
                <ul className="text-blue-700 space-y-1 text-xs">
                  <li>• Ajustar agua de mezclado</li>
                  <li>• Considerar pre-saturación del agregado</li>
                  <li>• Evaluar compatibilidad con aditivos</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones || ''}
              onChange={(e) => handleInputChange('observaciones', e.target.value)}
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
                <p><strong>Absorción:</strong> Cantidad de agua que puede absorber un agregado expresada como porcentaje de su peso seco.</p>
                <p><strong>Importancia:</strong> Determina cuánta agua adicional se necesita en la mezcla de concreto y afecta las propiedades del concreto fresco y endurecido.</p>
                <p><strong>Procedimiento:</strong> La muestra se satura completamente en agua durante 24 horas, se seca superficialmente y se pesa.</p>
                <p><strong>Aplicación:</strong> Esencial para el diseño de mezclas de concreto y control de calidad de agregados.</p>
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
