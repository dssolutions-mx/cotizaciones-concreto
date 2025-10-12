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
  Thermometer,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface AbsorcionResultados {
  // Pesos de la muestra según norma
  peso_muestra_seca_horno: number; // Ms - Peso seco al horno
  peso_muestra_sss: number; // Msss - Peso saturado superficialmente seco
  
  // Condiciones del ensayo
  tiempo_saturacion: number; // en horas
  temperatura_agua: number;
  metodo_secado: string;
  
  // Resultados calculados
  absorcion_porcentaje: number; // A = [(F - G) / G] × 100
  incremento_peso: number; // F - G
  
  // Clasificación
  clasificacion_absorcion: string;
  
  // Metadata
  norma_aplicada?: string;
  tipo_agregado?: string;
  
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
    if (initialData) {
      // Migrar datos antiguos si existen
      return {
        peso_muestra_seca_horno: (initialData as any).peso_muestra_seca || initialData.peso_muestra_seca_horno || 0,
        peso_muestra_sss: (initialData as any).peso_muestra_saturada || initialData.peso_muestra_sss || 0,
        tiempo_saturacion: initialData.tiempo_saturacion || 24,
        temperatura_agua: initialData.temperatura_agua || 23,
        metodo_secado: initialData.metodo_secado || 'Horno 110°C ± 5°C',
        absorcion_porcentaje: initialData.absorcion_porcentaje || 0,
        incremento_peso: initialData.incremento_peso || 0,
        clasificacion_absorcion: initialData.clasificacion_absorcion || '',
        norma_aplicada: initialData.norma_aplicada,
        tipo_agregado: initialData.tipo_agregado,
        observaciones: initialData.observaciones || ''
      };
    }
    
    return {
      peso_muestra_seca_horno: 0,
      peso_muestra_sss: 0,
      tiempo_saturacion: 24,
      temperatura_agua: 23,
      metodo_secado: 'Horno 110°C ± 5°C',
      absorcion_porcentaje: 0,
      incremento_peso: 0,
      clasificacion_absorcion: '',
      norma_aplicada: undefined,
      tipo_agregado: undefined,
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingMaterial, setLoadingMaterial] = useState(true);
  const [tipoMaterial, setTipoMaterial] = useState<string>('');
  const [normaAplicable, setNormaAplicable] = useState<string>('NMX-C-164 / NMX-C-165');

  // Cargar información del material para determinar la norma aplicable
  useEffect(() => {
    const loadMaterialInfo = async () => {
      try {
        setLoadingMaterial(true);
        
        // Obtener el estudio seleccionado para obtener el alta_estudio_id
        const { data: estudioData, error: estudioError } = await supabase
          .from('estudios_seleccionados')
          .select('alta_estudio_id')
          .eq('id', estudioId)
          .single();

        if (estudioError) throw estudioError;

        // Obtener información del material desde alta_estudio
        const { data: altaEstudioData, error: altaError } = await supabase
          .from('alta_estudio')
          .select('tipo_material, nombre_material')
          .eq('id', estudioData.alta_estudio_id)
          .single();

        if (altaError) throw altaError;

        const tipo = altaEstudioData.tipo_material?.toLowerCase() || '';
        setTipoMaterial(tipo);

        // Determinar la norma según el tipo de material
        let norma = 'NMX-C-164 / NMX-C-165';
        if (tipo.includes('arena') || tipo.includes('fino')) {
          norma = 'NMX-C-165-ONNCCE-2020';
        } else if (tipo.includes('grava') || tipo.includes('grueso')) {
          norma = 'NMX-C-164-ONNCCE-2014';
        }
        
        setNormaAplicable(norma);
        
        // Actualizar el formData con la información del material
        setFormData(prev => ({
          ...prev,
          norma_aplicada: norma,
          tipo_agregado: tipo
        }));

      } catch (error) {
        console.error('Error loading material info:', error);
        toast.error('Error al cargar información del material');
      } finally {
        setLoadingMaterial(false);
      }
    };

    loadMaterialInfo();
  }, [estudioId]);

  // Calcular automáticamente los resultados cuando cambian los pesos
  useEffect(() => {
    calcularResultados();
  }, [formData.peso_muestra_seca_horno, formData.peso_muestra_sss]);

  const calcularResultados = () => {
    const { peso_muestra_seca_horno, peso_muestra_sss } = formData;
    
    // Ms = Peso seco al horno
    // Msss = Peso saturado superficialmente seco (SSS)
    const Ms = peso_muestra_seca_horno;
    const Msss = peso_muestra_sss;
    
    if (Ms <= 0 || Msss <= 0) {
      return;
    }

    // Calcular incremento de peso (Msss - Ms)
    const incrementoPeso = Msss - Ms;

    // Calcular porcentaje de absorción según norma: Abs = [(Msss - Ms) / Ms] × 100
    const absorcionPorcentaje = Ms > 0 
      ? ((Msss - Ms) / Ms) * 100 
      : 0;

    // Clasificar absorción según valores típicos para agregados
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
      incremento_peso: Number(incrementoPeso.toFixed(2)),
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

    if (formData.peso_muestra_seca_horno <= 0) {
      newErrors.peso_muestra_seca_horno = 'El peso de la muestra seca (Ms) debe ser mayor a 0';
    }

    if (formData.peso_muestra_sss <= 0) {
      newErrors.peso_muestra_sss = 'El peso de la muestra SSS (Msss) debe ser mayor a 0';
    }

    if (formData.peso_muestra_sss < formData.peso_muestra_seca_horno) {
      newErrors.peso_muestra_sss = 'El peso SSS (Msss) debe ser mayor o igual al peso seco (Ms)';
    }

    if (formData.tiempo_saturacion < 12 || formData.tiempo_saturacion > 48) {
      newErrors.tiempo_saturacion = 'El tiempo de saturación debe estar entre 12 y 48 horas (típicamente 24h)';
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
      // El toast de éxito se muestra solo si no hay error
    } catch (error: any) {
      console.error('Error saving absorcion:', error);
      // El error ya se maneja en el EstudioFormModal, no mostrar toast duplicado
    } finally {
      setSaving(false);
    }
  };


  if (loadingMaterial) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#069e2d]" />
        <span className="ml-3 text-gray-600">Cargando información del material...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-[#069e2d]" />
            Análisis de Absorción de Agua
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Norma Aplicable:</strong> {normaAplicable}</p>
                <p><strong>Tipo de Agregado:</strong> {tipoMaterial ? tipoMaterial.charAt(0).toUpperCase() + tipoMaterial.slice(1) : 'Agregado'}</p>
                <p className="text-sm mt-2">
                  {normaAplicable.includes('165') 
                    ? 'Método de prueba estándar para agregados finos (arena)'
                    : normaAplicable.includes('164')
                    ? 'Método de prueba estándar para agregados gruesos (grava)'
                    : 'Determinación de la capacidad de absorción de agua del agregado'
                  }
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Datos de la Muestra según Norma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pesos de la Muestra (Según Norma)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Explicación de la nomenclatura */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Nomenclatura de la Norma:</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• <strong>Ms</strong> = Masa de la muestra seca al horno (110°C ± 5°C)</li>
                <li>• <strong>Msss</strong> = Masa de la muestra en estado saturado superficialmente seco (SSS)</li>
                <li>• <strong>Fórmula:</strong> Abs = [(Msss - Ms) / Ms] × 100</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peso_seca_horno" className="flex items-center gap-2">
                <span>Peso Seco al Horno</span>
                <Badge variant="outline" className="text-xs font-mono">Ms</Badge>
              </Label>
              <Input
                id="peso_seca_horno"
                type="number"
                step="0.01"
                value={formData.peso_muestra_seca_horno || ''}
                onChange={(e) => handleInputChange('peso_muestra_seca_horno', e.target.value)}
                className={errors.peso_muestra_seca_horno ? 'border-red-500' : ''}
                placeholder="gramos"
              />
              {errors.peso_muestra_seca_horno && (
                <p className="text-sm text-red-600">{errors.peso_muestra_seca_horno}</p>
              )}
              <p className="text-xs text-gray-500">Secado a 110°C ± 5°C hasta masa constante</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="peso_sss" className="flex items-center gap-2">
                <span>Peso Saturado SSS</span>
                <Badge variant="outline" className="text-xs font-mono">Msss</Badge>
              </Label>
              <Input
                id="peso_sss"
                type="number"
                step="0.01"
                value={formData.peso_muestra_sss || ''}
                onChange={(e) => handleInputChange('peso_muestra_sss', e.target.value)}
                className={errors.peso_muestra_sss ? 'border-red-500' : ''}
                placeholder="gramos"
              />
              {errors.peso_muestra_sss && (
                <p className="text-sm text-red-600">{errors.peso_muestra_sss}</p>
              )}
              <p className="text-xs text-gray-500">Saturado superficialmente seco (24h de inmersión)</p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span>Incremento de Peso</span>
                <Badge variant="outline" className="text-xs font-mono">Msss - Ms</Badge>
              </Label>
              <Input
                value={formData.incremento_peso.toFixed(2)}
                disabled
                className="bg-[#069e2d]/10 font-semibold text-[#069e2d]"
              />
              <p className="text-xs text-gray-500">Agua absorbida (gramos)</p>
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
                <option value="Horno 110°C ± 5°C">Horno 110°C ± 5°C (Norma NMX)</option>
                <option value="Horno 105°C">Horno 105°C</option>
                <option value="Horno 100°C">Horno 100°C</option>
              </select>
              <p className="text-xs text-gray-500">La norma especifica 110°C ± 5°C hasta masa constante</p>
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
          <div className="space-y-4">
            {/* Absorción */}
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
              <div className="text-sm text-gray-600 mb-1">Fórmula según {normaAplicable}:</div>
              <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                <div><strong>Abs = [(Msss - Ms) / Ms] × 100</strong></div>
                <div className="text-gray-600">Donde:</div>
                <div>• Abs = Absorción en porcentaje</div>
                <div>• Msss = Peso saturado SSS (g)</div>
                <div>• Ms = Peso seco al horno (g)</div>
              </div>
              <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                <strong>Cálculo:</strong> Abs = [({formData.peso_muestra_sss.toFixed(2)} - {formData.peso_muestra_seca_horno.toFixed(2)}) / {formData.peso_muestra_seca_horno.toFixed(2)}] × 100 = {formData.absorcion_porcentaje.toFixed(2)}%
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
          </div>
        </CardContent>
      </Card>

      {/* Información Técnica según Norma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procedimiento según {normaAplicable}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Definición:</p>
                  <p className="text-sm">La absorción es la cantidad de agua que penetra los poros permeables de un agregado durante un período establecido, expresada como porcentaje de la masa seca.</p>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Procedimiento Resumido:</p>
                  <ol className="text-sm space-y-1 ml-4">
                    <li>1. <strong>Saturación:</strong> Sumergir la muestra en agua durante 24 ± 4 horas</li>
                    <li>2. <strong>Estado SSS:</strong> Secar la superficie hasta condición saturada superficialmente seca</li>
                    <li>3. <strong>Pesado Msss:</strong> Pesar la muestra en estado SSS (Msss)</li>
                    <li>4. <strong>Secado:</strong> Secar en horno a 110°C ± 5°C hasta masa constante</li>
                    <li>5. <strong>Pesado Ms:</strong> Pesar la muestra seca (Ms)</li>
                    <li>6. <strong>Cálculo:</strong> Abs = [(Msss - Ms) / Ms] × 100</li>
                  </ol>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Importancia:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Determina el agua adicional necesaria en el diseño de mezclas</li>
                    <li>• Afecta la trabajabilidad del concreto fresco</li>
                    <li>• Influye en la durabilidad y resistencia del concreto endurecido</li>
                    <li>• Criterio de aceptación/rechazo de agregados</li>
                  </ul>
                </div>
                
                {normaAplicable.includes('165') && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>Nota para Arena (NMX-C-165):</strong> El procedimiento para determinar la condición SSS en agregado fino utiliza el método del cono truncado.
                    </p>
                  </div>
                )}
                
                {normaAplicable.includes('164') && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>Nota para Grava (NMX-C-164):</strong> La condición SSS se logra secando la superficie con un paño absorbente hasta que no haya película visible de agua.
                    </p>
                  </div>
                )}
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
