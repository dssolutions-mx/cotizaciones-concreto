import React from 'react';
import { Plus, Check, X, AlertTriangle } from 'lucide-react';
import { Material, MaterialWithPrice } from '@/types/material';
import { SelectedMaterials, MaterialSelectionStep } from '@/types/calculator';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MaterialSelectionProps {
  availableMaterials: {
    cements: MaterialWithPrice[];
    sands: MaterialWithPrice[];
    gravels: MaterialWithPrice[];
    additives: MaterialWithPrice[];
  };
  selectedMaterials: SelectedMaterials;
  materialSelectionStep: MaterialSelectionStep;
  onMaterialSelect: (type: keyof SelectedMaterials, id: number) => void;
  onMaterialRemove: (type: keyof SelectedMaterials, id: number) => void;
  onStepChange: (step: MaterialSelectionStep) => void;
  onComplete: () => void;
}

export const MaterialSelection: React.FC<MaterialSelectionProps> = ({
  availableMaterials,
  selectedMaterials,
  materialSelectionStep,
  onMaterialSelect,
  onMaterialRemove,
  onStepChange,
  onComplete
}) => {
  // Validate material properties
  const validateMaterial = (material: MaterialWithPrice): string[] => {
    const errors: string[] = [];
    
    if (!material.specific_gravity) {
      errors.push('Falta densidad específica');
    }
    
    if (material.absorption_rate === null || material.absorption_rate === undefined) {
      errors.push('Falta tasa de absorción');
    }
    
    if (!material.cost) {
      errors.push('Falta precio');
    }
    
    return errors;
  };

  const isStepComplete = (step: MaterialSelectionStep): boolean => {
    switch (step) {
      case 'cement':
        return selectedMaterials.cement !== null;
      case 'sands':
        return selectedMaterials.sands.length > 0;
      case 'gravels':
        return selectedMaterials.gravels.length > 0;
      case 'additives':
        return true; // Additives are optional
      default:
        return false;
    }
  };

  const renderMaterialList = (
    materials: MaterialWithPrice[],
    type: keyof SelectedMaterials,
    allowMultiple: boolean = false
  ) => {
    const selected = type === 'cement' 
      ? (selectedMaterials[type] ? [selectedMaterials[type]] : [])
      : selectedMaterials[type as 'sands' | 'gravels' | 'additives'];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map((material) => {
          const isSelected = type === 'cement' 
            ? selectedMaterials.cement === material.id
            : (selected as number[]).includes(material.id);
          
          const validationErrors = validateMaterial(material);
          const hasErrors = validationErrors.length > 0;

          return (
            <Card 
              key={material.id}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-lg'
              } ${hasErrors ? 'border-red-300 bg-red-50' : ''}`}
              onClick={() => {
                if (isSelected && type !== 'cement') {
                  onMaterialRemove(type, material.id);
                } else if (!isSelected) {
                  onMaterialSelect(type, material.id);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{material.material_name}</h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">
                        Densidad: {material.specific_gravity || 'N/A'} g/cm³
                      </p>
                      <p className="text-xs text-gray-600">
                        Absorción: {material.absorption_rate || 'N/A'}%
                      </p>
                      <p className="text-xs text-gray-600">
                        Precio: {material.cost ? `$${material.cost}` : 'N/A'}
                      </p>
                    </div>
                    
                    {/* Show validation errors */}
                    {hasErrors && (
                      <Alert className="mt-2 border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-xs text-red-700">
                          <strong>Incompleto:</strong> {validationErrors.join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderStep = () => {
    switch (materialSelectionStep) {
      case 'cement':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Seleccionar Cemento</h3>
            {renderMaterialList(availableMaterials.cements, 'cement', false)}
          </div>
        );
      
      case 'sands':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Seleccionar Arenas (mínimo 1)
            </h3>
            {renderMaterialList(availableMaterials.sands, 'sands', true)}
          </div>
        );
      
      case 'gravels':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Seleccionar Gravas (mínimo 1)
            </h3>
            {renderMaterialList(availableMaterials.gravels, 'gravels', true)}
          </div>
        );
      
      case 'additives':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Seleccionar Aditivos (opcional)
            </h3>
            {renderMaterialList(availableMaterials.additives, 'additives', true)}
          </div>
        );
      
      case 'complete':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resumen de Materiales Seleccionados</h3>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Cemento:</h4>
                {selectedMaterials.cement && (
                  <Badge variant="default">
                    {availableMaterials.cements.find(c => c.id === selectedMaterials.cement)?.material_name}
                  </Badge>
                )}
              </div>

              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Arenas:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMaterials.sands.map(id => {
                    const sand = availableMaterials.sands.find(s => s.id === id);
                    return sand && (
                      <Badge key={id} variant="secondary">{sand.material_name}</Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Gravas:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMaterials.gravels.map(id => {
                    const gravel = availableMaterials.gravels.find(g => g.id === id);
                    return gravel && (
                      <Badge key={id} variant="secondary">{gravel.material_name}</Badge>
                    );
                  })}
                </div>
              </div>

              {selectedMaterials.additives.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Aditivos:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMaterials.additives.map(id => {
                      const additive = availableMaterials.additives.find(a => a.id === id);
                      return additive && (
                        <Badge key={id} variant="outline">{additive.material_name}</Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Button onClick={onComplete} className="w-full">
              Confirmar Selección y Continuar
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  const getNextStep = (currentStep: MaterialSelectionStep): MaterialSelectionStep | null => {
    const steps: MaterialSelectionStep[] = ['cement', 'sands', 'gravels', 'additives', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      return steps[currentIndex + 1];
    }
    return null;
  };

  const getPrevStep = (currentStep: MaterialSelectionStep): MaterialSelectionStep | null => {
    const steps: MaterialSelectionStep[] = ['cement', 'sands', 'gravels', 'additives', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      return steps[currentIndex - 1];
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selección de Materiales</CardTitle>
        <div className="flex gap-2 mt-4">
          {(['cement', 'sands', 'gravels', 'additives'] as MaterialSelectionStep[]).map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full ${
                materialSelectionStep === step
                  ? 'bg-blue-500'
                  : isStepComplete(step)
                  ? 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {renderStep()}
        
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => {
              const prevStep = getPrevStep(materialSelectionStep);
              if (prevStep) onStepChange(prevStep);
            }}
            disabled={materialSelectionStep === 'cement'}
          >
            Anterior
          </Button>
          
          <Button
            onClick={() => {
              const nextStep = getNextStep(materialSelectionStep);
              if (nextStep) onStepChange(nextStep);
            }}
            disabled={!isStepComplete(materialSelectionStep) || materialSelectionStep === 'complete'}
          >
            Siguiente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};