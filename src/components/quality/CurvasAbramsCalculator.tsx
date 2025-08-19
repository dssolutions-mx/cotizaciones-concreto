'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, Info, AlertTriangle, Save, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AbramsCalculation {
  targetStrength: number;
  waterCementRatio: number;
  cementContent: number;
  waterContent: number;
  efficiency: number;
  slump: number;
  aggregateContent: number;
}

interface MaterialData {
  id: string;
  material_name: string;
  category: string;
  density?: number;
}

interface CurvasAbramsCalculatorProps {
  onCalculationComplete?: (result: AbramsCalculation) => void;
}

export default function CurvasAbramsCalculator({ onCalculationComplete }: CurvasAbramsCalculatorProps) {
  // Estados para parámetros de entrada
  const [targetStrength, setTargetStrength] = useState<number>(250);
  const [cementType, setCementType] = useState<string>('CPC-30');
  const [aggregateType, setAggregateType] = useState<string>('basaltic');
  const [age, setAge] = useState<number>(28);
  const [slumpTarget, setSlumpTarget] = useState<number>(10);
  const [exposureCondition, setExposureCondition] = useState<string>('normal');
  
  // Estados para materiales disponibles
  const [availableCements, setAvailableCements] = useState<MaterialData[]>([]);
  const [availableAggregates, setAvailableAggregates] = useState<MaterialData[]>([]);
  
  // Estados para resultados
  const [calculationResult, setCalculationResult] = useState<AbramsCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar materiales disponibles desde la base de datos
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        // Cargar cementos
        const { data: cementsData } = await supabase
          .from('materials')
          .select('id, material_name, category, density')
          .eq('category', 'cemento')
          .eq('is_active', true);

        if (cementsData) {
          setAvailableCements(cementsData);
        }

        // Cargar agregados
        const { data: aggregatesData } = await supabase
          .from('materials')
          .select('id, material_name, category, density')
          .in('category', ['agregado_grueso', 'agregado_fino'])
          .eq('is_active', true);

        if (aggregatesData) {
          setAvailableAggregates(aggregatesData);
        }
      } catch (err) {
        console.error('Error loading materials:', err);
      }
    };

    loadMaterials();
  }, []);

  // Función principal de cálculo usando la ley de Abrams
  const calculateAbramsRelation = () => {
    if (!targetStrength || targetStrength <= 0) {
      setError('Ingresa una resistencia objetivo válida');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Constantes de Abrams según tipo de cemento y agregado
      const getAbramsConstants = (cement: string, aggregate: string) => {
        const baseConstants = {
          'CPC-30': { A: 400, B: 7.5 },
          'CPC-40': { A: 450, B: 7.8 },
          'CPC-50': { A: 500, B: 8.0 },
          'CPO': { A: 380, B: 7.2 }
        };

        const aggregateFactors = {
          'basaltic': 1.0,
          'volcanic': 0.95,
          'limestone': 0.90,
          'river': 0.85
        };

        const base = baseConstants[cement as keyof typeof baseConstants] || baseConstants['CPC-30'];
        const factor = aggregateFactors[aggregate as keyof typeof aggregateFactors] || 1.0;

        return {
          A: base.A * factor,
          B: base.B
        };
      };

      const { A, B } = getAbramsConstants(cementType, aggregateType);

      // Aplicar factor de edad
      const ageFactors = {
        7: 0.75,
        14: 0.90,
        28: 1.0,
        56: 1.15,
        90: 1.25
      };

      const ageFactor = ageFactors[age as keyof typeof ageFactors] || 1.0;
      const adjustedTargetStrength = targetStrength / ageFactor;

      // Calcular relación agua/cemento usando la fórmula de Abrams: f'c = A / (B^(w/c))
      // Despejando: w/c = log(A/f'c) / log(B)
      const waterCementRatio = Math.log(A / adjustedTargetStrength) / Math.log(B);

      // Validar que la relación esté en un rango práctico
      if (waterCementRatio < 0.25 || waterCementRatio > 0.8) {
        throw new Error('La resistencia objetivo resulta en una relación a/c fuera del rango práctico (0.25-0.8)');
      }

      // Calcular contenidos de materiales
      let cementContent = 350; // Base kg/m³
      
      // Ajustar contenido de cemento según condiciones de exposición
      const exposureFactors = {
        'normal': 1.0,
        'marine': 1.2,
        'sulfate': 1.15,
        'freeze_thaw': 1.1
      };
      
      cementContent *= exposureFactors[exposureCondition as keyof typeof exposureFactors] || 1.0;

      // Ajustar por trabajabilidad (slump)
      if (slumpTarget > 15) {
        cementContent *= 1.05; // Más cemento para alta trabajabilidad
      } else if (slumpTarget < 5) {
        cementContent *= 0.95; // Menos cemento para baja trabajabilidad
      }

      const waterContent = cementContent * waterCementRatio;
      const efficiency = targetStrength / cementContent;
      
      // Estimar contenido de agregados (simplificado)
      const aggregateContent = 1900 - cementContent - waterContent; // kg/m³

      const result: AbramsCalculation = {
        targetStrength,
        waterCementRatio: parseFloat(waterCementRatio.toFixed(3)),
        cementContent: parseFloat(cementContent.toFixed(1)),
        waterContent: parseFloat(waterContent.toFixed(1)),
        efficiency: parseFloat(efficiency.toFixed(2)),
        slump: slumpTarget,
        aggregateContent: parseFloat(aggregateContent.toFixed(1))
      };

      setCalculationResult(result);
      onCalculationComplete?.(result);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en el cálculo');
    } finally {
      setLoading(false);
    }
  };

  // Función para guardar el cálculo como una nueva receta
  const saveAsRecipe = async () => {
    if (!calculationResult) return;

    try {
      setLoading(true);
      
      // Aquí iría la lógica para guardar en la base de datos
      // Por ahora, solo mostrar un mensaje
      alert('Funcionalidad de guardado en desarrollo. Los cálculos se pueden exportar manualmente.');
      
    } catch (err) {
      setError('Error al guardar la receta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Panel de Parámetros de Entrada */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Parámetros de Diseño
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Resistencia Objetivo */}
            <div className="space-y-2">
              <Label htmlFor="target-strength">Resistencia Objetivo (kg/cm²)</Label>
              <Input
                id="target-strength"
                type="number"
                value={targetStrength}
                onChange={(e) => setTargetStrength(parseFloat(e.target.value) || 0)}
                placeholder="Ej: 250"
                min="50"
                max="800"
                step="5"
              />
            </div>

            {/* Tipo de Cemento */}
            <div className="space-y-2">
              <Label htmlFor="cement-type">Tipo de Cemento</Label>
              <Select value={cementType} onValueChange={setCementType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cemento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPC-30">CPC 30</SelectItem>
                  <SelectItem value="CPC-40">CPC 40</SelectItem>
                  <SelectItem value="CPC-50">CPC 50</SelectItem>
                  <SelectItem value="CPO">CPO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Agregado */}
            <div className="space-y-2">
              <Label htmlFor="aggregate-type">Tipo de Agregado</Label>
              <Select value={aggregateType} onValueChange={setAggregateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agregado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basaltic">Basáltico</SelectItem>
                  <SelectItem value="volcanic">Volcánico</SelectItem>
                  <SelectItem value="limestone">Calizo</SelectItem>
                  <SelectItem value="river">Río</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Edad de Ensayo */}
            <div className="space-y-2">
              <Label htmlFor="age">Edad de Ensayo (días)</Label>
              <Select value={age.toString()} onValueChange={(value) => setAge(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar edad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="14">14 días</SelectItem>
                  <SelectItem value="28">28 días</SelectItem>
                  <SelectItem value="56">56 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Revenimiento Objetivo */}
            <div className="space-y-2">
              <Label htmlFor="slump-target">Revenimiento Objetivo (cm)</Label>
              <Input
                id="slump-target"
                type="number"
                value={slumpTarget}
                onChange={(e) => setSlumpTarget(parseFloat(e.target.value) || 0)}
                placeholder="Ej: 10"
                min="0"
                max="25"
                step="1"
              />
            </div>

            {/* Condiciones de Exposición */}
            <div className="space-y-2">
              <Label htmlFor="exposure">Condiciones de Exposición</Label>
              <Select value={exposureCondition} onValueChange={setExposureCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar exposición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="marine">Ambiente Marino</SelectItem>
                  <SelectItem value="sulfate">Sulfatos</SelectItem>
                  <SelectItem value="freeze_thaw">Hielo-Deshielo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 mt-6">
            <Button 
              onClick={calculateAbramsRelation} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading || !targetStrength || targetStrength <= 0}
            >
              {loading ? (
                <>
                  <Calculator className="w-4 h-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular Dosificación
                </>
              )}
            </Button>

            {calculationResult && (
              <Button 
                onClick={saveAsRecipe}
                variant="outline"
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar como Receta
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panel de Resultados */}
      {calculationResult && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <TrendingUp className="h-5 w-5" />
              Resultados del Cálculo
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{cementType}</Badge>
              <Badge variant="outline">{aggregateType}</Badge>
              <Badge variant="outline">{age} días</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Relación a/c */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-blue-600 font-medium">Relación a/c</div>
                <div className="text-3xl font-bold text-blue-900">
                  {calculationResult.waterCementRatio.toFixed(3)}
                </div>
                <div className="text-xs text-blue-600">Agua/Cemento</div>
              </div>
              
              {/* Eficiencia */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-green-600 font-medium">Eficiencia</div>
                <div className="text-3xl font-bold text-green-900">
                  {calculationResult.efficiency.toFixed(2)}
                </div>
                <div className="text-xs text-green-600">kg/cm² por kg cemento</div>
              </div>

              {/* Contenido de Cemento */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-amber-600 font-medium">Cemento</div>
                <div className="text-3xl font-bold text-amber-900">
                  {calculationResult.cementContent}
                </div>
                <div className="text-xs text-amber-600">kg/m³</div>
              </div>

              {/* Contenido de Agua */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-cyan-600 font-medium">Agua</div>
                <div className="text-3xl font-bold text-cyan-900">
                  {calculationResult.waterContent.toFixed(1)}
                </div>
                <div className="text-xs text-cyan-600">L/m³</div>
              </div>
            </div>

            {/* Dosificación Detallada */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-800 mb-4">Dosificación Recomendada por m³</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Cemento ({cementType}):</span>
                    <span className="font-semibold">{calculationResult.cementContent} kg</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Agua:</span>
                    <span className="font-semibold">{calculationResult.waterContent.toFixed(1)} L</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Agregados (total):</span>
                    <span className="font-semibold">{calculationResult.aggregateContent} kg</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-blue-600">Resistencia Esperada:</span>
                    <span className="font-semibold text-blue-900">{calculationResult.targetStrength} kg/cm²</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-green-600">Revenimiento Objetivo:</span>
                    <span className="font-semibold text-green-900">{calculationResult.slump} cm</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="text-purple-600">Edad de Ensayo:</span>
                    <span className="font-semibold text-purple-900">{age} días</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recomendaciones */}
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Recomendaciones:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Validar la trabajabilidad con ensayos de revenimiento</li>
                  <li>• Realizar ensayos de resistencia para confirmar los resultados</li>
                  <li>• Considerar aditivos si la relación a/c es muy baja</li>
                  <li>• Ajustar según condiciones climáticas locales</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Panel de Información Técnica */}
      <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <FileText className="h-5 w-5" />
            Fundamentos de las Curvas de Abrams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Ley de Abrams</h4>
              <p className="text-slate-600 text-sm mb-3">
                La resistencia del concreto es inversamente proporcional a la relación agua/cemento, 
                siempre que la mezcla sea completamente compactada.
              </p>
              <div className="bg-white p-3 rounded border text-center">
                <code className="text-blue-600 font-mono">f'c = A / (B^(w/c))</code>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Factores que Influyen</h4>
              <ul className="text-slate-600 text-sm space-y-1">
                <li>• <strong>Tipo y calidad del cemento</strong></li>
                <li>• <strong>Características de los agregados</strong></li>
                <li>• <strong>Edad del concreto</strong></li>
                <li>• <strong>Condiciones de curado</strong></li>
                <li>• <strong>Método de compactación</strong></li>
                <li>• <strong>Condiciones ambientales</strong></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
