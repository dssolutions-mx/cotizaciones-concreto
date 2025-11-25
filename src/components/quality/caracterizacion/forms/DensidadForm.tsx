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
  // Campos comunes
  temperatura_agua: number;
  metodo_ensayo: string;
  tipo_agregado?: string;
  norma_aplicada?: string;
  observaciones?: string;
  
  // Campos para GRAVA (NMX-C-164-ONNCCE-2014) - Método picnómetro tipo sifón
  masa_muestra_sss_grava?: number; // Mag^SSS - Masa de la muestra SSS en aire (kg)
  masa_agua_desalojada?: number; // Ma - Masa del agua desalojada (kg) a razón de 1 dm³ por kg
  
  // Campos antiguos para GRAVA (mantener para compatibilidad)
  peso_muestra_seca_horno?: number; // Ms - Peso seco al horno (DEPRECADO)
  peso_muestra_sss?: number; // Msss - Saturada Superficie Seca (DEPRECADO)
  peso_muestra_sumergida?: number; // Ma - Peso sumergido en agua (DEPRECADO)
  volumen_desplazado?: number; // Vol = Msss - Ma (DEPRECADO)
  
  // Campos para ARENA (NMX-C-165-ONNCCE-2020) - Método picnómetro con cono truncado
  masa_muestra_sss?: number; // S - Masa de la muestra sat. y sup. Seco (g)
  masa_picnometro_agua?: number; // B - Masa del picnómetro con agua (g)
  masa_picnometro_muestra_agua?: number; // C - Masa del picnómetro con la muestra y agua (g)
  porcentaje_absorcion?: number; // %Abs - Porcentaje de absorción
  
  // Resultados calculados (comunes para ambos)
  densidad_relativa_seca: number; // Mes o Dr seca
  densidad_relativa_sss: number; // Messs o Dr SSS  
  densidad_aparente?: number; // Da (principalmente para grava)
  absorcion: number; // Absorción en porcentaje
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
        // Campos comunes
        temperatura_agua: initialData.temperatura_agua || 23,
        metodo_ensayo: initialData.metodo_ensayo || '',
        tipo_agregado: initialData.tipo_agregado,
        norma_aplicada: initialData.norma_aplicada,
        observaciones: initialData.observaciones || '',
        
        // Campos nuevos para grava
        masa_muestra_sss_grava: initialData.masa_muestra_sss_grava || 0,
        masa_agua_desalojada: initialData.masa_agua_desalojada || 0,
        
        // Campos antiguos para grava (compatibilidad)
        peso_muestra_seca_horno: (initialData as any).peso_muestra_seca || initialData.peso_muestra_seca_horno || 0,
        peso_muestra_sss: initialData.peso_muestra_sss || 0,
        peso_muestra_sumergida: (initialData as any).peso_muestra_sumergida || initialData.peso_muestra_sumergida || 0,
        volumen_desplazado: initialData.volumen_desplazado || 0,
        densidad_aparente: initialData.densidad_aparente || 0,
        
        // Campos para arena
        masa_muestra_sss: initialData.masa_muestra_sss || 0,
        masa_picnometro_agua: initialData.masa_picnometro_agua || 0,
        masa_picnometro_muestra_agua: initialData.masa_picnometro_muestra_agua || 0,
        porcentaje_absorcion: initialData.porcentaje_absorcion || 0,
        
        // Resultados
        densidad_relativa_seca: (initialData as any).densidad_relativa || initialData.densidad_relativa_seca || 0,
        densidad_relativa_sss: (initialData as any).densidad_sss || initialData.densidad_relativa_sss || 0,
        absorcion: initialData.absorcion || 0
      };
    }
    
    return {
      temperatura_agua: 23,
      metodo_ensayo: '',
      observaciones: '',
      // Grava nuevos campos
      masa_muestra_sss_grava: 0,
      masa_agua_desalojada: 0,
      // Grava campos antiguos
      peso_muestra_seca_horno: 0,
      peso_muestra_sss: 0,
      peso_muestra_sumergida: 0,
      volumen_desplazado: 0,
      densidad_aparente: 0,
      // Arena
      masa_muestra_sss: 0,
      masa_picnometro_agua: 0,
      masa_picnometro_muestra_agua: 0,
      porcentaje_absorcion: 0,
      // Resultados
      densidad_relativa_seca: 0,
      densidad_relativa_sss: 0,
      absorcion: 0
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
    // Para grava (nuevos campos)
    formData.masa_muestra_sss_grava,
    formData.masa_agua_desalojada,
    // Para grava (campos antiguos - compatibilidad)
    formData.peso_muestra_seca_horno, 
    formData.peso_muestra_sss, 
    formData.peso_muestra_sumergida,
    // Para arena
    formData.masa_muestra_sss,
    formData.masa_picnometro_agua,
    formData.masa_picnometro_muestra_agua,
    formData.porcentaje_absorcion,
    tipoMaterial
  ]);

  const calcularResultados = () => {
    const esArena = tipoMaterial.toLowerCase().includes('arena') || tipoMaterial.toLowerCase().includes('fino');
    
    if (esArena) {
      // **MÉTODO PARA ARENA (NMX-C-165-ONNCCE-2020)**
      // Según la imagen proporcionada
      const S = formData.masa_muestra_sss || 0; // Masa de la muestra sat. y sup. Seco (g)
      const B = formData.masa_picnometro_agua || 0; // Masa del picnómetro con agua (g)
      const C = formData.masa_picnometro_muestra_agua || 0; // Masa del picnómetro con la muestra y agua (g)
      const absPercent = formData.porcentaje_absorcion || 0; // % Absorción
      
      if (S <= 0 || B <= 0 || C <= 0) {
        return;
      }
      
      // Validación: B + S debe ser mayor que C
      if ((B + S) <= C) {
        return;
      }
      
      // Masa específica S.S.S (g/cm³)
      // Messs = S / (B + S - C)
      const messs = S / (B + S - C);
      
      // Masa específica seca (g/cm³)
      // Mes = Messs / (1 + (%Abs/100))
      let mes = 0;
      if (absPercent > 0) {
        mes = messs / (1 + (absPercent / 100));
      }
      
      setFormData(prev => ({
        ...prev,
        densidad_relativa_sss: Number(messs.toFixed(3)),
        densidad_relativa_seca: Number(mes.toFixed(3)),
        absorcion: absPercent
      }));
      
    } else {
      // **MÉTODO PARA GRAVA (NMX-C-164-ONNCCE-2014) - Método picnómetro tipo sifón**
      const MagSSS = formData.masa_muestra_sss_grava || 0; // Masa de la muestra SSS en aire (kg)
      const Ma = formData.masa_agua_desalojada || 0; // Masa del agua desalojada (kg)
      
      if (MagSSS <= 0 || Ma <= 0) {
        // Intentar usar campos antiguos para compatibilidad
        const Ms = formData.peso_muestra_seca_horno || 0;
        const Msss = formData.peso_muestra_sss || 0;
        const MaOld = formData.peso_muestra_sumergida || 0;
        
        if (Ms > 0 && Msss > 0 && MaOld > 0) {
          // Usar método antiguo para compatibilidad
          const volumenDesplazado = Msss - MaOld;
          if (volumenDesplazado <= 0) return;
          
          const densidadRelativaSeca = Ms / volumenDesplazado;
          const densidadRelativaSSS = Msss / volumenDesplazado;
          const densidadAparente = Ms / (Ms - MaOld);
          const absorcion = ((Msss - Ms) / Ms) * 100;

          setFormData(prev => ({
            ...prev,
            volumen_desplazado: Number(volumenDesplazado.toFixed(2)),
            densidad_relativa_seca: Number(densidadRelativaSeca.toFixed(3)),
            densidad_relativa_sss: Number(densidadRelativaSSS.toFixed(3)),
            densidad_aparente: Number(densidadAparente.toFixed(3)),
            absorcion: Number(absorcion.toFixed(2))
          }));
        }
        return;
      }

      // **NUEVA FÓRMULA SEGÚN NMX-C-164-ONNCCE-2014 (ecuación 11)**
      // Dr SSS = Mag^SSS / Ma
      // Donde:
      // - Dr SSS: Densidad relativa saturada y superficialmente seca (adimensional)
      // - Mag^SSS: Masa de la muestra SSS en aire (kg)
      // - Ma: Masa del agua desalojada a razón de 1 dm³ por kg
      
      const drSSS = MagSSS / Ma;
      
      // Calcular densidad seca si hay porcentaje de absorción
      // Dr seca = Dr SSS / (1 + (%Abs/100))
      let drSeca = 0;
      const absPercent = formData.porcentaje_absorcion || 0;
      if (absPercent > 0) {
        drSeca = drSSS / (1 + (absPercent / 100));
      }
      
      setFormData(prev => ({
        ...prev,
        densidad_relativa_sss: Number(drSSS.toFixed(3)),
        densidad_relativa_seca: Number(drSeca.toFixed(3)),
        absorcion: absPercent
      }));
    }
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
    const esArena = tipoMaterial.toLowerCase().includes('arena') || tipoMaterial.toLowerCase().includes('fino');

    if (formData.temperatura_agua < 15 || formData.temperatura_agua > 35) {
      newErrors.temperatura_agua = 'La temperatura debe estar entre 15°C y 35°C';
    }

    if (esArena) {
      // Validación para ARENA
      if (!formData.masa_muestra_sss || formData.masa_muestra_sss <= 0) {
        newErrors.masa_muestra_sss = 'La masa de la muestra SSS (S) debe ser mayor a 0';
      }

      if (!formData.masa_picnometro_agua || formData.masa_picnometro_agua <= 0) {
        newErrors.masa_picnometro_agua = 'La masa del picnómetro con agua (B) debe ser mayor a 0';
      }

      if (!formData.masa_picnometro_muestra_agua || formData.masa_picnometro_muestra_agua <= 0) {
        newErrors.masa_picnometro_muestra_agua = 'La masa del picnómetro con muestra y agua (C) debe ser mayor a 0';
      }

      if (!formData.porcentaje_absorcion || formData.porcentaje_absorcion <= 0) {
        newErrors.porcentaje_absorcion = 'El porcentaje de absorción debe ser mayor a 0';
      }

      // Validación de la fórmula: B + S debe ser mayor que C
      const S = formData.masa_muestra_sss || 0;
      const B = formData.masa_picnometro_agua || 0;
      const C = formData.masa_picnometro_muestra_agua || 0;
      
      if (S > 0 && B > 0 && C > 0 && (B + S) <= C) {
        newErrors.masa_picnometro_muestra_agua = 'Error en los valores: (B + S) debe ser mayor que C';
      }
    } else {
      // Validación para GRAVA (método nuevo NMX-C-164-ONNCCE-2014)
      if (!formData.masa_muestra_sss_grava || formData.masa_muestra_sss_grava <= 0) {
        newErrors.masa_muestra_sss_grava = 'La masa de la muestra SSS en aire (Mag^SSS) debe ser mayor a 0';
      }

      if (!formData.masa_agua_desalojada || formData.masa_agua_desalojada <= 0) {
        newErrors.masa_agua_desalojada = 'La masa del agua desalojada (Ma) debe ser mayor a 0';
      }

      // Validación adicional: Mag^SSS debe ser mayor que Ma
      if (formData.masa_muestra_sss_grava && formData.masa_agua_desalojada &&
          formData.masa_muestra_sss_grava <= formData.masa_agua_desalojada) {
        newErrors.masa_muestra_sss_grava = 'La masa de la muestra SSS debe ser mayor que el agua desalojada';
      }
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

  // Verificar qué tipo es
  const esArena = tipoMaterial.toLowerCase().includes('arena') || tipoMaterial.toLowerCase().includes('fino');
  
  return (
    <div className="space-y-6">
      {/* Header con indicador de tipo */}
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

      {/* Requisitos de Muestra - Diferenciado por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Beaker className="h-5 w-5 text-blue-600" />
            {esArena ? 'Tamaño de la Muestra' : 'Tamaño Mínimo de la Muestra'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-3 flex-1">
                {esArena ? (
                  // PARA ARENA - Texto de método de muestreo
                  <>
                    <Label className="text-base font-semibold text-blue-900">
                      Método de Muestreo para Agregado Fino
                    </Label>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Tomar una muestra del agregado fino de acuerdo con el método de muestreo indicado en la{' '}
                      <strong>NMX-C-030-ONNCCE-2004</strong> (véase 2. Referencias), y se reduce de acuerdo con lo 
                      indicado en la <strong>NMX-C-170-1997-ONNCCE</strong> (véase 2. Referencias), a un volumen de 
                      por lo menos el doble del volumen del picnómetro que se va a emplear en la determinación.
                    </p>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-xs text-amber-800">
                        <strong>Nota Importante:</strong> La muestra debe ser representativa del material total y 
                        reducida adecuadamente para asegurar resultados precisos. El volumen mínimo debe ser el doble 
                        del volumen del picnómetro a utilizar en el ensayo.
                      </p>
                    </div>
                  </>
                ) : (
                  // PARA GRAVA - Tabla de tamaños
                  <>
                    <Label className="text-base font-semibold text-blue-900">
                      TABLA 1 - Tamaño mínimo de la muestra
                    </Label>
                    <p className="text-sm text-blue-800">
                      La masa mínima de la muestra de ensayo se determina según el tamaño máximo nominal del agregado:
                    </p>
                    
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm border border-blue-300 rounded bg-white">
                        <thead className="bg-blue-100">
                          <tr>
                            <th className="border border-blue-300 px-4 py-3 text-blue-900 text-left">
                              Tamaño máximo nominal<br />del agregado en mm
                            </th>
                            <th className="border border-blue-300 px-4 py-3 text-blue-900 text-center">
                              Masa mínima de la<br />muestra de ensayo, kg
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-blue-300 px-4 py-2">Hasta de 13</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">2</td>
                          </tr>
                          <tr className="bg-blue-50/50">
                            <td className="border border-blue-300 px-4 py-2">13-20</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">3</td>
                          </tr>
                          <tr>
                            <td className="border border-blue-300 px-4 py-2">20-25</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">4</td>
                          </tr>
                          <tr className="bg-blue-50/50">
                            <td className="border border-blue-300 px-4 py-2">25-40</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">5</td>
                          </tr>
                          <tr>
                            <td className="border border-blue-300 px-4 py-2">40-50</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">8</td>
                          </tr>
                          <tr className="bg-blue-50/50">
                            <td className="border border-blue-300 px-4 py-2">50-64</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">12</td>
                          </tr>
                          <tr>
                            <td className="border border-blue-300 px-4 py-2">64-76</td>
                            <td className="border border-blue-300 px-4 py-2 text-center font-semibold">18</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-xs text-amber-800">
                        <strong>Nota Importante:</strong> La muestra debe ser representativa del agregado grueso y 
                        cumplir con la masa mínima establecida según su tamaño máximo nominal. Una muestra inadecuada 
                        puede resultar en datos no representativos del material.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de la Muestra según Norma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {esArena 
              ? 'Datos del Ensayo para Arena (NMX-C-165-ONNCCE-2020)' 
              : 'Pesos de la Muestra para Grava (NMX-C-164)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {esArena ? (
            <>
              {/* FORMULARIO PARA ARENA */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  <strong>Nomenclatura según NMX-C-165-ONNCCE-2020:</strong>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• <strong>S</strong> = Masa de la muestra saturada y superficie seca (g)</li>
                    <li>• <strong>B</strong> = Masa del picnómetro con agua (g)</li>
                    <li>• <strong>C</strong> = Masa del picnómetro con la muestra y agua (g)</li>
                    <li>• <strong>%Abs</strong> = Porcentaje de absorción</li>
                  </ul>
                  <div className="mt-3 p-2 bg-white rounded border border-blue-300">
                    <strong>Fórmulas:</strong>
                    <div className="mt-1 space-y-1 font-mono text-xs">
                      <div>• <strong>M<sub>esss</sub> = S / (B + S - C)</strong></div>
                      <div>• <strong>M<sub>es</sub> = M<sub>esss</sub> / (1 + (%Abs/100))</strong></div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="masa_muestra_sss" className="flex items-center gap-2">
                    <span>Masa de la Muestra SSS</span>
                    <Badge variant="outline" className="text-xs font-mono">S</Badge>
                  </Label>
                  <Input
                    id="masa_muestra_sss"
                    type="number"
                    step="0.01"
                    value={formData.masa_muestra_sss || ''}
                    onChange={(e) => handleInputChange('masa_muestra_sss', e.target.value)}
                    className={errors.masa_muestra_sss ? 'border-red-500' : ''}
                    placeholder="678.0"
                  />
                  {errors.masa_muestra_sss && (
                    <p className="text-sm text-red-600">{errors.masa_muestra_sss}</p>
                  )}
                  <p className="text-xs text-gray-500">Masa de la muestra sat. y sup. Seco (g)</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="masa_picnometro_agua" className="flex items-center gap-2">
                    <span>Masa del Picnómetro con Agua</span>
                    <Badge variant="outline" className="text-xs font-mono">B</Badge>
                  </Label>
                  <Input
                    id="masa_picnometro_agua"
                    type="number"
                    step="0.01"
                    value={formData.masa_picnometro_agua || ''}
                    onChange={(e) => handleInputChange('masa_picnometro_agua', e.target.value)}
                    className={errors.masa_picnometro_agua ? 'border-red-500' : ''}
                    placeholder="1550.0"
                  />
                  {errors.masa_picnometro_agua && (
                    <p className="text-sm text-red-600">{errors.masa_picnometro_agua}</p>
                  )}
                  <p className="text-xs text-gray-500">Masa del picnómetro con agua (g)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="masa_picnometro_muestra_agua" className="flex items-center gap-2">
                    <span>Masa del Picnómetro con Muestra y Agua</span>
                    <Badge variant="outline" className="text-xs font-mono">C</Badge>
                  </Label>
                  <Input
                    id="masa_picnometro_muestra_agua"
                    type="number"
                    step="0.01"
                    value={formData.masa_picnometro_muestra_agua || ''}
                    onChange={(e) => handleInputChange('masa_picnometro_muestra_agua', e.target.value)}
                    className={errors.masa_picnometro_muestra_agua ? 'border-red-500' : ''}
                    placeholder="1972.0"
                  />
                  {errors.masa_picnometro_muestra_agua && (
                    <p className="text-sm text-red-600">{errors.masa_picnometro_muestra_agua}</p>
                  )}
                  <p className="text-xs text-gray-500">Masa del picnómetro con la muestra y agua (g)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="porcentaje_absorcion" className="flex items-center gap-2">
                    <span>Porcentaje de Absorción</span>
                    <Badge variant="outline" className="text-xs font-mono">%Abs</Badge>
                  </Label>
                  <Input
                    id="porcentaje_absorcion"
                    type="number"
                    step="0.01"
                    value={formData.porcentaje_absorcion || ''}
                    onChange={(e) => handleInputChange('porcentaje_absorcion', e.target.value)}
                    className={errors.porcentaje_absorcion ? 'border-red-500' : ''}
                    placeholder="1.01"
                  />
                  {errors.porcentaje_absorcion && (
                    <p className="text-sm text-red-600">{errors.porcentaje_absorcion}</p>
                  )}
                  <p className="text-xs text-gray-500">% Absorción</p>
                </div>
              </div>

              {/* Mostrar el cálculo intermedio */}
              {formData.masa_muestra_sss && formData.masa_picnometro_agua && formData.masa_picnometro_muestra_agua && 
               (formData.masa_picnometro_agua + formData.masa_muestra_sss - formData.masa_picnometro_muestra_agua) > 0 && (
                <div className="mt-4 p-4 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/30">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-[#069e2d]" />
                      <span className="font-medium text-[#069e2d]">Cálculo Intermedio:</span>
                    </div>
                    <div className="text-sm font-mono bg-white p-3 rounded border space-y-1">
                      <div>B + S - C = {formData.masa_picnometro_agua.toFixed(2)} + {formData.masa_muestra_sss.toFixed(2)} - {formData.masa_picnometro_muestra_agua.toFixed(2)}</div>
                      <div className="text-[#069e2d] font-bold">
                        = {(formData.masa_picnometro_agua + formData.masa_muestra_sss - formData.masa_picnometro_muestra_agua).toFixed(2)} g
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* FORMULARIO PARA GRAVA - NMX-C-164-ONNCCE-2014 */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  <strong>Nomenclatura según NMX-C-164-ONNCCE-2014:</strong>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• <strong>M<sub>ag</sub><sup>SSS</sup></strong> = Masa de la muestra SSS en aire (kg)</li>
                    <li>• <strong>M<sub>a</sub></strong> = Masa del agua desalojada a razón de 1 dm³ por kg</li>
                    <li>• <strong>%Abs</strong> = Porcentaje de absorción (necesario para densidad seca)</li>
                  </ul>
                  <div className="mt-3 p-2 bg-white rounded border border-blue-300">
                    <strong>Fórmulas del Método del Picnómetro Tipo Sifón:</strong>
                    <div className="mt-1 space-y-1 font-mono text-xs">
                      <div>• <strong>D<sub>r</sub> SSS = M<sub>ag</sub><sup>SSS</sup> / M<sub>a</sub></strong></div>
                      <div>• <strong>D<sub>r</sub> seca = D<sub>r</sub> SSS / (1 + (%Abs/100))</strong></div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="masa_muestra_sss_grava" className="flex items-center gap-2">
                    <span>Masa de la Muestra SSS en Aire</span>
                    <Badge variant="outline" className="text-xs font-mono">M<sub>ag</sub><sup>SSS</sup></Badge>
                  </Label>
                  <Input
                    id="masa_muestra_sss_grava"
                    type="number"
                    step="0.001"
                    value={formData.masa_muestra_sss_grava || ''}
                    onChange={(e) => handleInputChange('masa_muestra_sss_grava', e.target.value)}
                    className={errors.masa_muestra_sss_grava ? 'border-red-500' : ''}
                    placeholder="kg"
                  />
                  {errors.masa_muestra_sss_grava && (
                    <p className="text-sm text-red-600">{errors.masa_muestra_sss_grava}</p>
                  )}
                  <p className="text-xs text-gray-500">Masa de la muestra SSS en aire, en kg</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="masa_agua_desalojada" className="flex items-center gap-2">
                    <span>Masa del Agua Desalojada</span>
                    <Badge variant="outline" className="text-xs font-mono">M<sub>a</sub></Badge>
                  </Label>
                  <Input
                    id="masa_agua_desalojada"
                    type="number"
                    step="0.001"
                    value={formData.masa_agua_desalojada || ''}
                    onChange={(e) => handleInputChange('masa_agua_desalojada', e.target.value)}
                    className={errors.masa_agua_desalojada ? 'border-red-500' : ''}
                    placeholder="kg"
                  />
                  {errors.masa_agua_desalojada && (
                    <p className="text-sm text-red-600">{errors.masa_agua_desalojada}</p>
                  )}
                  <p className="text-xs text-gray-500">Masa del agua desalojada a razón de 1 dm³ por kg</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="porcentaje_absorcion_grava" className="flex items-center gap-2">
                    <span>Porcentaje de Absorción</span>
                    <Badge variant="outline" className="text-xs font-mono">%Abs</Badge>
                  </Label>
                  <Input
                    id="porcentaje_absorcion_grava"
                    type="number"
                    step="0.01"
                    value={formData.porcentaje_absorcion || ''}
                    onChange={(e) => handleInputChange('porcentaje_absorcion', e.target.value)}
                    className={errors.porcentaje_absorcion ? 'border-red-500' : ''}
                    placeholder="1.5"
                  />
                  {errors.porcentaje_absorcion && (
                    <p className="text-sm text-red-600">{errors.porcentaje_absorcion}</p>
                  )}
                  <p className="text-xs text-gray-500">% Absorción (necesario para calcular densidad seca)</p>
                </div>
              </div>
              
              {/* Mostrar el cálculo de Dr SSS */}
              {formData.masa_muestra_sss_grava && formData.masa_agua_desalojada && 
               formData.masa_muestra_sss_grava > 0 && formData.masa_agua_desalojada > 0 && (
                <div className="mt-4 p-4 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/30">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-[#069e2d]" />
                      <span className="font-medium text-[#069e2d]">Cálculos Intermedios:</span>
                    </div>
                    
                    {/* Cálculo Dr SSS */}
                    <div className="text-sm font-mono bg-white p-3 rounded border space-y-1">
                      <div className="font-semibold text-gray-700">Densidad Relativa SSS:</div>
                      <div>D<sub>r</sub> SSS = M<sub>ag</sub><sup>SSS</sup> / M<sub>a</sub></div>
                      <div>D<sub>r</sub> SSS = {formData.masa_muestra_sss_grava.toFixed(3)} / {formData.masa_agua_desalojada.toFixed(3)}</div>
                      <div className="text-[#069e2d] font-bold">
                        D<sub>r</sub> SSS = {(formData.masa_muestra_sss_grava / formData.masa_agua_desalojada).toFixed(3)} (adimensional)
                      </div>
                    </div>

                    {/* Cálculo Dr Seca si hay absorción */}
                    {formData.porcentaje_absorcion && formData.porcentaje_absorcion > 0 && (
                      <div className="text-sm font-mono bg-white p-3 rounded border space-y-1">
                        <div className="font-semibold text-gray-700">Densidad Relativa Seca:</div>
                        <div>D<sub>r</sub> seca = D<sub>r</sub> SSS / (1 + (%Abs/100))</div>
                        <div>D<sub>r</sub> seca = {(formData.masa_muestra_sss_grava / formData.masa_agua_desalojada).toFixed(3)} / (1 + ({formData.porcentaje_absorcion.toFixed(2)}/100))</div>
                        <div>D<sub>r</sub> seca = {(formData.masa_muestra_sss_grava / formData.masa_agua_desalojada).toFixed(3)} / {(1 + formData.porcentaje_absorcion/100).toFixed(4)}</div>
                        <div className="text-blue-600 font-bold">
                          D<sub>r</sub> seca = {((formData.masa_muestra_sss_grava / formData.masa_agua_desalojada) / (1 + formData.porcentaje_absorcion/100)).toFixed(3)} (adimensional)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
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
            {esArena ? (
              <>
                {/* RESULTADOS PARA ARENA */}
                {/* Masa específica SSS (Principal) */}
                <div className="flex justify-between items-center p-4 bg-[#069e2d]/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-[#069e2d]" />
                    <span className="font-medium text-[#069e2d]">Masa Específica S.S.S:</span>
                  </div>
                  <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                    {formData.densidad_relativa_sss.toFixed(3)} g/cm³
                  </Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Fórmula según NMX-C-165-ONNCCE-2020:</div>
                  <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                    <div><strong>M<sub>esss</sub> = S / (B + S - C)</strong></div>
                    <div className="text-gray-600 mt-1">Donde:</div>
                    <div>• M<sub>esss</sub> = Masa específica S.S.S (g/cm³)</div>
                    <div>• S = Masa de la muestra sat. y sup. Seco (g)</div>
                    <div>• B = Masa del picnómetro con agua (g)</div>
                    <div>• C = Masa del picnómetro con la muestra y agua (g)</div>
                  </div>
                  {formData.masa_muestra_sss && formData.masa_picnometro_agua && formData.masa_picnometro_muestra_agua && (
                    <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                      <strong>Cálculo:</strong> M<sub>esss</sub> = {formData.masa_muestra_sss.toFixed(2)} / ({formData.masa_picnometro_agua.toFixed(2)} + {formData.masa_muestra_sss.toFixed(2)} - {formData.masa_picnometro_muestra_agua.toFixed(2)}) = {formData.densidad_relativa_sss.toFixed(3)} g/cm³
                    </div>
                  )}
                </div>

                <Separator />

                {/* Masa específica seca */}
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Masa Específica (Seca):</span>
                  </div>
                  <Badge className="bg-blue-600 text-white text-xl px-4 py-2">
                    {formData.densidad_relativa_seca.toFixed(3)} g/cm³
                  </Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Fórmula:</div>
                  <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                    <div><strong>M<sub>es</sub> = M<sub>esss</sub> / (1 + (%Abs/100))</strong></div>
                    <div className="text-gray-600 mt-1">Donde:</div>
                    <div>• M<sub>es</sub> = Masa específica seca (g/cm³)</div>
                    <div>• M<sub>esss</sub> = Masa específica S.S.S (g/cm³)</div>
                    <div>• %Abs = Porcentaje de absorción</div>
                  </div>
                  {formData.porcentaje_absorcion && formData.porcentaje_absorcion > 0 && (
                    <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                      <strong>Cálculo:</strong> M<sub>es</sub> = {formData.densidad_relativa_sss.toFixed(3)} / (1 + ({formData.porcentaje_absorcion.toFixed(2)}/100)) = {formData.densidad_relativa_sss.toFixed(3)} / {(1 + formData.porcentaje_absorcion/100).toFixed(4)} = {formData.densidad_relativa_seca.toFixed(3)} g/cm³
                    </div>
                  )}
                </div>

                <Separator />

                {/* Absorción */}
                <div className="p-4 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-[#069e2d]" />
                      <span className="font-medium text-[#069e2d]">Porcentaje de Absorción:</span>
                    </div>
                    <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                      {formData.absorcion.toFixed(2)}%
                    </Badge>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* RESULTADOS PARA GRAVA */}
                {/* Densidad Relativa SSS (Principal) */}
                <div className="flex justify-between items-center p-4 bg-[#069e2d]/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-[#069e2d]" />
                    <span className="font-medium text-[#069e2d]">Densidad Relativa SSS (D<sub>r</sub> SSS):</span>
                  </div>
                  <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                    {formData.densidad_relativa_sss.toFixed(3)}
                  </Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Fórmula según NMX-C-164-ONNCCE-2014 (Ecuación 11):</div>
                  <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                    <div><strong>D<sub>r</sub> SSS = M<sub>ag</sub><sup>SSS</sup> / M<sub>a</sub></strong></div>
                    <div className="text-gray-600 mt-1">Donde:</div>
                    <div>• D<sub>r</sub> SSS = Densidad relativa saturada y superficialmente seca (adimensional)</div>
                    <div>• M<sub>ag</sub><sup>SSS</sup> = Masa de la muestra SSS en aire (kg)</div>
                    <div>• M<sub>a</sub> = Masa del agua desalojada a razón de 1 dm³ por kg</div>
                  </div>
                  {formData.masa_muestra_sss_grava && formData.masa_agua_desalojada && (
                    <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                      <strong>Cálculo:</strong> D<sub>r</sub> SSS = {formData.masa_muestra_sss_grava.toFixed(3)} / {formData.masa_agua_desalojada.toFixed(3)} = {formData.densidad_relativa_sss.toFixed(3)}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Densidad Relativa Seca */}
                {formData.porcentaje_absorcion && formData.porcentaje_absorcion > 0 ? (
                  <>
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Scale className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-800">Densidad Relativa Seca (D<sub>r</sub> seca):</span>
                      </div>
                      <Badge className="bg-blue-600 text-white text-xl px-4 py-2">
                        {formData.densidad_relativa_seca.toFixed(3)}
                      </Badge>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Fórmula:</div>
                      <div className="text-xs font-mono bg-white p-2 rounded border space-y-1">
                        <div><strong>D<sub>r</sub> seca = D<sub>r</sub> SSS / (1 + (%Abs/100))</strong></div>
                        <div className="text-gray-600 mt-1">Donde:</div>
                        <div>• D<sub>r</sub> seca = Densidad relativa seca (adimensional)</div>
                        <div>• D<sub>r</sub> SSS = Densidad relativa SSS (adimensional)</div>
                        <div>• %Abs = Porcentaje de absorción</div>
                      </div>
                      <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-800">
                        <strong>Cálculo:</strong> D<sub>r</sub> seca = {formData.densidad_relativa_sss.toFixed(3)} / (1 + ({formData.porcentaje_absorcion.toFixed(2)}/100)) = {formData.densidad_relativa_sss.toFixed(3)} / {(1 + formData.porcentaje_absorcion/100).toFixed(4)} = {formData.densidad_relativa_seca.toFixed(3)}
                      </div>
                    </div>

                    <Separator />

                    {/* Absorción */}
                    <div className="p-4 bg-[#069e2d]/10 rounded-lg border border-[#069e2d]/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Droplets className="h-5 w-5 text-[#069e2d]" />
                          <span className="font-medium text-[#069e2d]">Porcentaje de Absorción:</span>
                        </div>
                        <Badge className="bg-[#069e2d] text-white text-xl px-4 py-2">
                          {formData.absorcion.toFixed(2)}%
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Nota:</strong> Para calcular la densidad relativa seca, ingrese el porcentaje de absorción en el campo correspondiente.
                      El valor de absorción se puede obtener del estudio de absorción según la norma NMX-C-164-ONNCCE-2014.
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Nota:</strong> La densidad relativa SSS es un valor adimensional que representa la relación entre la masa de la muestra y el volumen de agua desplazada. 
                    Este valor es fundamental para el diseño de mezclas de concreto y para determinar la calidad del agregado grueso.
                  </AlertDescription>
                </Alert>
              </>
            )}

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
