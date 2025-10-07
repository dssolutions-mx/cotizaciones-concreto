'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Save, 
  Calculator, 
  BarChart3, 
  AlertCircle,
  Plus,
  Trash2,
  Info,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { caracterizacionService } from '@/services/caracterizacionService';
import CurvaGranulometrica from '../charts/CurvaGranulometrica';

interface MallaData {
  id: string;
  numero_malla: string;
  abertura_mm: number;
  peso_retenido: number | null;
  porcentaje_retenido: number;
  porcentaje_acumulado: number;
  porcentaje_pasa: number;
}

interface GranulometriaResultados {
  mallas: MallaData[];
  peso_muestra_inicial: number;
  peso_total_retenido: number;
  perdida_lavado: number;
  modulo_finura: number;
  tamaño_maximo_nominal: string;
  observaciones?: string;
}

interface GranulometriaFormProps {
  estudioId: string;
  initialData?: GranulometriaResultados;
  onSave: (data: GranulometriaResultados) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface EstudioInfo {
  tipo_material: 'Arena' | 'Grava';
  tamaño: string;
}

// Mallas estándar para análisis granulométrico
const MALLAS_ESTANDAR: Omit<MallaData, 'id' | 'peso_retenido' | 'porcentaje_retenido' | 'porcentaje_acumulado' | 'porcentaje_pasa'>[] = [
  { numero_malla: '3"', abertura_mm: 75.0 },
  { numero_malla: '2"', abertura_mm: 50.0 },
  { numero_malla: '1 1/2"', abertura_mm: 37.5 },
  { numero_malla: '1"', abertura_mm: 25.0 },
  { numero_malla: '3/4"', abertura_mm: 19.0 },
  { numero_malla: '1/2"', abertura_mm: 12.5 },
  { numero_malla: '3/8"', abertura_mm: 9.5 },
  { numero_malla: 'No. 4', abertura_mm: 4.75 },
  { numero_malla: 'No. 8', abertura_mm: 2.36 },
  { numero_malla: 'No. 16', abertura_mm: 1.18 },
  { numero_malla: 'No. 30', abertura_mm: 0.60 },
  { numero_malla: 'No. 50', abertura_mm: 0.30 },
  { numero_malla: 'No. 100', abertura_mm: 0.15 },
  { numero_malla: 'No. 200', abertura_mm: 0.075 },
  { numero_malla: 'Fondo', abertura_mm: 0.0 }
];

export default function GranulometriaForm({ 
  estudioId, 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false 
}: GranulometriaFormProps) {
  const [formData, setFormData] = useState<GranulometriaResultados>(() => {
    if (initialData) return initialData;
    
    return {
      mallas: MALLAS_ESTANDAR.map((malla, index) => ({
        id: `malla-${index}`,
        ...malla,
        peso_retenido: null,
        porcentaje_retenido: 0,
        porcentaje_acumulado: 0,
        porcentaje_pasa: 100
      })),
      peso_muestra_inicial: 0,
      peso_total_retenido: 0,
      perdida_lavado: 0,
      modulo_finura: 0,
      tamaño_maximo_nominal: '',
      observaciones: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estudioInfo, setEstudioInfo] = useState<EstudioInfo | null>(null);
  const [limites, setLimites] = useState<any[]>([]);
  const [tamañosDisponibles, setTamañosDisponibles] = useState<string[]>([]);
  const [selectedTamaño, setSelectedTamaño] = useState<string>('');
  const [loadingEstudio, setLoadingEstudio] = useState(true);
  const [loadingLimites, setLoadingLimites] = useState(false);

  // Cargar información del estudio al montar
  useEffect(() => {
    cargarInfoEstudio();
  }, [estudioId]);

  // Cargar límites cuando se selecciona un tamaño
  useEffect(() => {
    if (estudioInfo && selectedTamaño) {
      cargarLimites(estudioInfo.tipo_material, selectedTamaño);
    }
  }, [estudioInfo, selectedTamaño]);

  const cargarInfoEstudio = async () => {
    try {
      setLoadingEstudio(true);
      
      // Obtener el alta_estudio_id
      const { data: estudioData, error: estudioError } = await supabase
        .from('estudios_seleccionados')
        .select('alta_estudio_id')
        .eq('id', estudioId)
        .single();

      if (estudioError) {
        console.error('Error al obtener estudio seleccionado:', estudioError);
        throw new Error('No se pudo obtener el estudio seleccionado');
      }

      // Obtener información del alta_estudio
      const { data: altaData, error: altaError } = await supabase
        .from('alta_estudio')
        .select('tipo_material, tamaño')
        .eq('id', estudioData.alta_estudio_id)
        .single();

      if (altaError) {
        console.error('Error al obtener alta_estudio:', altaError);
        throw new Error('No se pudo obtener información del estudio');
      }

      setEstudioInfo({
        tipo_material: altaData.tipo_material,
        tamaño: altaData.tamaño || ''
      });

      // Cargar tamaños disponibles primero
      try {
        const tamaños = await caracterizacionService.getTamañosDisponibles(altaData.tipo_material);
        setTamañosDisponibles(tamaños);
        
        if (tamaños.length === 0) {
          toast.warning(`No se encontraron tamaños disponibles para ${altaData.tipo_material}`);
        } else {
          // Si ya tiene un tamaño definido y existe en los disponibles, cargarlo
          if (altaData.tamaño && tamaños.includes(altaData.tamaño)) {
            setSelectedTamaño(altaData.tamaño);
          }
        }
      } catch (error: any) {
        console.error('Error al cargar tamaños disponibles:', error);
        toast.error(error?.message || 'Error al cargar tamaños disponibles');
        setTamañosDisponibles([]);
      }

    } catch (error: any) {
      console.error('Error cargando info del estudio:', error);
      toast.error(error?.message || 'Error al cargar información del estudio');
    } finally {
      setLoadingEstudio(false);
    }
  };

  const cargarLimites = async (tipoMaterial: 'Arena' | 'Grava', tamaño: string) => {
    try {
      setLoadingLimites(true);
      const limitesData = await caracterizacionService.getLimitesGranulometricos(tipoMaterial, tamaño);
      
      if (limitesData && limitesData.mallas) {
        setLimites(limitesData.mallas);
      } else {
        setLimites([]);
        toast.info('No se encontraron límites granulométricos para este tamaño');
      }
    } catch (error) {
      console.error('Error cargando límites:', error);
      setLimites([]);
    } finally {
      setLoadingLimites(false);
    }
  };

  const handleTamañoChange = async (tamaño: string) => {
    setSelectedTamaño(tamaño);
    
    // Actualizar el tamaño en alta_estudio si es necesario
    try {
      const { data: estudioData } = await supabase
        .from('estudios_seleccionados')
        .select('alta_estudio_id')
        .eq('id', estudioId)
        .single();

      if (estudioData) {
        await supabase
          .from('alta_estudio')
          .update({ tamaño: tamaño })
          .eq('id', estudioData.alta_estudio_id);
      }
    } catch (error) {
      console.error('Error actualizando tamaño:', error);
    }
  };

  // Normalizar nombre de malla para comparación
  const normalizarNombreMalla = (nombre: string): string => {
    return nombre
      .replace(/No\.\s*/g, '')  // Eliminar "No. " o "No."
      .replace(/"/g, '')         // Eliminar comillas
      .replace(/\s+/g, '')       // Eliminar espacios
      .trim()
      .toLowerCase();
  };

  // Filtrar mallas relevantes según los límites cargados
  const getMallasRelevantes = () => {
    if (limites.length === 0) {
      // Si no hay límites, mostrar todas las mallas estándar
      return formData.mallas;
    }

    // Crear mapa de mallas con límites (normalizado)
    const mallasConLimitesMap = new Map<string, any>();
    limites.forEach(limite => {
      const mallaLimpia = normalizarNombreMalla(limite.malla);
      mallasConLimitesMap.set(mallaLimpia, limite);
    });

    // Filtrar solo las mallas que están en los límites
    return formData.mallas.filter(malla => {
      const nombreNormalizado = normalizarNombreMalla(malla.numero_malla);
      return mallasConLimitesMap.has(nombreNormalizado);
    });
  };

  const calcularPorcentajes = (mallas: MallaData[], pesoMuestraInicial: number) => {
    if (pesoMuestraInicial <= 0) {
      return {
        mallas,
        peso_total_retenido: 0,
        perdida_lavado: 0,
        modulo_finura: 0,
        tamaño_maximo_nominal: ''
      };
    }

    // Calcular peso total retenido
    const pesoTotalRetenido = mallas.reduce((sum, malla) => 
      sum + (malla.peso_retenido || 0), 0
    );

    // Calcular porcentajes
    let acumulado = 0;
    const mallasActualizadas = mallas.map(malla => {
      const pesoRetenido = malla.peso_retenido || 0;
      const porcentajeRetenido = pesoMuestraInicial > 0 
        ? (pesoRetenido / pesoMuestraInicial) * 100 
        : 0;
      
      acumulado += porcentajeRetenido;
      
      return {
        ...malla,
        porcentaje_retenido: Number(porcentajeRetenido.toFixed(2)),
        porcentaje_acumulado: Number(acumulado.toFixed(2)),
        porcentaje_pasa: Number((100 - acumulado).toFixed(2))
      };
    });

    // Calcular módulo de finura (suma de porcentajes acumulados retenidos en mallas estándar / 100)
    const mallasParaModulo = ['No. 4', 'No. 8', 'No. 16', 'No. 30', 'No. 50', 'No. 100'];
    const sumaAcumulados = mallasActualizadas
      .filter(malla => mallasParaModulo.includes(malla.numero_malla))
      .reduce((sum, malla) => sum + malla.porcentaje_acumulado, 0);
    
    const moduloFinura = sumaAcumulados / 100;

    // Determinar tamaño máximo nominal
    const tamañoMaximo = mallasActualizadas.find(malla => 
      malla.porcentaje_retenido > 0 && malla.numero_malla !== 'Fondo'
    )?.numero_malla || '';

    // Calcular pérdida por lavado
    const perdidaLavado = pesoMuestraInicial - pesoTotalRetenido;

    return {
      mallas: mallasActualizadas,
      peso_total_retenido: Number(pesoTotalRetenido.toFixed(2)),
      perdida_lavado: Number(perdidaLavado.toFixed(2)),
      modulo_finura: Number(moduloFinura.toFixed(2)),
      tamaño_maximo_nominal: tamañoMaximo
    };
  };

  const handlePesoMuestraChange = (value: string) => {
    const peso = parseFloat(value) || 0;
    setFormData(prev => {
      const calculated = calcularPorcentajes(prev.mallas, peso);
      return {
        ...prev,
        peso_muestra_inicial: peso,
        ...calculated
      };
    });
  };

  const handlePesoRetenidoChange = (mallaId: string, value: string) => {
    const peso = value === '' ? null : parseFloat(value) || 0;
    setFormData(prev => {
      const mallasActualizadas = prev.mallas.map(malla =>
        malla.id === mallaId 
          ? { ...malla, peso_retenido: peso }
          : malla
      );
      const calculated = calcularPorcentajes(mallasActualizadas, prev.peso_muestra_inicial);
      return {
        ...prev,
        ...calculated
      };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.peso_muestra_inicial <= 0) {
      newErrors.peso_muestra_inicial = 'El peso de la muestra inicial debe ser mayor a 0';
    }

    // Validar que se haya seleccionado un tamaño si hay tamaños disponibles
    if (tamañosDisponibles.length > 0 && !selectedTamaño) {
      newErrors.tamaño = 'Debe seleccionar un tamaño para comparar con los límites granulométricos';
      toast.error('Por favor seleccione un tamaño antes de guardar');
    }

    const pesosTotales = formData.mallas.reduce((sum, malla) => 
      sum + (malla.peso_retenido || 0), 0
    );

    if (pesosTotales > formData.peso_muestra_inicial) {
      newErrors.pesos_retenidos = 'La suma de pesos retenidos no puede ser mayor al peso inicial';
    }

    const tieneAlgunPeso = formData.mallas.some(malla => 
      malla.peso_retenido !== null && malla.peso_retenido > 0
    );

    if (!tieneAlgunPeso) {
      newErrors.pesos_retenidos = 'Debe ingresar al menos un peso retenido';
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
      toast.success('Análisis granulométrico guardado exitosamente');
    } catch (error) {
      console.error('Error saving granulometria:', error);
      toast.error('Error al guardar el análisis granulométrico');
    } finally {
      setSaving(false);
    }
  };

  if (loadingEstudio) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#069e2d]" />
        <span className="ml-3 text-gray-600">Cargando información del estudio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#069e2d]" />
            Análisis Granulométrico
            {estudioInfo && (
              <Badge variant="outline" className="ml-2">
                {estudioInfo.tipo_material}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Norma:</strong> ASTM C136 / NMX-C-077 - Determinación de la distribución de tamaños de partículas
            </AlertDescription>
          </Alert>

          {/* Selector de Tamaño - Destacado */}
          {estudioInfo && tamañosDisponibles.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="tamaño" className="text-base font-semibold text-amber-900">
                    Selector de Tamaño de Comparación *
                  </Label>
                  <p className="text-sm text-amber-700">
                    Este tamaño se utilizará para comparar los resultados con los límites estándar
                  </p>
                  
                  <Select 
                    value={selectedTamaño} 
                    onValueChange={handleTamañoChange}
                    disabled={loadingLimites}
                  >
                    <SelectTrigger className={`mt-2 ${errors.tamaño ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Seleccionar tamaño para comparación" />
                    </SelectTrigger>
                    <SelectContent>
                      {tamañosDisponibles.map((tamaño) => (
                        <SelectItem key={tamaño} value={tamaño}>
                          {tamaño}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {errors.tamaño && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.tamaño}
                    </p>
                  )}
                  
                  {loadingLimites && (
                    <p className="text-sm text-amber-700 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando límites granulométricos...
                    </p>
                  )}
                  
                  {selectedTamaño && limites.length > 0 && !loadingLimites && (
                    <p className="text-sm text-green-700 flex items-center gap-2 font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Límites granulométricos cargados para {selectedTamaño}
                    </p>
                  )}
                  
                  {selectedTamaño && limites.length === 0 && !loadingLimites && (
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      No se encontraron límites granulométricos para este tamaño
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datos Iniciales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos de la Muestra</CardTitle>
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
                onChange={(e) => handlePesoMuestraChange(e.target.value)}
                className={errors.peso_muestra_inicial ? 'border-red-500' : ''}
              />
              {errors.peso_muestra_inicial && (
                <p className="text-sm text-red-600">{errors.peso_muestra_inicial}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Peso Total Retenido (g)</Label>
              <Input
                value={formData.peso_total_retenido}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Pérdida por Lavado (g)</Label>
              <Input
                value={formData.perdida_lavado}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          {errors.pesos_retenidos && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-600">
                {errors.pesos_retenidos}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabla de Mallas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Análisis por Mallas</span>
            {selectedTamaño && limites.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Mostrando {getMallasRelevantes().length} de {formData.mallas.length} mallas
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTamaño && limites.length > 0 && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Se muestran todas las mallas disponibles para <strong>{selectedTamaño}</strong>. 
                Ingrese los pesos retenidos solo en las mallas que utilizó durante el ensayo.
                La gráfica mostrará únicamente las mallas con datos cargados.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malla</TableHead>
                  <TableHead>Abertura (mm)</TableHead>
                  <TableHead>Peso Retenido (g)</TableHead>
                  <TableHead>% Retenido</TableHead>
                  <TableHead>% Acumulado</TableHead>
                  <TableHead>% Pasa</TableHead>
                  {limites.length > 0 && (
                    <>
                      <TableHead className="text-center">Lím. Inf.</TableHead>
                      <TableHead className="text-center">Lím. Sup.</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getMallasRelevantes().map((malla) => {
                  // Buscar límite correspondiente usando normalización
                  const nombreMallaNormalizado = normalizarNombreMalla(malla.numero_malla);
                  const limite = limites.find(l => 
                    normalizarNombreMalla(l.malla) === nombreMallaNormalizado
                  );

                  // Verificar si está dentro de los límites
                  const dentroLimites = limite ? 
                    (malla.porcentaje_pasa >= limite.limite_inferior && 
                     malla.porcentaje_pasa <= limite.limite_superior) : 
                    true;

                  return (
                    <TableRow 
                      key={malla.id}
                      className={
                        limite && malla.peso_retenido !== null && !dentroLimites
                          ? 'bg-red-50'
                          : limite && malla.peso_retenido !== null && dentroLimites
                          ? 'bg-green-50'
                          : ''
                      }
                    >
                      <TableCell className="font-medium">
                        {malla.numero_malla}
                      </TableCell>
                      <TableCell>
                        {malla.abertura_mm > 0 ? malla.abertura_mm : '-'}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={malla.peso_retenido || ''}
                          onChange={(e) => handlePesoRetenidoChange(malla.id, e.target.value)}
                          className="w-24"
                          placeholder="0.0"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {malla.porcentaje_retenido.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {malla.porcentaje_acumulado.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            limite && malla.peso_retenido !== null
                              ? dentroLimites ? "default" : "destructive"
                              : "secondary"
                          }
                        >
                          {malla.porcentaje_pasa.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      {limites.length > 0 && (
                        <>
                          <TableCell className="text-center text-sm text-blue-600">
                            {limite ? `${limite.limite_inferior}%` : '-'}
                          </TableCell>
                          <TableCell className="text-center text-sm text-red-600">
                            {limite ? `${limite.limite_superior}%` : '-'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Curva Granulométrica */}
      {estudioInfo && formData.peso_muestra_inicial > 0 && (
        <CurvaGranulometrica 
          mallas={formData.mallas}
          limites={limites}
          tipoMaterial={estudioInfo.tipo_material}
          tamaño={selectedTamaño}
        />
      )}

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
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-[#069e2d]/10 rounded-lg">
                <span className="font-medium text-[#069e2d]">Módulo de Finura:</span>
                <Badge className="bg-[#069e2d] text-white">
                  {formData.modulo_finura.toFixed(2)}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-[#069e2d]/10 rounded-lg">
                <span className="font-medium text-[#069e2d]">Tamaño Máximo Nominal:</span>
                <Badge className="bg-[#069e2d] text-white">
                  {formData.tamaño_maximo_nominal || 'N/A'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Observaciones adicionales del análisis..."
                rows={4}
              />
            </div>
          </div>
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
