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
  Droplets, 
  AlertCircle,
  Info,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface PerdidaLavadoResultados {
  // Pesos de la muestra
  peso_muestra_inicial: number;
  peso_muestra_despues_lavado: number;
  
  // Resultados calculados
  perdida_lavado: number;
  porcentaje_perdida: number;
  porcentaje_retenido: number;
  
  // Datos del proceso
  temperatura_agua: number;
  tiempo_lavado: number; // en minutos
  presion_agua: string; // descripción de la presión utilizada
  
  // Clasificación del material
  clasificacion_limpieza: string;
  
  observaciones?: string;
}

interface PerdidaLavadoFormProps {
  estudioId: string;
  initialData?: PerdidaLavadoResultados;
  onSave: (data: PerdidaLavadoResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function PerdidaLavadoForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false 
}: PerdidaLavadoFormProps) {
  const [formData, setFormData] = useState<PerdidaLavadoResultados>(() => {
    if (initialData) return initialData;
    
    return {
      peso_muestra_inicial: 0,
      peso_muestra_despues_lavado: 0,
      perdida_lavado: 0,
      porcentaje_perdida: 0,
      porcentaje_retenido: 0,
      temperatura_agua: 23,
      tiempo_lavado: 5,
      presion_agua: 'Moderada',
      clasificacion_limpieza: '',
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcular automáticamente los resultados cuando cambian los pesos
  useEffect(() => {
    calcularResultados();
  }, [formData.peso_muestra_inicial, formData.peso_muestra_despues_lavado]);

  const calcularResultados = () => {
    const { peso_muestra_inicial, peso_muestra_despues_lavado } = formData;
    
    if (peso_muestra_inicial <= 0 || peso_muestra_despues_lavado < 0) {
      return;
    }

    // Calcular pérdida por lavado
    const perdidaLavado = peso_muestra_inicial - peso_muestra_despues_lavado;

    // Calcular porcentajes
    const porcentajePerdida = peso_muestra_inicial > 0 
      ? (perdidaLavado / peso_muestra_inicial) * 100 
      : 0;
    
    const porcentajeRetenido = 100 - porcentajePerdida;

    // Clasificar limpieza del material
    let clasificacionLimpieza = '';
    if (porcentajePerdida < 1) {
      clasificacionLimpieza = 'Muy limpio';
    } else if (porcentajePerdida < 3) {
      clasificacionLimpieza = 'Limpio';
    } else if (porcentajePerdida < 5) {
      clasificacionLimpieza = 'Moderadamente sucio';
    } else if (porcentajePerdida < 10) {
      clasificacionLimpieza = 'Sucio';
    } else {
      clasificacionLimpieza = 'Muy sucio';
    }

    setFormData(prev => ({
      ...prev,
      perdida_lavado: Number(perdidaLavado.toFixed(1)),
      porcentaje_perdida: Number(porcentajePerdida.toFixed(2)),
      porcentaje_retenido: Number(porcentajeRetenido.toFixed(2)),
      clasificacion_limpieza: clasificacionLimpieza
    }));
  };

  const handleInputChange = (field: keyof PerdidaLavadoResultados, value: string | number) => {
    if (typeof value === 'string' && ['presion_agua', 'clasificacion_limpieza', 'observaciones'].includes(field)) {
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

    if (formData.peso_muestra_inicial <= 0) {
      newErrors.peso_muestra_inicial = 'El peso de la muestra inicial debe ser mayor a 0';
    }

    if (formData.peso_muestra_despues_lavado < 0) {
      newErrors.peso_muestra_despues_lavado = 'El peso después del lavado no puede ser negativo';
    }

    if (formData.peso_muestra_despues_lavado > formData.peso_muestra_inicial) {
      newErrors.peso_muestra_despues_lavado = 'El peso después del lavado no puede ser mayor al peso inicial';
    }

    if (formData.temperatura_agua < 15 || formData.temperatura_agua > 35) {
      newErrors.temperatura_agua = 'La temperatura debe estar entre 15°C y 35°C';
    }

    if (formData.tiempo_lavado <= 0 || formData.tiempo_lavado > 30) {
      newErrors.tiempo_lavado = 'El tiempo de lavado debe estar entre 1 y 30 minutos';
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
      toast.success('Análisis de pérdida por lavado guardado exitosamente');
    } catch (error) {
      console.error('Error saving perdida lavado:', error);
      toast.error('Error al guardar el análisis de pérdida por lavado');
    } finally {
      setSaving(false);
    }
  };

  const getColorClasificacion = (clasificacion: string) => {
    switch (clasificacion) {
      case 'Muy limpio': return 'text-green-700 bg-green-100';
      case 'Limpio': return 'text-green-600 bg-green-50';
      case 'Moderadamente sucio': return 'text-yellow-700 bg-yellow-100';
      case 'Sucio': return 'text-orange-700 bg-orange-100';
      case 'Muy sucio': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getIconClasificacion = (clasificacion: string) => {
    switch (clasificacion) {
      case 'Muy limpio':
      case 'Limpio':
        return '✅';
      case 'Moderadamente sucio':
        return '⚠️';
      case 'Sucio':
      case 'Muy sucio':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Análisis de Pérdida por Lavado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Norma:</strong> ASTM C117 / NMX-C-084 - Determinación del material fino que pasa la malla No. 200
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
              <Label htmlFor="peso_inicial">Peso Muestra Inicial (g) *</Label>
              <Input
                id="peso_inicial"
                type="number"
                step="0.1"
                value={formData.peso_muestra_inicial || ''}
                onChange={(e) => handleInputChange('peso_muestra_inicial', e.target.value)}
                className={errors.peso_muestra_inicial ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_inicial && (
                <p className="text-sm text-red-600">{errors.peso_muestra_inicial}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="peso_despues">Peso Después del Lavado (g) *</Label>
              <Input
                id="peso_despues"
                type="number"
                step="0.1"
                value={formData.peso_muestra_despues_lavado || ''}
                onChange={(e) => handleInputChange('peso_muestra_despues_lavado', e.target.value)}
                className={errors.peso_muestra_despues_lavado ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_despues_lavado && (
                <p className="text-sm text-red-600">{errors.peso_muestra_despues_lavado}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Pérdida por Lavado (g)</Label>
              <Input
                value={formData.perdida_lavado.toFixed(1)}
                disabled
                className="bg-red-50 font-semibold text-red-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condiciones del Ensayo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Condiciones del Ensayo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label htmlFor="tiempo">Tiempo de Lavado (min) *</Label>
              <Input
                id="tiempo"
                type="number"
                step="0.5"
                value={formData.tiempo_lavado || ''}
                onChange={(e) => handleInputChange('tiempo_lavado', e.target.value)}
                className={errors.tiempo_lavado ? 'border-red-500' : ''}
              />
              {errors.tiempo_lavado && (
                <p className="text-sm text-red-600">{errors.tiempo_lavado}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="presion">Presión del Agua</Label>
              <select
                id="presion"
                value={formData.presion_agua}
                onChange={(e) => handleInputChange('presion_agua', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Baja">Baja</option>
                <option value="Moderada">Moderada</option>
                <option value="Alta">Alta</option>
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
            {/* Porcentajes */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Porcentajes</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="font-medium text-red-900">% Pérdida por Lavado:</span>
                  <Badge className="bg-red-600 text-white text-lg px-3 py-1">
                    {formData.porcentaje_perdida.toFixed(2)}%
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-900">% Material Retenido:</span>
                  <Badge className="bg-green-600 text-white">
                    {formData.porcentaje_retenido.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Clasificación */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Clasificación del Material</h3>
              
              <div className="space-y-3">
                <div className={`p-4 rounded-lg ${getColorClasificacion(formData.clasificacion_limpieza)}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Clasificación:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getIconClasificacion(formData.clasificacion_limpieza)}</span>
                      <Badge variant="outline" className="font-semibold">
                        {formData.clasificacion_limpieza}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guía de interpretación */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Guía de Interpretación:</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <div>• &lt; 1%: Muy limpio ✅</div>
                  <div>• 1-3%: Limpio ✅</div>
                  <div>• 3-5%: Moderadamente sucio ⚠️</div>
                  <div>• 5-10%: Sucio ❌</div>
                  <div>• &gt; 10%: Muy sucio ❌</div>
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
                <p><strong>Pérdida por Lavado:</strong> Cantidad de material fino (que pasa la malla No. 200) presente en el agregado.</p>
                <p><strong>Importancia:</strong> El material fino puede afectar la trabajabilidad del concreto y la adherencia entre el agregado y el cemento.</p>
                <p><strong>Límites típicos:</strong> Para concreto estructural, generalmente se acepta hasta 3-5% de pérdida por lavado.</p>
                <p><strong>Procedimiento:</strong> La muestra se lava con agua hasta que el agua de lavado sea clara, indicando la remoción completa de finos.</p>
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
