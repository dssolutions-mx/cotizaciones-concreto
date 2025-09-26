'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  Info
} from 'lucide-react';
import { toast } from 'sonner';

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

  // Calcular automáticamente los porcentajes cuando cambian los pesos
  useEffect(() => {
    calcularPorcentajes();
  }, [formData.peso_muestra_inicial, formData.mallas]);

  const calcularPorcentajes = () => {
    const { peso_muestra_inicial, mallas } = formData;
    
    if (peso_muestra_inicial <= 0) return;

    // Calcular peso total retenido
    const pesoTotalRetenido = mallas.reduce((sum, malla) => 
      sum + (malla.peso_retenido || 0), 0
    );

    // Calcular porcentajes
    let acumulado = 0;
    const mallasActualizadas = mallas.map(malla => {
      const pesoRetenido = malla.peso_retenido || 0;
      const porcentajeRetenido = peso_muestra_inicial > 0 
        ? (pesoRetenido / peso_muestra_inicial) * 100 
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
    const perdidaLavado = peso_muestra_inicial - pesoTotalRetenido;

    setFormData(prev => ({
      ...prev,
      mallas: mallasActualizadas,
      peso_total_retenido: Number(pesoTotalRetenido.toFixed(2)),
      perdida_lavado: Number(perdidaLavado.toFixed(2)),
      modulo_finura: Number(moduloFinura.toFixed(2)),
      tamaño_maximo_nominal: tamañoMaximo
    }));
  };

  const handlePesoMuestraChange = (value: string) => {
    const peso = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      peso_muestra_inicial: peso
    }));
  };

  const handlePesoRetenidoChange = (mallaId: string, value: string) => {
    const peso = value === '' ? null : parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      mallas: prev.mallas.map(malla =>
        malla.id === mallaId 
          ? { ...malla, peso_retenido: peso }
          : malla
      )
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.peso_muestra_inicial <= 0) {
      newErrors.peso_muestra_inicial = 'El peso de la muestra inicial debe ser mayor a 0';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Análisis Granulométrico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Norma:</strong> ASTM C136 / NMX-C-077 - Determinación de la distribución de tamaños de partículas
            </AlertDescription>
          </Alert>
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
          <CardTitle className="text-lg">Análisis por Mallas</CardTitle>
        </CardHeader>
        <CardContent>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.mallas.map((malla) => (
                  <TableRow key={malla.id}>
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
                      <Badge variant="secondary">
                        {malla.porcentaje_pasa.toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-900">Módulo de Finura:</span>
                <Badge className="bg-blue-600 text-white">
                  {formData.modulo_finura.toFixed(2)}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium text-green-900">Tamaño Máximo Nominal:</span>
                <Badge className="bg-green-600 text-white">
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
