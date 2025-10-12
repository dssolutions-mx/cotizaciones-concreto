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
  Droplets,
  Loader2,
  Beaker
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface DensidadResultados {
  // Pesos de la muestra según norma
  peso_muestra_seca_horno: number; // Ms - Peso seco al horno
  peso_muestra_sss: number; // Msss - Saturada Superficie Seca
  peso_muestra_sumergida: number; // Ma - Peso sumergido en agua
  
  // Volumen y densidades calculadas
  volumen_desplazado: number; // Vol = Msss - Ma (método del volumen desplazado)
  densidad_relativa_seca: number; // Dr seca = Ms / Vol
  densidad_relativa_sss: number; // Dr SSS = Msss / Vol
  densidad_aparente: number; // Da = Ms / (Ms - Ma)
  absorcion: number; // Abs = [(Msss - Ms) / Ms] × 100
  
  // Condiciones del ensayo
  temperatura_agua: number;
  metodo_ensayo: string; // Picnómetro de sifón para grava, Cono truncado y picnómetro para arena
  
  // Metadatos
  tipo_agregado?: string;
  norma_aplicada?: string;
  
  observaciones?: string;
}

interface DensidadFormProps {
  estudioId: string;
  initialData?: DensidadResultados;
  onSave: (data: DensidadResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  altaEstudioId?: string;
}

export default function DensidadForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false,
  altaEstudioId
}: DensidadFormProps) {
  const supabase = createClient();
  const [tipoMaterial, setTipoMaterial] = useState<string>('');
  const [normaAplicable, setNormaAplicable] = useState<string>('NMX-C-164 / NMX-C-165');
  const [loadingMaterial, setLoadingMaterial] = useState(true);

  const [formData, setFormData] = useState<DensidadResultados>(() => {
    if (initialData) {
      // Migrar datos antiguos si existen
      return {
        peso_muestra_seca_horno: (initialData as any).peso_muestra_seca || initialData.peso_muestra_seca_horno || 0,
        peso_muestra_sss: initialData.peso_muestra_sss || 0,
        peso_muestra_sumergida: (initialData as any).peso_muestra_sumergida || initialData.peso_muestra_sumergida || 0,
        volumen_desplazado: initialData.volumen_desplazado || 0,
        densidad_relativa_seca: (initialData as any).densidad_relativa || initialData.densidad_relativa_seca || 0,
        densidad_relativa_sss: (initialData as any).densidad_sss || initialData.densidad_relativa_sss || 0,
        densidad_aparente: initialData.densidad_aparente || 0,
        absorcion: initialData.absorcion || 0,
        temperatura_agua: initialData.temperatura_agua || 23,
        metodo_ensayo: initialData.metodo_ensayo || '',
        tipo_agregado: initialData.tipo_agregado,
        norma_aplicada: initialData.norma_aplicada,
        observaciones: initialData.observaciones || ''
      };
    }
    
    return {
      peso_muestra_seca_horno: 0,
      peso_muestra_sss: 0,
      peso_muestra_sumergida: 0,
      volumen_desplazado: 0,
      densidad_relativa_seca: 0,
      densidad_relativa_sss: 0,
      densidad_aparente: 0,
      absorcion: 0,
      temperatura_agua: 23,
      metodo_ensayo: '',
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Obtener tipo de material para determinar norma aplicable
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

        // Determinar norma y método según tipo de material
        let norma = 'NMX-C-164 / NMX-C-165';
        let metodo = '';
        
        if (tipo.includes('arena') || tipo.includes('fino')) {
          norma = 'NMX-C-165-ONNCCE-2020';
          metodo = 'Picnómetro con cono truncado (Método Chapman)';
        } else if (tipo.includes('grava') || tipo.includes('grueso')) {
          norma = 'NMX-C-164-ONNCCE-2014';
          metodo = 'Picnómetro de sifón (Método de desplazamiento de volumen)';
        }
        
        setNormaAplicable(norma);
        
        // Actualizar formData con norma y método
        setFormData(prev => ({
          ...prev,
          norma_aplicada: norma,
          tipo_agregado: tipo,
          metodo_ensayo: metodo
        }));

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
  }, [
    formData.peso_muestra_seca_horno, 
    formData.peso_muestra_sss, 
    formData.peso_muestra_sumergida
  ]);

  const calcularResultados = () => {
    const { peso_muestra_seca_horno, peso_muestra_sss, peso_muestra_sumergida } = formData;
    
    // Ms = Peso seco al horno
    // Msss = Peso saturado superficialmente seco (SSS)
    // Ma = Peso sumergido en agua
    const Ms = peso_muestra_seca_horno;
    const Msss = peso_muestra_sss;
    const Ma = peso_muestra_sumergida;
    
    if (Ms <= 0 || Msss <= 0 || Ma <= 0) {
      return;
    }

    // **MÉTODO DEL VOLUMEN DESPLAZADO**
    // El volumen del agregado se obtiene por la diferencia entre el peso SSS y el peso sumergido
    // Vol = Msss - Ma (en gramos = cm³, ya que 1g agua = 1cm³)
    const volumenDesplazado = Msss - Ma;

    if (volumenDesplazado <= 0) {
      return;
    }

    // Densidad Relativa Seca = Ms / Vol
    // Esta es la densidad del material seco dividido por el volumen total (incluyendo poros)
    const densidadRelativaSeca = Ms / volumenDesplazado;

    // Densidad Relativa SSS = Msss / Vol
    // Esta es la densidad del material saturado (con agua en los poros) dividido por el volumen total
    const densidadRelativaSSS = Msss / volumenDesplazado;

    // Densidad Aparente = Ms / (Ms - Ma)
    // Esta es la densidad considerando solo el volumen del material sólido (sin poros)
    const densidadAparente = Ms / (Ms - Ma);

    // Absorción = [(Msss - Ms) / Ms] × 100
    const absorcion = ((Msss - Ms) / Ms) * 100;

    setFormData(prev => ({
      ...prev,
      volumen_desplazado: Number(volumenDesplazado.toFixed(2)),
      densidad_relativa_seca: Number(densidadRelativaSeca.toFixed(3)),
      densidad_relativa_sss: Number(densidadRelativaSSS.toFixed(3)),
      densidad_aparente: Number(densidadAparente.toFixed(3)),
      absorcion: Number(absorcion.toFixed(2))
    }));
  };

  const handleInputChange = (field: keyof DensidadResultados, value: string | number) => {
    if (typeof value === 'string' && ['metodo_ensayo', 'observaciones'].includes(field)) {
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

    if (formData.peso_muestra_sumergida <= 0) {
      newErrors.peso_muestra_sumergida = 'El peso de la muestra sumergida (Ma) debe ser mayor a 0';
    }

    if (formData.peso_muestra_sss < formData.peso_muestra_seca_horno) {
      newErrors.peso_muestra_sss = 'El peso SSS (Msss) debe ser mayor o igual al peso seco (Ms)';
    }

    if (formData.peso_muestra_sumergida >= formData.peso_muestra_sss) {
      newErrors.peso_muestra_sumergida = 'El peso sumergido (Ma) debe ser menor al peso SSS (Msss)';
    }

    if (formData.temperatura_agua < 15 || formData.temperatura_agua > 35) {
      newErrors.temperatura_agua = 'La temperatura debe estar entre 15°C y 35°C';
    }

    const volumen = formData.peso_muestra_sss - formData.peso_muestra_sumergida;
    if (volumen <= 0) {
      newErrors.peso_muestra_sumergida = 'El volumen desplazado (Msss - Ma) debe ser mayor a 0';
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
      console.error('Error saving densidad:', error);
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
            <Scale className="h-5 w-5 text-[#069e2d]" />
            Análisis de Densidad Relativa (Método de Volumen Desplazado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Norma Aplicable:</strong> {normaAplicable}</p>
                <p><strong>Tipo de Agregado:</strong> {tipoMaterial ? tipoMaterial.charAt(0).toUpperCase() + tipoMaterial.slice(1) : 'Agregado'}</p>
                <p><strong>Método:</strong> {formData.metodo_ensayo || 'Método de desplazamiento de volumen con picnómetro'}</p>
                <p className="text-sm mt-2">
                  {normaAplicable.includes('165') 
                    ? 'Determinación de la densidad relativa del agregado fino (arena) usando picnómetro y cono truncado'
                    : normaAplicable.includes('164')
                    ? 'Determinación de la densidad relativa del agregado grueso (grava) usando picnómetro de sifón'
                    : 'Determinación de la densidad relativa y absorción del agregado'
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
          {/* Explicación de la nomenclatura y método */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Nomenclatura de la Norma:</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• <strong>Ms</strong> = Masa de la muestra seca al horno (110°C ± 5°C)</li>
                <li>• <strong>Msss</strong> = Masa de la muestra en estado saturado superficialmente seco (SSS)</li>
                <li>• <strong>Ma</strong> = Masa de la muestra sumergida en agua</li>
              </ul>
              <div className="mt-3 p-2 bg-white rounded border border-blue-300">
                <strong>Método del Volumen Desplazado:</strong>
                <div className="mt-1 space-y-1">
                  <div>• <strong>Volumen = Msss - Ma</strong> (agua desplazada en cm³)</div>
                  <div>• <strong>Densidad SSS = Msss / Vol</strong></div>
                  <div>• <strong>Densidad Seca = Ms / Vol</strong></div>
                </div>
              </div>
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
              <Label htmlFor="peso_sumergida" className="flex items-center gap-2">
                <span>Peso Sumergido en Agua</span>
                <Badge variant="outline" className="text-xs font-mono">Ma</Badge>
              </Label>
              <Input
                id="peso_sumergida"
                type="number"
                step="0.01"
                value={formData.peso_muestra_sumergida || ''}
                onChange={(e) => handleInputChange('peso_muestra_sumergida', e.target.value)}
                className={errors.peso_muestra_sumergida ? 'border-red-500' : ''}
                placeholder="gramos"
              />
              {errors.peso_muestra_sumergida && (
                <p className="text-sm text-red-600">{errors.peso_muestra_sumergida}</p>
              )}
              <p className="text-xs text-gray-500">Peso en agua a temperatura controlada (dentro del picnómetro)</p>
            </div>
          </div>
          
          {/* Mostrar el volumen desplazado calculado */}
          <div className="mt-4 p-4 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-[#069e2d]" />
                <span className="font-medium text-[#069e2d]">Volumen Desplazado:</span>
              </div>
              <Badge className="bg-[#069e2d] text-white text-lg px-3 py-1">
                {formData.volumen_desplazado.toFixed(2)} cm³
              </Badge>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Vol = Msss - Ma = {formData.peso_muestra_sss.toFixed(2)} - {formData.peso_muestra_sumergida.toFixed(2)} = {formData.volumen_desplazado.toFixed(2)} cm³
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Condiciones del Ensayo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Condiciones del Ensayo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                placeholder="23"
              />
              {errors.temperatura_agua && (
                <p className="text-sm text-red-600">{errors.temperatura_agua}</p>
              )}
              <p className="text-xs text-gray-500">Temperatura durante el pesado sumergido</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="metodo">Método Empleado</Label>
              <Input
                id="metodo"
                value={formData.metodo_ensayo}
                disabled
                className="bg-gray-50 text-sm"
              />
              <p className="text-xs text-gray-500">Determinado automáticamente según el tipo de material</p>
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
            {/* Densidad Relativa SSS (Principal) */}
            <div className="flex justify-between items-center p-4 bg-[#069e2d]/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-[#069e2d]" />
                <span className="font-medium text-[#069e2d]">Densidad Relativa SSS:</span>
              </div>
              <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                {formData.densidad_relativa_sss.toFixed(3)} g/cm³
              </Badge>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Fórmula según {normaAplicable}:</div>
              <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                <div><strong>Dr SSS = Msss / Vol</strong></div>
                <div className="text-gray-600 mt-1">Donde:</div>
                <div>• Dr SSS = Densidad relativa saturada superficie seca</div>
                <div>• Msss = Peso saturado SSS (g)</div>
                <div>• Vol = Volumen desplazado = Msss - Ma (cm³)</div>
              </div>
              <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                <strong>Cálculo:</strong> Dr SSS = {formData.peso_muestra_sss.toFixed(2)} / {formData.volumen_desplazado.toFixed(2)} = {formData.densidad_relativa_sss.toFixed(3)} g/cm³
              </div>
            </div>

            <Separator />

            {/* Otros Valores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Densidad Relativa Seca</div>
                <div className="text-lg font-semibold text-gray-900">{formData.densidad_relativa_seca.toFixed(3)} g/cm³</div>
                <div className="text-xs text-gray-500 mt-1">Ms / Vol</div>
                <div className="text-xs text-gray-400 mt-1 italic">
                  = {formData.peso_muestra_seca_horno.toFixed(2)} / {formData.volumen_desplazado.toFixed(2)}
                </div>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Densidad Aparente</div>
                <div className="text-lg font-semibold text-gray-900">{formData.densidad_aparente.toFixed(3)} g/cm³</div>
                <div className="text-xs text-gray-500 mt-1">Ms / (Ms - Ma)</div>
                <div className="text-xs text-gray-400 mt-1 italic">
                  Solo volumen sólido (sin poros)
                </div>
              </div>
              
              <div className="p-3 bg-[#069e2d]/10 rounded-lg">
                <div className="text-xs text-[#069e2d] mb-1 flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  Absorción
                </div>
                <div className="text-lg font-semibold text-[#069e2d]">{formData.absorcion.toFixed(2)}%</div>
                <div className="text-xs text-gray-500 mt-1">[(Msss - Ms) / Ms] × 100</div>
              </div>
            </div>

            <Separator className="my-4" />

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
          </div>
        </CardContent>
      </Card>

      {/* Procedimiento según Norma */}
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
                  <p className="text-sm">La densidad relativa es la relación entre la masa del agregado y el volumen que ocupa. El método del volumen desplazado utiliza el principio de Arquímedes para determinar el volumen del agregado mediante el agua desplazada en un picnómetro.</p>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Procedimiento Resumido (Método del Volumen Desplazado):</p>
                  <ol className="text-sm space-y-1 ml-4">
                    <li>1. <strong>Saturación:</strong> Sumergir la muestra en agua durante 24 ± 4 horas</li>
                    <li>2. <strong>Estado SSS:</strong> Secar la superficie hasta condición saturada superficialmente seca
                      {normaAplicable.includes('165') && <span className="text-blue-600"> (usar cono truncado para arena)</span>}
                      {normaAplicable.includes('164') && <span className="text-blue-600"> (usar paño absorbente para grava)</span>}
                    </li>
                    <li>3. <strong>Pesado Msss:</strong> Pesar la muestra en estado SSS (Msss)</li>
                    <li>4. <strong>Pesado en agua:</strong> Introducir la muestra en el picnómetro con agua y pesar (Ma)</li>
                    <li>5. <strong>Cálculo del volumen:</strong> Vol = Msss - Ma (el agua desplazada equivale al volumen)</li>
                    <li>6. <strong>Secado:</strong> Secar en horno a 110°C ± 5°C hasta masa constante</li>
                    <li>7. <strong>Pesado Ms:</strong> Pesar la muestra seca (Ms)</li>
                    <li>8. <strong>Cálculos de densidad:</strong> Aplicar fórmulas usando el volumen obtenido</li>
                  </ol>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Importancia:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Determina la calidad y características del agregado</li>
                    <li>• Esencial para diseño de mezclas de concreto</li>
                    <li>• Permite calcular volúmenes y conversiones de masa</li>
                    <li>• Indicador de porosidad y absorción del material</li>
                    <li>• El volumen desplazado incluye tanto el material sólido como los poros accesibles</li>
                  </ul>
                </div>
                
                {normaAplicable.includes('165') && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>Nota para Arena (NMX-C-165-ONNCCE-2020):</strong> Se utiliza el picnómetro con el método del cono truncado para determinar la condición SSS. La arena está en estado SSS cuando el cono se desmorona al retirar el molde, indicando que la superficie está seca pero los poros están saturados.
                    </p>
                  </div>
                )}
                
                {normaAplicable.includes('164') && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>Nota para Grava (NMX-C-164-ONNCCE-2014):</strong> Se utiliza el picnómetro de sifón. La condición SSS se logra secando la superficie con un paño absorbente hasta que no haya película visible de agua. El agregado mantiene humedad en sus poros internos, lo que es fundamental para el cálculo del volumen desplazado.
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
