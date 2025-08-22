import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Info, 
  Shield, 
  FileText,
  Package,
  Calendar,
  Scale,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { 
  DuplicateRemisionInfo, 
  DuplicateHandlingStrategy, 
  DuplicateHandlingDecision 
} from '@/types/arkik';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DuplicateHandlingInterfaceProps {
  duplicates: DuplicateRemisionInfo[];
  onDecisionsComplete: (decisions: DuplicateHandlingDecision[]) => void;
  onCancel: () => void;
}

export default function DuplicateHandlingInterface({
  duplicates,
  onDecisionsComplete,
  onCancel
}: DuplicateHandlingInterfaceProps) {
  const [decisions, setDecisions] = useState<Map<string, DuplicateHandlingDecision>>(new Map());
  const [expandedRemisiones, setExpandedRemisiones] = useState<Set<string>>(new Set());

  // Initialize decisions with suggested strategies
  React.useEffect(() => {
    const initialDecisions = new Map<string, DuplicateHandlingDecision>();
    duplicates.forEach(duplicate => {
      initialDecisions.set(duplicate.remision_number, {
        remision_number: duplicate.remision_number,
        strategy: duplicate.suggested_strategy,
        custom_notes: '',
        preserve_existing_data: duplicate.suggested_strategy !== DuplicateHandlingStrategy.UPDATE_ALL,
        update_materials_only: duplicate.suggested_strategy === DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY,
        skip_entirely: duplicate.suggested_strategy === DuplicateHandlingStrategy.SKIP
      });
    });
    setDecisions(initialDecisions);
  }, [duplicates]);

  const handleStrategyChange = (remisionNumber: string, strategy: DuplicateHandlingStrategy) => {
    setDecisions(prev => {
      const newDecisions = new Map(prev);
      const existing = newDecisions.get(remisionNumber);
      if (existing) {
        newDecisions.set(remisionNumber, {
          ...existing,
          strategy,
          preserve_existing_data: strategy !== DuplicateHandlingStrategy.UPDATE_ALL,
          update_materials_only: strategy === DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY,
          skip_entirely: strategy === DuplicateHandlingStrategy.SKIP
        });
      }
      return newDecisions;
    });
  };

  const handleCustomNotesChange = (remisionNumber: string, notes: string) => {
    setDecisions(prev => {
      const newDecisions = new Map(prev);
      const existing = newDecisions.get(remisionNumber);
      if (existing) {
        newDecisions.set(remisionNumber, { ...existing, custom_notes: notes });
      }
      return newDecisions;
    });
  };

  const toggleExpansion = (remisionNumber: string) => {
    setExpandedRemisiones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(remisionNumber)) {
        newSet.delete(remisionNumber);
      } else {
        newSet.add(remisionNumber);
      }
      return newSet;
    });
  };

  const getStrategyDescription = (strategy: DuplicateHandlingStrategy): string => {
    switch (strategy) {
      case DuplicateHandlingStrategy.SKIP:
        return 'Omitir completamente esta remisión';
      case DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY:
        return 'Actualizar solo los datos de materiales';
      case DuplicateHandlingStrategy.UPDATE_ALL:
        return 'Actualizar todos los datos (sobrescribir)';
      case DuplicateHandlingStrategy.MERGE:
        return 'Combinar datos inteligentemente';
      case DuplicateHandlingStrategy.SKIP_NEW_ONLY:
        return 'Omitir solo las nuevas duplicadas';
      default:
        return 'Estrategia no definida';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'high':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const handleContinue = () => {
    const decisionsArray = Array.from(decisions.values());
    onDecisionsComplete(decisionsArray);
  };

  const summary = {
    total: duplicates.length,
    lowRisk: duplicates.filter(d => d.risk_level === 'low').length,
    mediumRisk: duplicates.filter(d => d.risk_level === 'medium').length,
    highRisk: duplicates.filter(d => d.risk_level === 'high').length,
    materialsMissing: duplicates.filter(d => d.differences.materials_missing).length,
    hasStatusDecisions: duplicates.filter(d => d.existing_data.has_status_decisions).length,
    hasReassignments: duplicates.filter(d => d.existing_data.has_reassignments).length,
    hasWasteMaterials: duplicates.filter(d => d.existing_data.has_waste_materials).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
            Duplicados Detectados
          </CardTitle>
          <CardDescription>
            Se encontraron {duplicates.length} remisiones que ya existen en el sistema. 
            Revisa y decide cómo manejarlas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
              <div className="text-sm text-blue-800">Total Duplicados</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{summary.lowRisk}</div>
              <div className="text-sm text-green-800">Riesgo Bajo</div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-amber-600">{summary.mediumRisk}</div>
              <div className="text-sm text-amber-800">Riesgo Medio</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{summary.highRisk}</div>
              <div className="text-sm text-red-800">Riesgo Alto</div>
            </div>
          </div>

          {/* Special Cases */}
          <div className="space-y-3">
            {summary.materialsMissing > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <Package className="h-4 w-4" />
                  <span className="font-medium">
                    {summary.materialsMissing} remisiones sin datos de materiales
                  </span>
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  Estas remisiones pueden ser actualizadas de forma segura para agregar los materiales faltantes.
                </div>
              </div>
            )}

            {summary.hasStatusDecisions > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">
                    {summary.hasStatusDecisions} remisiones con decisiones de estado
                  </span>
                </div>
                <div className="text-sm text-amber-700 mt-1">
                  ⚠️ Actualizar estas remisiones puede afectar decisiones ya tomadas.
                </div>
              </div>
            )}

            {summary.hasReassignments > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800">
                  <ArrowRight className="h-4 w-4" />
                  <span className="font-medium">
                    {summary.hasReassignments} remisiones con reasignaciones activas
                  </span>
                </div>
                <div className="text-sm text-red-700 mt-1">
                  🚨 Estas remisiones tienen reasignaciones que podrían perderse si se actualizan.
                </div>
              </div>
            )}

            {summary.hasWasteMaterials > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-orange-800">
                  <Package className="h-4 w-4" />
                  <span className="font-medium">
                    {summary.hasWasteMaterials} remisiones con materiales marcados como desperdicio
                  </span>
                </div>
                <div className="text-sm text-orange-700 mt-1">
                  ⚠️ Estas remisiones tienen registros de desperdicio que podrían perderse si se actualizan.
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duplicate List */}
      <div className="space-y-4">
        {duplicates.map((duplicate) => {
          const decision = decisions.get(duplicate.remision_number);
          const isExpanded = expandedRemisiones.has(duplicate.remision_number);

          return (
            <Card key={duplicate.remision_number} className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="font-mono">
                        #{duplicate.remision_number}
                      </Badge>
                      <Badge variant="outline" className={getRiskColor(duplicate.risk_level)}>
                        {getRiskIcon(duplicate.risk_level)}
                        <span className="ml-1 capitalize">{duplicate.risk_level}</span>
                      </Badge>
                      <Badge variant="outline" className="text-blue-700 border-blue-300">
                        Orden: {duplicate.existing_order_number}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Cliente:</span>
                        <div className="text-gray-800">{duplicate.existing_data.client_id}</div>
                      </div>
                      <div>
                        <span className="font-medium">Obra:</span>
                        <div className="text-gray-800">{duplicate.existing_data.construction_site_id}</div>
                      </div>
                      <div>
                        <span className="font-medium">Fecha:</span>
                        <div className="text-gray-800">{duplicate.existing_data.fecha}</div>
                      </div>
                      <div>
                        <span className="font-medium">Volumen:</span>
                        <div className="text-gray-800">{duplicate.existing_data.volumen_fabricado.toFixed(1)} m³</div>
                      </div>
                    </div>

                    {/* Strategy Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Estrategia:</span>
                        <select
                          value={decision?.strategy || DuplicateHandlingStrategy.SKIP}
                          onChange={(e) => handleStrategyChange(duplicate.remision_number, e.target.value as DuplicateHandlingStrategy)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value={DuplicateHandlingStrategy.SKIP}>Omitir</option>
                          <option value={DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY}>Solo Materiales</option>
                          <option value={DuplicateHandlingStrategy.UPDATE_ALL}>Actualizar Todo</option>
                          <option value={DuplicateHandlingStrategy.MERGE}>Combinar</option>
                        </select>
                      </div>

                      <div className="text-sm text-gray-600">
                        {getStrategyDescription(decision?.strategy || DuplicateHandlingStrategy.SKIP)}
                      </div>

                      {/* Custom Notes */}
                      <div>
                        <label className="text-sm font-medium text-gray-700">Notas adicionales:</label>
                        <textarea
                          value={decision?.custom_notes || ''}
                          onChange={(e) => handleCustomNotesChange(duplicate.remision_number, e.target.value)}
                          placeholder="Agrega notas sobre esta decisión..."
                          className="w-full mt-1 text-sm border border-gray-300 rounded px-2 py-1 resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleExpansion(duplicate.remision_number)}
                      className="text-blue-700 border-blue-300"
                    >
                      {isExpanded ? 'Ocultar' : 'Ver'} Detalles
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded Details */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Existing Data */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        Datos Existentes
                      </h4>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Volumen:</span>
                          <span className="font-medium">{duplicate.existing_data.volumen_fabricado.toFixed(1)} m³</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Materiales:</span>
                          <Badge variant={duplicate.existing_data.has_materials ? 'default' : 'secondary'}>
                            {duplicate.existing_data.has_materials ? 'Presentes' : 'Faltantes'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Decisiones de estado:</span>
                          <Badge variant={duplicate.existing_data.has_status_decisions ? 'destructive' : 'secondary'}>
                            {duplicate.existing_data.has_status_decisions ? 'Sí' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reasignaciones:</span>
                          <Badge variant={duplicate.existing_data.has_reassignments ? 'destructive' : 'secondary'}>
                            {duplicate.existing_data.has_reassignments ? 'Sí' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Materiales desperdiciados:</span>
                          <Badge variant={duplicate.existing_data.has_waste_materials ? 'destructive' : 'secondary'}>
                            {duplicate.existing_data.has_waste_materials ? 'Sí' : 'No'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* New Data */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-green-600" />
                        Datos Nuevos
                      </h4>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Volumen:</span>
                          <span className="font-medium">{duplicate.new_data.volumen_fabricado.toFixed(1)} m³</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Materiales:</span>
                          <Badge variant="default">
                            {Object.keys(duplicate.new_data.materials_teorico).length} códigos
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha:</span>
                          <span className="font-medium">{duplicate.new_data.fecha.toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Materials Preview */}
                      {Object.keys(duplicate.new_data.materials_teorico).length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-gray-700 mb-2">Materiales disponibles:</div>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(duplicate.new_data.materials_teorico).slice(0, 5).map((code) => (
                              <Badge key={code} variant="outline" className="text-xs">
                                {code}
                              </Badge>
                            ))}
                            {Object.keys(duplicate.new_data.materials_teorico).length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{Object.keys(duplicate.new_data.materials_teorico).length - 5} más
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Risk Analysis */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Análisis de Riesgo
                    </h5>
                    <div className="space-y-1 text-sm text-gray-700">
                      {duplicate.notes.map((note, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-amber-600">•</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-6 border-t">
        <Button 
          onClick={onCancel}
          variant="outline"
          className="px-6"
        >
          Cancelar
        </Button>
        
        <Button 
          onClick={handleContinue}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
        >
          Continuar con Decisiones →
        </Button>
      </div>
    </div>
  );
}
