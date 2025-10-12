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
  Package,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface MasaVolumetricoResultados {
  // Datos de entrada
  masa_suelta: number; // kg
  masa_compactada: number; // kg
  factor: number; // Factor de conversión a kg/m³
  
  // Resultados calculados
  masa_volumetrica_suelta: number; // kg/m³
  masa_volumetrica_compactada: number; // kg/m³
  
  // Metadatos
  norma_aplicada?: string;
  tipo_agregado?: string;
  observaciones?: string;
}

interface MasaVolumetricoFormProps {
  estudioId: string;
  initialData?: MasaVolumetricoResultados;
  onSave: (data: MasaVolumetricoResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  altaEstudioId?: string;
}

export default function MasaVolumetricoForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false,
  altaEstudioId
}: MasaVolumetricoFormProps) {
  const supabase = createClient();
  const [tipoMaterial, setTipoMaterial] = useState<string>('');
  const [loadingMaterial, setLoadingMaterial] = useState(true);

  const [formData, setFormData] = useState<MasaVolumetricoResultados>(() => {
    if (initialData) return initialData;
    
    return {
      masa_suelta: 0,
      masa_compactada: 0,
      factor: 0,
      masa_volumetrica_suelta: 0,
      masa_volumetrica_compactada: 0,
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Obtener tipo de material
  useEffect(() => {
    const fetchMaterialType = async () => {
      if (!altaEstudioId) {
        setLoadingMaterial(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('alta_estudio')
          .select('tipo_material')
          .eq('id', altaEstudioId)
          .single();

        if (error) {
          console.error('Error loading material info:', error);
          setLoadingMaterial(false);
          return;
        }

        const tipo = data?.tipo_material?.toLowerCase() || '';
        setTipoMaterial(tipo);
        setLoadingMaterial(false);
      } catch (error) {
        console.error('Error fetching material type:', error);
        setLoadingMaterial(false);
      }
    };

    fetchMaterialType();
  }, [altaEstudioId, supabase]);

  // Calcular automáticamente los resultados cuando cambian los valores
  useEffect(() => {
    const { masa_suelta, masa_compactada, factor } = formData;
    
    // Calcular masas volumétricas: MV = masa × factor
    const masaVolumetricaSuelta = masa_suelta * factor;
    const masaVolumetricaCompactada = masa_compactada * factor;

    setFormData(prev => ({
      ...prev,
      masa_volumetrica_suelta: Number(masaVolumetricaSuelta.toFixed(0)),
      masa_volumetrica_compactada: Number(masaVolumetricaCompactada.toFixed(0))
    }));
  }, [
    formData.masa_suelta,
    formData.masa_compactada,
    formData.factor
  ]);

  const handleInputChange = (field: keyof MasaVolumetricoResultados, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.masa_suelta <= 0) {
      newErrors.masa_suelta = 'La masa suelta debe ser mayor a 0';
    }

    if (formData.masa_compactada <= 0) {
      newErrors.masa_compactada = 'La masa compactada debe ser mayor a 0';
    }

    if (formData.factor <= 0) {
      newErrors.factor = 'El factor debe ser mayor a 0';
    }

    if (formData.masa_compactada < formData.masa_suelta) {
      newErrors.masa_compactada = 'La masa compactada debe ser mayor o igual a la masa suelta';
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
      // Agregar metadatos de norma aplicada
      const dataToSave = {
        ...formData,
        norma_aplicada: 'NMX-C-073-ONNCCE-2004',
        tipo_agregado: tipoMaterial
      };
      await onSave(dataToSave);
    } catch (error: any) {
      console.error('Error saving masa volumetrico:', error);
      // El error ya se maneja en el EstudioFormModal
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
            <Layers className="h-5 w-5 text-[#069e2d]" />
            Análisis de Masa Volumétrica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Norma Aplicable:</strong> NMX-C-073-ONNCCE-2004</p>
                <p><strong>Tipo de Agregado:</strong> {tipoMaterial ? tipoMaterial.charAt(0).toUpperCase() + tipoMaterial.slice(1) : 'Agregado'}</p>
                <p className="text-sm mt-2">Determinación de la masa volumétrica de agregados en estado suelto y compactado</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Datos de la Muestra según Norma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos de la Muestra (Según Norma)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Explicación de la nomenclatura */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Nomenclatura de la Norma:</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• <strong>MVS</strong> = Masa volumétrica suelta (kg/m³)</li>
                <li>• <strong>MVC</strong> = Masa volumétrica compactada (kg/m³)</li>
                <li>• <strong>Fórmula:</strong> MV = Masa (kg) × Factor</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="masa_suelta" className="flex items-center gap-2">
                <span>Masa Suelta</span>
                <Badge variant="outline" className="text-xs font-mono">kg</Badge>
              </Label>
              <Input
                id="masa_suelta"
                type="number"
                step="0.01"
                value={formData.masa_suelta || ''}
                onChange={(e) => handleInputChange('masa_suelta', e.target.value)}
                className={errors.masa_suelta ? 'border-red-500' : ''}
                placeholder="kilogramos"
              />
              {errors.masa_suelta && (
                <p className="text-sm text-red-600">{errors.masa_suelta}</p>
              )}
              <p className="text-xs text-gray-500">Peso del agregado en estado suelto</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="masa_compactada" className="flex items-center gap-2">
                <span>Masa Compactada</span>
                <Badge variant="outline" className="text-xs font-mono">kg</Badge>
              </Label>
              <Input
                id="masa_compactada"
                type="number"
                step="0.01"
                value={formData.masa_compactada || ''}
                onChange={(e) => handleInputChange('masa_compactada', e.target.value)}
                className={errors.masa_compactada ? 'border-red-500' : ''}
                placeholder="kilogramos"
              />
              {errors.masa_compactada && (
                <p className="text-sm text-red-600">{errors.masa_compactada}</p>
              )}
              <p className="text-xs text-gray-500">Peso del agregado compactado con varilla</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="factor" className="flex items-center gap-2">
                <span>Factor</span>
                <Badge variant="outline" className="text-xs font-mono">1/m³</Badge>
              </Label>
              <Input
                id="factor"
                type="number"
                step="0.01"
                value={formData.factor || ''}
                onChange={(e) => handleInputChange('factor', e.target.value)}
                className={errors.factor ? 'border-red-500' : ''}
                placeholder="Factor de conversión"
              />
              {errors.factor && (
                <p className="text-sm text-red-600">{errors.factor}</p>
              )}
              <p className="text-xs text-gray-500">Factor de conversión (ej: 198.95)</p>
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
            {/* Masa Volumétrica Suelta */}
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">Masa Volumétrica Suelta:</span>
              </div>
              <Badge className="bg-green-600 text-white text-xl px-4 py-2">
                {formData.masa_volumetrica_suelta.toFixed(0)} kg/m³
              </Badge>
            </div>
            
            {/* Masa Volumétrica Compactada */}
            <div className="flex justify-between items-center p-4 bg-[#069e2d]/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#069e2d]" />
                <span className="font-medium text-[#069e2d]">Masa Volumétrica Compactada:</span>
              </div>
              <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                {formData.masa_volumetrica_compactada.toFixed(0)} kg/m³
              </Badge>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Fórmula según NMX-C-073-ONNCCE-2004:</div>
              <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                <div><strong>MV = Masa (kg) × Factor</strong></div>
                <div className="text-gray-600">Donde:</div>
                <div>• MV = Masa volumétrica (kg/m³)</div>
                <div>• Masa = Peso del agregado (kg)</div>
                <div>• Factor = Factor de conversión (1/m³)</div>
              </div>
              <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                <strong>Cálculo (MVS):</strong> MV = {formData.masa_suelta.toFixed(2)} kg × {formData.factor.toFixed(2)} = {formData.masa_volumetrica_suelta.toFixed(0)} kg/m³
              </div>
              <div className="mt-2 text-xs bg-green-50 p-2 rounded border border-green-200 text-green-800">
                <strong>Cálculo (MVC):</strong> MV = {formData.masa_compactada.toFixed(2)} kg × {formData.factor.toFixed(2)} = {formData.masa_volumetrica_compactada.toFixed(0)} kg/m³
              </div>
            </div>

            <div className="space-y-2 mt-6">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
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
          <CardTitle className="text-lg">Procedimiento según NMX-C-073-ONNCCE-2004</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Definición:</p>
                  <p className="text-sm">La masa volumétrica es la masa del agregado que ocuparía un recipiente de volumen conocido. Se determina en dos condiciones: estado suelto y estado compactado.</p>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Procedimiento Resumido:</p>
                  <ol className="text-sm space-y-1 ml-4">
                    <li>1. <strong>Calibración:</strong> Pesar el recipiente vacío y determinar su volumen</li>
                    <li>2. <strong>Estado Suelto:</strong> Llenar el recipiente dejando caer el agregado desde una altura constante</li>
                    <li>3. <strong>Enrase:</strong> Enrasar con una varilla sin compactar</li>
                    <li>4. <strong>Pesado Suelto:</strong> Pesar el recipiente con agregado suelto</li>
                    <li>5. <strong>Estado Compactado:</strong> Llenar el recipiente en tres capas iguales</li>
                    <li>6. <strong>Compactación:</strong> Apisonar cada capa con 25 golpes de varilla</li>
                    <li>7. <strong>Pesado Compactado:</strong> Pesar el recipiente con agregado compactado</li>
                    <li>8. <strong>Cálculo:</strong> Masa Volumétrica = Masa × Factor</li>
                  </ol>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Importancia:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Conversión de masa a volumen para dosificación de concreto</li>
                    <li>• Determina la compactabilidad del agregado</li>
                    <li>• Calcula el contenido de vacíos en el agregado</li>
                    <li>• Estimación de rendimiento volumétrico del concreto</li>
                  </ul>
                </div>
                
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Nota:</strong> Esta prueba aplica tanto para agregados finos (arena) como para agregados gruesos (grava). El tamaño del recipiente debe seleccionarse según el tamaño máximo nominal del agregado.
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end space-x-4">
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
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
