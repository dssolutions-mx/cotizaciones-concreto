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
  Filter,
  Loader2,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

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
  
  // Metadatos
  norma_aplicada?: string;
  tipo_agregado?: string;
  
  observaciones?: string;
}

interface PerdidaLavadoFormProps {
  estudioId: string;
  initialData?: PerdidaLavadoResultados;
  onSave: (data: PerdidaLavadoResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  altaEstudioId?: string;
}

export default function PerdidaLavadoForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false,
  altaEstudioId
}: PerdidaLavadoFormProps) {
  const supabase = createClient();
  const [tipoMaterial, setTipoMaterial] = useState<string>('');
  const [loadingMaterial, setLoadingMaterial] = useState(true);

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
      // Agregar metadatos de norma aplicada
      const dataToSave = {
        ...formData,
        norma_aplicada: 'NMX-C-084-ONNCCE-2010',
        tipo_agregado: tipoMaterial
      };
      await onSave(dataToSave);
    } catch (error: any) {
      console.error('Error saving perdida lavado:', error);
      // El error ya se maneja en el EstudioFormModal
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
            <Droplets className="h-5 w-5 text-[#069e2d]" />
            Análisis de Pérdida por Lavado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Norma Aplicable:</strong> NMX-C-084-ONNCCE-2010</p>
                <p><strong>Tipo de Agregado:</strong> {tipoMaterial ? tipoMaterial.charAt(0).toUpperCase() + tipoMaterial.slice(1) : 'Agregado'}</p>
                <p className="text-sm mt-2">Determinación del material fino que pasa la malla No. 200 (75 µm) mediante lavado</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Masa del Espécimen de Ensayo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Masa del Espécimen de Ensayo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-3 flex-1">
                <Label className="text-base font-semibold text-blue-900">
                  Tabla 1 - Masa del espécimen de ensayo
                </Label>
                <p className="text-sm text-blue-800">
                  La masa del espécimen se determina según el tamaño máximo del agregado a ensayar:
                </p>
                
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm border border-blue-300 rounded bg-white">
                    <thead className="bg-blue-100">
                      <tr>
                        <th className="border border-blue-300 px-4 py-3 text-blue-900 text-left">
                          Tamaño Máximo del agregado
                        </th>
                        <th className="border border-blue-300 px-4 py-3 text-blue-900 text-center">
                          Masa, en g
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-blue-300 px-4 py-2">2.36 mm (No. 8)</td>
                        <td className="border border-blue-300 px-4 py-2 text-center font-semibold">100</td>
                      </tr>
                      <tr className="bg-blue-50/50">
                        <td className="border border-blue-300 px-4 py-2">4.75 mm (No. 4)</td>
                        <td className="border border-blue-300 px-4 py-2 text-center font-semibold">500</td>
                      </tr>
                      <tr>
                        <td className="border border-blue-300 px-4 py-2">9.5 mm (3/8")</td>
                        <td className="border border-blue-300 px-4 py-2 text-center font-semibold">2 000</td>
                      </tr>
                      <tr className="bg-blue-50/50">
                        <td className="border border-blue-300 px-4 py-2">19.0 mm (3/4")</td>
                        <td className="border border-blue-300 px-4 py-2 text-center font-semibold">2 500</td>
                      </tr>
                      <tr>
                        <td className="border border-blue-300 px-4 py-2">38.0 mm (1 ½") o Mayores</td>
                        <td className="border border-blue-300 px-4 py-2 text-center font-semibold">5 000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs text-amber-800">
                    <strong>Nota Importante:</strong> La muestra debe ser representativa del material a ensayar y debe estar 
                    completamente seca antes del pesado inicial. El tamaño de la muestra es crítico para obtener resultados 
                    precisos y reproducibles según la norma NMX-C-084-ONNCCE-2010.
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                <li>• <strong>Mi</strong> = Masa inicial de la muestra seca antes del lavado</li>
                <li>• <strong>Mf</strong> = Masa final de la muestra seca después del lavado</li>
                <li>• <strong>Fórmula:</strong> % Pérdida = [(Mi - Mf) / Mi] × 100</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peso_inicial" className="flex items-center gap-2">
                <span>Masa Inicial Seca</span>
                <Badge variant="outline" className="text-xs font-mono">Mi</Badge>
              </Label>
              <Input
                id="peso_inicial"
                type="number"
                step="0.01"
                value={formData.peso_muestra_inicial || ''}
                onChange={(e) => handleInputChange('peso_muestra_inicial', e.target.value)}
                className={errors.peso_muestra_inicial ? 'border-red-500' : ''}
                placeholder="gramos"
              />
              {errors.peso_muestra_inicial && (
                <p className="text-sm text-red-600">{errors.peso_muestra_inicial}</p>
              )}
              <p className="text-xs text-gray-500">Secado previo a 110°C ± 5°C</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="peso_despues" className="flex items-center gap-2">
                <span>Masa Final Seca</span>
                <Badge variant="outline" className="text-xs font-mono">Mf</Badge>
              </Label>
              <Input
                id="peso_despues"
                type="number"
                step="0.01"
                value={formData.peso_muestra_despues_lavado || ''}
                onChange={(e) => handleInputChange('peso_muestra_despues_lavado', e.target.value)}
                className={errors.peso_muestra_despues_lavado ? 'border-red-500' : ''}
                placeholder="gramos"
              />
              {errors.peso_muestra_despues_lavado && (
                <p className="text-sm text-red-600">{errors.peso_muestra_despues_lavado}</p>
              )}
              <p className="text-xs text-gray-500">Después del lavado y secado a 110°C</p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span>Pérdida por Lavado</span>
                <Badge variant="outline" className="text-xs font-mono">Mi - Mf</Badge>
              </Label>
              <Input
                value={formData.perdida_lavado.toFixed(2)}
                disabled
                className="bg-red-50 font-semibold text-red-700"
              />
              <p className="text-xs text-gray-500">Material fino removido (g)</p>
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
                placeholder="23"
              />
              {errors.temperatura_agua && (
                <p className="text-sm text-red-600">{errors.temperatura_agua}</p>
              )}
              <p className="text-xs text-gray-500">Temperatura del agua de lavado</p>
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
                placeholder="5"
              />
              {errors.tiempo_lavado && (
                <p className="text-sm text-red-600">{errors.tiempo_lavado}</p>
              )}
              <p className="text-xs text-gray-500">Duración del procedimiento de lavado</p>
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
              <p className="text-xs text-gray-500">Presión utilizada durante el lavado</p>
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
            {/* Porcentaje de Pérdida Principal */}
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-600">Pérdida por Lavado:</span>
              </div>
              <Badge className="bg-red-600 text-white text-xl px-4 py-2">
                {formData.porcentaje_perdida.toFixed(2)}%
              </Badge>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Fórmula según NMX-C-084:</div>
              <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                <div><strong>% Pérdida = [(Mi - Mf) / Mi] × 100</strong></div>
                <div className="text-gray-600">Donde:</div>
                <div>• % Pérdida = Porcentaje de material fino que pasa la malla No. 200</div>
                <div>• Mi = Masa inicial seca (g)</div>
                <div>• Mf = Masa final seca después del lavado (g)</div>
              </div>
              <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                <strong>Cálculo:</strong> % Pérdida = [({formData.peso_muestra_inicial.toFixed(2)} - {formData.peso_muestra_despues_lavado.toFixed(2)}) / {formData.peso_muestra_inicial.toFixed(2)}] × 100 = {formData.porcentaje_perdida.toFixed(2)}%
              </div>
            </div>

            <Separator />

            {/* Otros Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-green-600 mb-1 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Material Retenido
                </div>
                <div className="text-lg font-semibold text-green-600">{formData.porcentaje_retenido.toFixed(2)}%</div>
                <div className="text-xs text-gray-500 mt-1">Material que no pasa malla No. 200</div>
              </div>
              
              <div className={`p-3 rounded-lg ${getColorClasificacion(formData.clasificacion_limpieza)}`}>
                <div className="text-xs mb-1">
                  Clasificación según norma
                </div>
                <div className="text-lg font-semibold">{formData.clasificacion_limpieza}</div>
                <div className="text-xs mt-1">Según límites NMX</div>
              </div>
            </div>

            <Separator className="my-4" />

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
          </div>
        </CardContent>
      </Card>

      {/* Procedimiento según Norma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procedimiento según NMX-C-084-ONNCCE-2010</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Definición:</p>
                  <p className="text-sm">La pérdida por lavado determina la cantidad de material más fino que la malla No. 200 (75 µm) presente en el agregado mediante un proceso de lavado. Este material incluye arcillas, limos y partículas finas.</p>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Procedimiento Resumido:</p>
                  <ol className="text-sm space-y-1 ml-4">
                    <li>1. <strong>Preparación:</strong> Secar la muestra en horno a 110°C ± 5°C hasta masa constante</li>
                    <li>2. <strong>Pesado Inicial:</strong> Pesar la muestra seca (Mi)</li>
                    <li>3. <strong>Saturación:</strong> Cubrir la muestra con agua y dejar reposar</li>
                    <li>4. <strong>Lavado:</strong> Lavar sobre malla No. 200 con chorro de agua</li>
                    <li>5. <strong>Agitación:</strong> Agitar para liberar el material fino adherido</li>
                    <li>6. <strong>Enjuague:</strong> Continuar hasta que el agua salga clara</li>
                    <li>7. <strong>Secado Final:</strong> Secar el material retenido en horno a 110°C ± 5°C</li>
                    <li>8. <strong>Pesado Final:</strong> Pesar el material retenido seco (Mf)</li>
                    <li>9. <strong>Cálculo:</strong> % Pérdida = [(Mi - Mf) / Mi] × 100</li>
                  </ol>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Importancia:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Detecta presencia de arcillas y limos en el agregado</li>
                    <li>• Afecta la trabajabilidad del concreto fresco</li>
                    <li>• Influye en la adherencia entre agregado y cemento</li>
                    <li>• Puede aumentar la demanda de agua en la mezcla</li>
                  </ul>
                </div>
                
                <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-xs text-yellow-800">
                    <strong>Límites Típicos:</strong> Para concreto estructural se acepta hasta 3-5% de pérdida por lavado. Valores superiores pueden requerir lavado del agregado antes de su uso o evaluación especial del diseño de mezcla.
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
