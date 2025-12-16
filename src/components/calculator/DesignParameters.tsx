import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Droplets, FlaskRound } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DesignParams, RecipeParams, Materials, DesignType, WaterQuantities } from '@/types/calculator';
import { AGGREGATE_SIZES, AIR_CONTENTS, FC_STRENGTHS, MR_STRENGTHS } from '@/lib/calculator/constants';
import { getCementRangeCompletionStatus, getStandardDeviationForStrength } from '@/lib/calculator/calculations';
import { CONCRETE_TYPES, ConcreteTypeCode } from '@/config/concreteTypes';

interface DesignParametersProps {
  designType: DesignType;
  designParams: DesignParams;
  recipeParams: RecipeParams;
  materials: Materials;
  concreteType: ConcreteTypeCode;
  typeCode: string;
  numSeg: string;
  variante: string;
  enablePceAutoDetection: boolean;
  onDesignTypeChange: (type: DesignType) => void;
  onDesignParamsChange: (params: Partial<DesignParams>) => void;
  onRecipeParamsChange: (params: Partial<RecipeParams>) => void;
  onConcreteTypeChange: (type: ConcreteTypeCode) => void;
  onTypeCodeChange: (code: string) => void;
  onNumSegChange: (value: string) => void;
  onVarianteChange: (value: string) => void;
  onEnablePceAutoDetectionChange: (enabled: boolean) => void;
  onCombinationChange: (index: number, value: string, type: string) => void;
  onWaterDefinitionChange: (index: number, field: string, value: any) => void;
  onAdditiveSystemConfigChange: (field: string, value: any) => void;
  onAdditiveRuleChange: (ruleIndex: number, field: string, value: any) => void;
  onAddAdditiveRule: () => void;
  onRemoveAdditiveRule: (ruleIndex: number) => void;
}

export const DesignParameters: React.FC<DesignParametersProps> = ({
  designType,
  designParams,
  recipeParams,
  materials,
  concreteType,
  typeCode,
  numSeg,
  variante,
  enablePceAutoDetection,
  onDesignTypeChange,
  onDesignParamsChange,
  onRecipeParamsChange,
  onConcreteTypeChange,
  onTypeCodeChange,
  onNumSegChange,
  onVarianteChange,
  onEnablePceAutoDetectionChange,
  onCombinationChange,
  onWaterDefinitionChange,
  onAdditiveSystemConfigChange,
  onAdditiveRuleChange,
  onAddAdditiveRule,
  onRemoveAdditiveRule
}) => {
  // Debounced validation state to avoid constant error messages while typing
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Local state for standard deviation inputs to allow empty values while editing
  const [stdDevInputValues, setStdDevInputValues] = useState<Record<number, string>>({});

  // Debounce validation errors - only show after user stops typing for 1.5 seconds
  useEffect(() => {
    // Clear existing timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      setShowValidationErrors(true);
    }, 1500); // 1.5 second delay

    setValidationTimer(timer);

    // Cleanup on unmount
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [recipeParams.additiveSystemConfig]); // Re-run when additive config changes

  // Reset validation display when user starts making changes
  const handleUserInteraction = () => {
    setShowValidationErrors(false);
  };
  const renderWaterQuantityInputs = (quantities: WaterQuantities, type: 'TD' | 'BOMB') => {
    const slumps = designType === 'FC' ? ['10', '14', '18'] : ['8', '10', '14'];
    
    // Only show placement type that matches the current type
    const placementLetter = type === 'TD' ? 'D' : 'B';
    const placementName = type === 'TD' ? 'Directo' : 'Bombeo';

    return (
      <div className="grid grid-cols-1 gap-3">
        {slumps.map(slump => {
          const key = `${slump}${placementLetter}`;
          
          return (
            <div key={key} className="bg-white p-3 rounded border">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor={`water-${type}-${key}`} className="text-sm font-medium">
                    {slump}cm - {placementName}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id={`water-${type}-${key}`}
                      type="number"
                      value={quantities[key] || 0}
                      onChange={(e) => {
                        const newQuantities = { ...quantities, [key]: parseFloat(e.target.value) || 0 };
                        onRecipeParamsChange({
                          [type === 'TD' ? 'waterQuantitiesTD' : 'waterQuantitiesBomb']: newQuantities
                        });
                      }}
                      min="100"
                      max="300"
                      step="5"
                      className="h-8 w-20"
                      placeholder="180"
                    />
                    <span className="text-sm text-gray-600">L/m³</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${type === 'TD' ? 'bg-blue-400' : 'bg-orange-400'}`}
                        style={{ width: `${Math.min((quantities[key] || 0) / 300 * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCombinationInputs = (type: 'sand' | 'gravel', placement: 'TD' | 'Bomb') => {
    const materials_list = type === 'sand' ? materials.sands : materials.gravels;
    const combination = type === 'sand' 
      ? (placement === 'TD' ? designParams.sandCombinationTD : designParams.sandCombinationBomb)
      : (placement === 'TD' ? designParams.gravelCombinationTD : designParams.gravelCombinationBomb);

    const total = combination.reduce((sum, val) => sum + val, 0);
    const typeIcon = type === 'sand' ? '🟡' : '⚫';
    const placementIcon = placement === 'TD' ? '🚛' : '🔀';

    return (
      <div className="space-y-3">
        <div className={`p-3 rounded-lg ${type === 'sand' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
          <h5 className="font-medium text-sm mb-1">
            {typeIcon} {type === 'sand' ? 'Agregado Fino' : 'Agregado Grueso'} - {placementIcon} {placement === 'TD' ? 'Tiro Directo' : 'Bombeo'}
          </h5>
          <p className="text-xs text-gray-600">
            Combinando {materials_list.length} material{materials_list.length > 1 ? 'es' : ''}: {materials_list.map(m => m.name).join(', ')}
          </p>
        </div>
        
        {materials_list.map((material, index) => (
          <div key={material.id} className="bg-white p-3 rounded border">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label htmlFor={`${type}-${placement}-${index}`} className="text-sm font-medium">
                  {material.name}
                </Label>
                <div className="text-xs text-gray-500 mb-2">
                  ID: {material.id} | Densidad: {material.density || 'N/A'} g/cm³
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`${type}-${placement}-${index}`}
                    type="number"
                    value={combination[index] || 0}
                    onChange={(e) => onCombinationChange(index, e.target.value, `${type}${placement}`)}
                    min="0"
                    max="100"
                    step="0.1"
                    className="h-8"
                  />
                  <span className="text-sm text-gray-600 min-w-[20px]">%</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${type === 'sand' ? 'bg-yellow-400' : 'bg-gray-600'}`}
                      style={{ width: `${Math.min(combination[index] || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <div className="pt-2 border-t bg-gray-50 p-3 rounded">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total de la combinación:</span>
            <span className={`text-lg font-bold ${Math.abs(total - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              {total.toFixed(1)}%
            </span>
          </div>
          {Math.abs(total - 100) >= 0.01 && (
            <div className="mt-2 p-2 bg-red-50 rounded border-l-4 border-red-400">
              <p className="text-xs text-red-700 font-medium">
                ⚠️ La suma debe ser exactamente 100%. Ajusta los porcentajes.
              </p>
            </div>
          )}
          {Math.abs(total - 100) < 0.01 && (
            <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
              <p className="text-xs text-green-700 font-medium">
                ✅ Combinación balanceada correctamente.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Design Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tipo de Diseño
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={designType} onValueChange={(value) => onDesignTypeChange(value as DesignType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FC">FC - Resistencia a Compresión</SelectItem>
              <SelectItem value="MR">MR - Módulo de Ruptura</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Concrete Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Tipo de Concreto
          </CardTitle>
          <div className="text-sm text-gray-600 mt-1">
            ⚡ <strong>NUEVA FUNCIONALIDAD:</strong> Selecciona el tipo de concreto para generar recetas específicas.
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={concreteType} onValueChange={(value) => onConcreteTypeChange(value as ConcreteTypeCode)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONCRETE_TYPES).map(([code, { label, description }]) => (
                <SelectItem key={code} value={code}>
                  {code}: {label} - {description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Type Code (middle letter) */}
          <div>
            <Label htmlFor="typeCode" className="text-sm font-medium">
              Código de Tipo (Letra Media)
            </Label>
            <div className="text-xs text-gray-600 mb-1">
              Letra que aparece en el medio del código ARKIK (ej: en "5-100-2-<span className="font-semibold font-mono">B</span>-28-10-D", la{' '}
              <span className="font-semibold">B</span> es el código de tipo)
            </div>
            <Input
              id="typeCode"
              type="text"
              value={typeCode}
              onChange={(e) => {
                // Only allow single uppercase letter
                const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
                onTypeCodeChange(value || 'B');
              }}
              className="h-10 font-mono text-lg text-center max-w-[80px]"
              placeholder="B"
              maxLength={1}
            />
            <p className="text-xs text-gray-500 mt-1">
              Valor actual: <span className="font-mono font-semibold">{typeCode || 'B'}</span>
            </p>
          </div>
          
          {/* Recipe Code Suffix Customization */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Personalización del Sufijo del Código</h4>
            
            {/* NumSeg Input */}
            <div className="mb-4">
              <Label htmlFor="numSeg" className="text-sm font-medium">
                Número de Segmento (Sufijo)
              </Label>
              <div className="text-xs text-gray-600 mb-1">
                Número que aparece antes de la variante en el código ARKIK (ej: en "5-100-2-B-28-10-D-<span className="font-semibold font-mono">2</span>-000", el{' '}
                <span className="font-semibold">2</span> es el número de segmento)
              </div>
              <Input
                id="numSeg"
                type="text"
                value={numSeg}
                onChange={(e) => {
                  // Allow alphanumeric, remove hyphens and spaces, allow empty for typing
                  const value = e.target.value.replace(/[-\s]/g, '').slice(0, 10);
                  onNumSegChange(value);
                }}
                onBlur={(e) => {
                  // Set default only on blur if empty
                  if (!e.target.value.trim()) {
                    onNumSegChange('2');
                  }
                }}
                className="h-10 font-mono text-lg max-w-[120px]"
                placeholder="2"
                maxLength={10}
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor actual: <span className="font-mono font-semibold">{numSeg || '2'}</span> {!numSeg && <span className="text-gray-400">(por defecto)</span>}
              </p>
            </div>
            
            {/* Variante Input */}
            <div className="mb-4">
              <Label htmlFor="variante" className="text-sm font-medium">
                Variante (Sufijo)
              </Label>
              <div className="text-xs text-gray-600 mb-1">
                Código que aparece al final del código ARKIK (ej: en "5-100-2-B-28-10-D-2-<span className="font-semibold font-mono">000</span>", la{' '}
                <span className="font-semibold">000</span> es la variante)
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="variante"
                  type="text"
                  value={variante}
                  onChange={(e) => {
                    // Allow alphanumeric, remove hyphens and spaces, convert to uppercase, allow empty for typing
                    const value = e.target.value.replace(/[-\s]/g, '').toUpperCase().slice(0, 10);
                    onVarianteChange(value);
                  }}
                  onBlur={(e) => {
                    // Set default only on blur if empty
                    if (!e.target.value.trim()) {
                      onVarianteChange('000');
                    }
                  }}
                  disabled={enablePceAutoDetection}
                  className="h-10 font-mono text-lg max-w-[120px]"
                  placeholder="000"
                  maxLength={10}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enablePceAutoDetection"
                    checked={enablePceAutoDetection}
                    onCheckedChange={(checked) => onEnablePceAutoDetectionChange(checked === true)}
                  />
                  <Label htmlFor="enablePceAutoDetection" className="text-xs text-gray-600 cursor-pointer">
                    Auto-detectar PCE
                  </Label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Valor actual: <span className="font-mono font-semibold">{variante || '000'}</span> {!variante && <span className="text-gray-400">(por defecto)</span>}
                {enablePceAutoDetection && (
                  <span className="text-blue-600 ml-2">(Auto-detección activa: se usará "PCE" si se detectan aditivos PCE)</span>
                )}
              </p>
            </div>
            
            {/* Preview */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <p className="text-xs font-semibold mb-2">Vista Previa del Formato:</p>
              <p className="text-xs font-mono text-gray-700">
                {concreteType}-XXX-{recipeParams.aggregateSize >= 40 ? '4' : (recipeParams.aggregateSize >= 20 ? '2' : '1')}-{typeCode || 'B'}-XX-XX-X-<span className="font-semibold text-blue-600">{numSeg || '2'}</span>-<span className="font-semibold text-blue-600">{enablePceAutoDetection ? 'PCE/000' : variante || '000'}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Ejemplo completo: <span className="font-mono">{concreteType}-250-{recipeParams.aggregateSize >= 40 ? '4' : (recipeParams.aggregateSize >= 20 ? '2' : '1')}-{typeCode || 'B'}-28-14-D-{numSeg || '2'}-{enablePceAutoDetection ? 'PCE' : variante || '000'}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Parámetros Básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Unidad de Edad</Label>
              <Select
                value={(recipeParams.ageUnit as any) || 'D'}
                onValueChange={(v) => onRecipeParamsChange({ ...(recipeParams as any), ageUnit: v as any })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Días</SelectItem>
                  <SelectItem value="H">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(recipeParams.ageUnit || 'D') === 'D' ? (
              <div>
                <Label htmlFor="age">Edad de Diseño (días)</Label>
                <Input
                  id="age"
                  type="number"
                  value={designParams.age}
                  onChange={(e) => onDesignParamsChange({ age: parseInt(e.target.value) || 28 })}
                  min="1"
                  max="365"
                  step="1"
                  className="h-10"
                  placeholder="28"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="ageHours">Edad de Diseño (horas)</Label>
                <Input
                  id="ageHours"
                  type="number"
                  value={(recipeParams as any).ageHours || ''}
                  onChange={(e) => onRecipeParamsChange({ ...(recipeParams as any), ageHours: e.target.value ? parseInt(e.target.value) : undefined })}
                  min="1"
                  max="720"
                  step="1"
                  className="h-10"
                  placeholder="Ej. 12"
                />
              </div>
            )}

            <div>
              <Label htmlFor="aggregate-size">Tamaño Máximo del Agregado (mm)</Label>
              <Input
                id="aggregate-size"
                type="number"
                value={recipeParams.aggregateSize}
                onChange={(e) => onRecipeParamsChange({ aggregateSize: parseFloat(e.target.value) || 19 })}
                min="5"
                max="50"
                step="0.5"
                className="h-10"
                placeholder="19.0"
              />
            </div>

            <div className="col-span-3">
              <Label htmlFor="std-deviation-mode">Modo de Desviación Estándar</Label>
              <Select
                value={typeof designParams.standardDeviation === 'number' ? 'single' : 'per-strength'}
                onValueChange={(value) => {
                  if (value === 'single') {
                    // Convert to single value - use default or first value from record
                    const currentValue = typeof designParams.standardDeviation === 'number' 
                      ? designParams.standardDeviation 
                      : (Object.values(designParams.standardDeviation)[0] || 23);
                    onDesignParamsChange({ standardDeviation: currentValue });
                  } else {
                    // Convert to per-strength - initialize with current single value or default
                    const currentValue = typeof designParams.standardDeviation === 'number' 
                      ? designParams.standardDeviation 
                      : 23;
                    const strengths = designType === 'FC' ? FC_STRENGTHS : MR_STRENGTHS;
                    const perStrength: Record<number, number> = {};
                    strengths.forEach(strength => {
                      perStrength[strength] = currentValue;
                    });
                    onDesignParamsChange({ standardDeviation: perStrength });
                  }
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Valor único para todas las resistencias</SelectItem>
                  <SelectItem value="per-strength">Valor por resistencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Standard Deviation Input - Single or Per-Strength */}
          <div className="mt-4">
            {typeof designParams.standardDeviation === 'number' ? (
              <div>
                <Label htmlFor="std-deviation">Desviación Estándar {designType === 'FC' ? 'FC' : 'MR'} (%)</Label>
                <Input
                  id="std-deviation"
                  type="number"
                  value={designParams.standardDeviation || 23}
                  onChange={(e) => onDesignParamsChange({ standardDeviation: parseFloat(e.target.value) || 23 })}
                  min="10"
                  max="50"
                  step="0.1"
                  className="h-10"
                  placeholder="23"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este valor se aplicará a todas las resistencias
                </p>
              </div>
            ) : (
              <div>
                <Label>Desviación Estándar por Resistencia (%)</Label>
                <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-3">
                    Configure la desviación estándar para cada resistencia. Las resistencias sin valor personalizado usarán el valor por defecto.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(designType === 'FC' ? FC_STRENGTHS : MR_STRENGTHS).map((strength) => {
                      const stdDevRecord = typeof designParams.standardDeviation === 'number' 
                        ? {} 
                        : designParams.standardDeviation;
                      const currentStdDev = stdDevRecord[strength];
                      const defaultStdDev = 23;
                      const isCustom = currentStdDev !== undefined;
                      
                      // Use local state if available, otherwise use the actual value or empty
                      const inputValue = stdDevInputValues[strength] !== undefined 
                        ? stdDevInputValues[strength]
                        : (isCustom ? currentStdDev.toString() : '');
                      
                      return (
                        <div key={strength} className="bg-white p-3 rounded border">
                          <div className="flex items-center justify-between mb-1">
                            <Label htmlFor={`std-dev-${strength}`} className="text-sm font-medium">
                              {designType === 'FC' ? 'FC' : 'MR'}{strength}
                            </Label>
                            {isCustom && (
                              <span className="text-xs text-blue-600 font-semibold">✓</span>
                            )}
                          </div>
                          <Input
                            id={`std-dev-${strength}`}
                            type="text"
                            inputMode="decimal"
                            value={inputValue}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              // Update local state immediately for smooth editing
                              setStdDevInputValues((prev: Record<number, string>) => ({
                                ...prev,
                                [strength]: newValue
                              }));
                            }}
                            onBlur={(e) => {
                              const inputValue = e.target.value.trim();
                              const numValue = parseFloat(inputValue);
                              
                              // Clear local state
                              setStdDevInputValues((prev: Record<number, string>) => {
                                const updated = { ...prev };
                                delete updated[strength];
                                return updated;
                              });
                              
                              // If empty or invalid, reset to default (remove custom value)
                              if (inputValue === '' || isNaN(numValue) || numValue < 10 || numValue > 50) {
                                const stdDevRecord = typeof designParams.standardDeviation === 'number' 
                                  ? {} 
                                  : designParams.standardDeviation;
                                const updated = { ...stdDevRecord };
                                delete updated[strength];
                                onDesignParamsChange({ standardDeviation: updated });
                              } else {
                                // Save valid value
                                const stdDevRecord = typeof designParams.standardDeviation === 'number' 
                                  ? {} 
                                  : designParams.standardDeviation;
                                const updated = { ...stdDevRecord };
                                updated[strength] = numValue;
                                onDesignParamsChange({ standardDeviation: updated });
                              }
                            }}
                            onFocus={(e) => {
                              // When focusing, set local state to current value for editing
                              const currentValue = isCustom ? currentStdDev.toString() : '';
                              setStdDevInputValues((prev: Record<number, string>) => ({
                                ...prev,
                                [strength]: currentValue
                              }));
                            }}
                            className={`h-8 text-sm ${isCustom ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                            placeholder={defaultStdDev.toString()}
                          />
                          <div className="flex items-center justify-between mt-1">
                            {!isCustom ? (
                              <p className="text-xs text-gray-500">Por defecto: {defaultStdDev}%</p>
                            ) : (
                              <p className="text-xs text-blue-600">Personalizado</p>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 px-2 text-xs"
                              onClick={() => {
                                // Clear local state
                                setStdDevInputValues((prev: Record<number, string>) => {
                                  const updated = { ...prev };
                                  delete updated[strength];
                                  return updated;
                                });
                                
                                const stdDevRecord = typeof designParams.standardDeviation === 'number' 
                                  ? {} 
                                  : designParams.standardDeviation;
                                const updated = { ...stdDevRecord };
                                if (isCustom) {
                                  delete updated[strength];
                                } else {
                                  updated[strength] = defaultStdDev;
                                }
                                onDesignParamsChange({ standardDeviation: updated });
                              }}
                            >
                              {isCustom ? 'Reset' : 'Editar'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-300">
                    <p className="text-xs text-gray-600">
                      💡 <strong>Nota:</strong> Las resistencias sin valor personalizado usarán el valor por defecto de <strong>23%</strong>. 
                      Use el botón "Personalizar" para establecer un valor específico para cada resistencia.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resistance Factors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="factor1">Factor 1 (Ecuación A/C)</Label>
              <Input
                id="factor1"
                type="number"
                value={designParams.resistanceFactors?.factor1 || 120}
                onChange={(e) => onDesignParamsChange({ 
                  resistanceFactors: {
                    ...designParams.resistanceFactors,
                    factor1: parseFloat(e.target.value) || 120
                  }
                })}
                min="50"
                max="200"
                step="0.1"
                className="h-10"
                placeholder="120"
              />
            </div>

            <div>
              <Label htmlFor="factor2">Factor 2 (Ecuación A/C)</Label>
              <Input
                id="factor2"
                type="number"
                value={designParams.resistanceFactors?.factor2 || 1.626}
                onChange={(e) => onDesignParamsChange({ 
                  resistanceFactors: {
                    ...designParams.resistanceFactors,
                    factor2: parseFloat(e.target.value) || 1.626
                  }
                })}
                min="1"
                max="3"
                step="0.001"
                className="h-10"
                placeholder="1.626"
              />
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 <strong>Fórmula A/C:</strong> A/C = (Factor1 / FCR)^(1/Factor2) | FCR = F'c + (F'c * Desviación%)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="air-content-td">Contenido de Aire TD (%)</Label>
              <Input
                id="air-content-td"
                type="number"
                value={designParams.airContentTD || 7.0}
                onChange={(e) => onDesignParamsChange({ airContentTD: parseFloat(e.target.value) || 7.0 })}
                min="1"
                max="15"
                step="0.1"
                className="h-10"
                placeholder="7.0"
              />
            </div>

            <div>
              <Label htmlFor="air-content-bomb">Contenido de Aire Bombeo (%)</Label>
              <Input
                id="air-content-bomb"
                type="number"
                value={designParams.airContentBomb || 6.5}
                onChange={(e) => onDesignParamsChange({ airContentBomb: parseFloat(e.target.value) || 6.5 })}
                min="1"
                max="15"
                step="0.1"
                className="h-10"
                placeholder="6.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mortar Volumes Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Volúmenes de Mortero (L/m³)</CardTitle>
          <div className="text-sm text-gray-600 mt-1">
            Configure los volúmenes de mortero según el tipo de diseño y método de colocación
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={designType} onValueChange={() => {}}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="FC" className="data-[state=active]:bg-blue-100">FC - Resistencia a Compresión</TabsTrigger>
              <TabsTrigger value="MR" className="data-[state=active]:bg-green-100">MR - Módulo de Ruptura</TabsTrigger>
            </TabsList>
            
            <TabsContent value="FC">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-4">Volúmenes para Diseño FC</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mortar-fc-td">🚛 Tiro Directo (L/m³)</Label>
                    <Input
                      id="mortar-fc-td"
                      type="number"
                      value={designParams.mortarVolumes?.FC?.TD || 580}
                      onChange={(e) => onDesignParamsChange({ 
                        mortarVolumes: {
                          ...designParams.mortarVolumes,
                          FC: {
                            ...designParams.mortarVolumes.FC,
                            TD: parseFloat(e.target.value) || 580
                          }
                        }
                      })}
                      min="400"
                      max="700"
                      step="5"
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mortar-fc-bomb">🔀 Bombeo (L/m³)</Label>
                    <Input
                      id="mortar-fc-bomb"
                      type="number"
                      value={designParams.mortarVolumes?.FC?.BOMB || 580}
                      onChange={(e) => onDesignParamsChange({ 
                        mortarVolumes: {
                          ...designParams.mortarVolumes,
                          FC: {
                            ...designParams.mortarVolumes.FC,
                            BOMB: parseFloat(e.target.value) || 580
                          }
                        }
                      })}
                      min="400"
                      max="700"
                      step="5"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="MR">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-4">Volúmenes para Diseño MR</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mortar-mr-normal">📏 Revenimiento Normal {'<14cm'} (L/m³)</Label>
                    <Input
                      id="mortar-mr-normal"
                      type="number"
                      value={designParams.mortarVolumes?.MR?.normal || 600}
                      onChange={(e) => onDesignParamsChange({ 
                        mortarVolumes: {
                          ...designParams.mortarVolumes,
                          MR: {
                            ...designParams.mortarVolumes.MR,
                            normal: parseFloat(e.target.value) || 600
                          }
                        }
                      })}
                      min="400"
                      max="700"
                      step="5"
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mortar-mr-high">📏 Revenimiento Alto {'≥14cm'} (L/m³)</Label>
                    <Input
                      id="mortar-mr-high"
                      type="number"
                      value={designParams.mortarVolumes?.MR?.high || 620}
                      onChange={(e) => onDesignParamsChange({ 
                        mortarVolumes: {
                          ...designParams.mortarVolumes,
                          MR: {
                            ...designParams.mortarVolumes.MR,
                            high: parseFloat(e.target.value) || 620
                          }
                        }
                      })}
                      min="400"
                      max="700"
                      step="5"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-800">
              💡 <strong>Balance de Volúmenes:</strong> Volumen Arena = Volumen Mortero - (Agua + Cemento/Densidad + Aire + Aditivos) | Volumen Grava = 1000 - Volumen Mortero
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Water Definitions - NEW FEATURE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Definiciones de Agua - Control de Generación de Recetas
          </CardTitle>
          <div className="text-sm text-gray-600 mt-1">
            ⚡ <strong>NUEVA FUNCIONALIDAD:</strong> Estas definiciones determinan qué recetas se generarán. Solo las combinaciones habilitadas generarán recetas.
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">
                🎯 Control de Generación de Recetas
              </h4>
              <p className="text-sm text-blue-700">
                Si habilitas Rev 10D, Rev 14B, y Rev 18B, entonces para cada resistencia (ej: FC 100) se generarán 3 recetas: FC100-10D-28D, FC100-14B-28D, FC100-18B-28D
              </p>
            </div>
            
            <div className="grid gap-3">
              {recipeParams.waterDefinitions?.map((def, index) => (
                <div key={index} className={`p-4 rounded-lg border ${def.enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="grid grid-cols-5 gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={def.enabled}
                        onCheckedChange={(checked) => onWaterDefinitionChange(index, 'enabled', checked)}
                      />
                      <Label className="text-sm font-medium">
                        Rev {def.slump}cm {def.placement}
                      </Label>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Revenimiento (cm)</Label>
                      <Input
                        type="number"
                        value={def.slump}
                        onChange={(e) => onWaterDefinitionChange(index, 'slump', parseInt(e.target.value) || 10)}
                        min="8"
                        max="25"
                        className="h-8"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Colocación</Label>
                      <Select
                        value={def.placement}
                        onValueChange={(value) => onWaterDefinitionChange(index, 'placement', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="D">D - Directo</SelectItem>
                          <SelectItem value="B">B - Bombeo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs">
                        Agua {def.placement === 'D' ? 'Directo' : 'Bombeo'} (L/m³)
                      </Label>
                      <Input
                        type="number"
                        value={def.placement === 'D' ? def.waterTD : def.waterBomb}
                        onChange={(e) => {
                          const field = def.placement === 'D' ? 'waterTD' : 'waterBomb';
                          onWaterDefinitionChange(index, field, parseInt(e.target.value) || 180);
                        }}
                        min="120"
                        max="280"
                        className="h-8"
                        placeholder={def.placement === 'D' ? '180' : '165'}
                      />
                    </div>
                    
                    <div className="text-center">
                      {def.enabled ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                          ✅ Activa
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          ⏸️ Inactiva
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-800">
                💡 <strong>Ejemplo:</strong> Si solo habilitas "Rev 10D" y "Rev 14B", entonces para FC se generarán recetas solo con esas combinaciones: FC100-10D, FC100-14B, FC150-10D, FC150-14B, etc.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Additive System - NEW FEATURE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskRound className="h-5 w-5 text-purple-600" />
            Sistema Avanzado de Aditivos
          </CardTitle>
          <div className="text-sm text-gray-600 mt-1">
            ⚡ <strong>NUEVA FUNCIONALIDAD:</strong> Configure aditivos dinámicos basados en cantidad de cemento con distribución de CC por kg de cemento
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Total CC Configuration */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-3">
              🧪 Configuración General de Aditivos
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="total-cc">Total CC por kg de Cemento</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="total-cc"
                    type="number"
                    value={recipeParams.additiveSystemConfig?.totalCCPerKgCement || 5}
                    onChange={(e) => onAdditiveSystemConfigChange('totalCCPerKgCement', parseFloat(e.target.value) || 5)}
                    min="0.1"
                    max="20"
                    step="0.1"
                    className="h-10"
                  />
                  <span className="text-sm text-gray-600 min-w-[60px]">cc/kg</span>
                </div>
                <p className="text-xs text-purple-700 mt-1">
                  Cantidad total de aditivo en cc por cada kg de cemento
                </p>
              </div>
            </div>
          </div>

          {/* Additive Rules */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800">
                📋 Reglas de Distribución de Aditivos
              </h4>
              <Button
                onClick={() => {
                  handleUserInteraction();
                  onAddAdditiveRule();
                }}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar Regla
              </Button>
            </div>
            
            <div className="space-y-3">
              {recipeParams.additiveSystemConfig?.additiveRules?.map((rule, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border">
                  <div className="grid grid-cols-6 gap-3 items-center">
                    <div>
                      <Label className="text-xs">Aditivo</Label>
                      <Select
                        value={rule.additiveId.toString()}
                        onValueChange={(value) => {
                          handleUserInteraction();
                          onAdditiveRuleChange(index, 'additiveId', parseInt(value));
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.additives.map((additive, adIdx) => (
                            <SelectItem key={adIdx} value={adIdx.toString()}>
                              {additive.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs">% del Total CC</Label>
                      <Input
                        type="number"
                        value={rule.ccPercentage}
                        onChange={(e) => {
                          handleUserInteraction();
                          onAdditiveRuleChange(index, 'ccPercentage', parseFloat(e.target.value) || 0);
                        }}
                        min="0"
                        max="100"
                        step="1"
                        className="h-8"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Cemento Mín (kg/m³)</Label>
                      <Input
                        type="number"
                        value={rule.minCement}
                        onChange={(e) => {
                          handleUserInteraction();
                          onAdditiveRuleChange(index, 'minCement', parseInt(e.target.value) || 0);
                        }}
                        min="0"
                        max="1000"
                        step="10"
                        className="h-8"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Cemento Máx (kg/m³)</Label>
                      <Input
                        type="number"
                        value={rule.maxCement}
                        onChange={(e) => {
                          handleUserInteraction();
                          onAdditiveRuleChange(index, 'maxCement', parseInt(e.target.value) || 1000);
                        }}
                        min="0"
                        max="1000"
                        step="10"
                        className="h-8"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Prioridad</Label>
                      <Input
                        type="number"
                        value={rule.priority}
                        onChange={(e) => {
                          handleUserInteraction();
                          onAdditiveRuleChange(index, 'priority', parseInt(e.target.value) || 1);
                        }}
                        min="1"
                        max="10"
                        step="1"
                        className="h-8"
                      />
                    </div>
                    
                    <div>
                      <Button
                        onClick={() => {
                          handleUserInteraction();
                          onRemoveAdditiveRule(index);
                        }}
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-600">
                    {materials.additives[rule.additiveId] && (
                      <span>
                        Para cemento {rule.minCement}-{rule.maxCement} kg/m³: usar {rule.ccPercentage}% del total ({((recipeParams.additiveSystemConfig?.totalCCPerKgCement || 5) * rule.ccPercentage / 100).toFixed(1)} cc/kg) de {materials.additives[rule.additiveId]?.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Show typing indicator when validation is hidden */}
            {!showValidationErrors && recipeParams.additiveSystemConfig?.additiveRules && recipeParams.additiveSystemConfig.additiveRules.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm text-blue-700">
                    ⏱️ Validando configuración... (las alertas aparecerán cuando termines de escribir)
                  </p>
                </div>
              </div>
            )}

            {/* Cement Range Completion Status - Only show after user stops typing and has rules */}
            {showValidationErrors && recipeParams.additiveSystemConfig?.additiveRules && recipeParams.additiveSystemConfig.additiveRules.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold text-gray-800 mb-2">📊 Estado de Completitud por Rango de Cemento</h5>
                {(() => {
                  const completionStatus = getCementRangeCompletionStatus(recipeParams.additiveSystemConfig);
                  
                  if (completionStatus.length === 0) {
                    return (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">No hay reglas definidas</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      {completionStatus.map((status, index) => (
                        <div 
                          key={index} 
                          className={`p-3 rounded-lg border ${status.isComplete 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              🏗️ {status.rangeStart} - {status.rangeEnd} kg/m³
                            </span>
                            <span className={`font-bold ${status.isComplete ? 'text-green-700' : 'text-red-700'}`}>
                              {status.totalPercentage.toFixed(1)}%
                              {status.isComplete ? ' ✅' : ' ❌'}
                            </span>
                          </div>
                          {status.applicableRules.length > 0 && (
                            <div className="mt-2 text-xs">
                              <strong>Reglas aplicables:</strong>
                              <ul className="mt-1 space-y-1">
                                {status.applicableRules.map((rule, ruleIndex) => {
                                  const additive = materials.additives.find(add => add.id === rule.additiveId);
                                  return (
                                    <li key={ruleIndex} className="text-gray-600">
                                      • {additive?.name || `Aditivo ${rule.additiveId}`}: {rule.ccPercentage}%
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {!status.isComplete && (
                            <div className="mt-2 text-xs text-red-600">
                              💡 <strong>Sugerencia:</strong> {status.totalPercentage < 100 
                                ? `Faltan ${(100 - status.totalPercentage).toFixed(1)}% para completar este rango` 
                                : `Sobran ${(status.totalPercentage - 100).toFixed(1)}% en este rango`
                              }
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-800">
                💡 <strong>Sistema Basado en Cemento:</strong> Los aditivos se distribuyen según la cantidad de cemento calculada para cada receta. La misma resistencia puede usar diferentes cantidades de cemento según el contenido de agua.
                <br/><br/>
                📊 <strong>Ejemplo de Distribución:</strong> 
                • 0-400 kg/m³: 100% PLASTOL 5000
                • 400-600 kg/m³: 80% PLASTOL 5000 + 20% SUPERPLASTIFICANTE  
                • 600+ kg/m³: 60% PLASTOL 5000 + 40% SUPERPLASTIFICANTE
                <br/><br/>
                ⚠️ <strong>Comportamiento Esperado:</strong> FC400 con diferentes revenimientos puede usar 430-465 kg/m³ de cemento, activando la regla 400-600 kg/m³. Si no hay segundo aditivo disponible, solo se mostrará el primero.
                <br/><br/>
                📝 <strong>Nota importante:</strong> Los rangos son excluyentes en el límite superior. Por ejemplo, si tienes reglas 0-300 y 300-1000, en exactamente 300 kg/m³ solo aplicará la segunda regla (300-1000), evitando superposiciones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Material Combinations */}
      {materials.sands.length > 0 && materials.gravels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Combinaciones de Materiales</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="sand-td">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="sand-td">Arena TD</TabsTrigger>
                <TabsTrigger value="sand-bomb">Arena Bombeo</TabsTrigger>
                <TabsTrigger value="gravel-td">Grava TD</TabsTrigger>
                <TabsTrigger value="gravel-bomb">Grava Bombeo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sand-td" className="mt-4">
                {renderCombinationInputs('sand', 'TD')}
              </TabsContent>
              
              <TabsContent value="sand-bomb" className="mt-4">
                {renderCombinationInputs('sand', 'Bomb')}
              </TabsContent>
              
              <TabsContent value="gravel-td" className="mt-4">
                {renderCombinationInputs('gravel', 'TD')}
              </TabsContent>
              
              <TabsContent value="gravel-bomb" className="mt-4">
                {renderCombinationInputs('gravel', 'Bomb')}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};