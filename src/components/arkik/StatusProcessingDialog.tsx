'use client';

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ArrowRight, Trash2, User, Truck, Calendar, Package, Check } from 'lucide-react';
import type { StagingRemision, StatusProcessingDecision, StatusProcessingAction } from '@/types/arkik';
import { StatusProcessingAction as SPA } from '@/types/arkik';

// Helper functions for date formatting without timezone conversion
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Compatibility calculation functions
const calculateCompatibilityScore = (problemRemision: StagingRemision, candidate: StagingRemision): number => {
  let score = 0;

  // Same driver (highest priority)
  if (candidate.conductor === problemRemision.conductor) {
    score += 100;
  }

  // Same unit/truck (high priority)
  if (candidate.placas === problemRemision.placas) {
    score += 50;
  }

  // Same day (moderate priority)
  const timeDiff = Math.abs(candidate.fecha.getTime() - problemRemision.fecha.getTime());
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) {
    score += 20;
  } else if (daysDiff <= 1) {
    score += 10;
  }

  // Zero materials (good for clean reassignment)
  const hasZeroMaterials = Object.values(candidate.materials_real).every(amount => amount === 0);
  if (hasZeroMaterials) {
    score += 30;
  }

  // Same recipe (bonus but not required)
  if (candidate.recipe_code && problemRemision.recipe_code &&
      candidate.recipe_code === problemRemision.recipe_code) {
    score += 15;
  }

  return score;
};

const getCompatibilityIndicators = (problemRemision: StagingRemision, candidate: StagingRemision) => {
  const indicators = [];

  // Driver match
  if (candidate.conductor === problemRemision.conductor) {
    indicators.push({ icon: User, label: 'Mismo conductor', color: 'bg-green-100 text-green-800' });
  }

  // Unit match
  if (candidate.placas === problemRemision.placas) {
    indicators.push({ icon: Truck, label: 'Misma unidad', color: 'bg-blue-100 text-blue-800' });
  }

  // Same day
  const timeDiff = Math.abs(candidate.fecha.getTime() - problemRemision.fecha.getTime());
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) {
    indicators.push({ icon: Calendar, label: 'Mismo día', color: 'bg-yellow-100 text-yellow-800' });
  }

  // Zero materials
  const hasZeroMaterials = Object.values(candidate.materials_real).every(amount => amount === 0);
  if (hasZeroMaterials) {
    indicators.push({ icon: Package, label: 'Sin materiales', color: 'bg-purple-100 text-purple-800' });
  }

  return indicators;
};

interface StatusProcessingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  remision: StagingRemision | null;
  potentialTargets: StagingRemision[];
  onSaveDecision: (decision: StatusProcessingDecision) => void;
}

export default function StatusProcessingDialog({
  isOpen,
  onClose,
  remision,
  potentialTargets,
  onSaveDecision
}: StatusProcessingDialogProps) {
  const [action, setAction] = useState<StatusProcessingAction | ''>('');
  const [targetRemisionNumber, setTargetRemisionNumber] = useState('');
  const [wasteReason, setWasteReason] = useState('');
  const [notes, setNotes] = useState('');
  const [materialsToTransfer, setMaterialsToTransfer] = useState<Record<string, number>>({});

  const resetForm = () => {
    setAction('');
    setTargetRemisionNumber('');
    setWasteReason('');
    setNotes('');
    setMaterialsToTransfer({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = () => {
    if (!remision || !action) return;

    const decision: StatusProcessingDecision = {
      remision_id: remision.id,
      remision_number: remision.remision_number,
      original_status: remision.estatus,
      action: action as StatusProcessingAction,
      notes
    };

    if (action === SPA.REASSIGN_TO_EXISTING) {
      if (!targetRemisionNumber) {
        alert('Selecciona una remisión destino para la reasignación');
        return;
      }
      decision.target_remision_number = targetRemisionNumber;
      decision.materials_to_transfer = Object.keys(materialsToTransfer).length > 0
        ? materialsToTransfer
        : remision.materials_real;
    }

    if (action === SPA.MARK_AS_WASTE) {
      if (!wasteReason) {
        alert('Ingresa la razón del desperdicio');
        return;
      }
      decision.waste_reason = wasteReason;
    }

    onSaveDecision(decision);
    handleClose();
  };

  const initializeMaterialsForTransfer = () => {
    if (remision && Object.keys(materialsToTransfer).length === 0) {
      setMaterialsToTransfer({ ...remision.materials_real });
    }
  };

  const updateMaterialAmount = (materialCode: string, amount: number) => {
    setMaterialsToTransfer(prev => ({
      ...prev,
      [materialCode]: amount
    }));
  };

  if (!remision) return null;

  const getActionTitle = () => {
    switch (action) {
      case SPA.PROCEED_NORMAL: return 'Procesar Normalmente';
      case SPA.REASSIGN_TO_EXISTING: return 'Reasignar Materiales';
      case SPA.MARK_AS_WASTE: return 'Marcar como Desperdicio';
      default: return 'Seleccionar Acción';
    }
  };

  const getStatusColor = (status: string) => {
    if (status.toLowerCase().includes('cancelado')) return 'destructive';
    if (status.toLowerCase().includes('incompleto')) return 'secondary';
    return 'outline';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Procesar Remisión #{remision.remision_number}
          </DialogTitle>
          <DialogDescription>
            Decide cómo procesar esta remisión con estado: {remision.estatus}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Remision Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Detalles de la Remisión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-gray-700">Estado</Label>
                  <div className="mt-1">
                    <Badge variant={getStatusColor(remision.estatus)} className="capitalize">
                      {remision.estatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700">Cliente</Label>
                  <div className="mt-1 font-medium">{remision.cliente_name}</div>
                </div>
                <div>
                  <Label className="text-gray-700">Obra</Label>
                  <div className="mt-1 font-medium">{remision.obra_name}</div>
                </div>
                <div>
                  <Label className="text-gray-700">Volumen</Label>
                  <div className="mt-1 font-medium">{remision.volumen_fabricado.toFixed(1)} m³</div>
                </div>
                <div>
                  <Label className="text-gray-700">Fecha</Label>
                  <div className="mt-1 font-medium">{formatLocalDate(remision.fecha)}</div>
                </div>
                <div>
                  <Label className="text-gray-700">Hora</Label>
                  <div className="mt-1 font-medium">
                    {remision.hora_carga instanceof Date 
                      ? formatLocalTime(remision.hora_carga)
                      : formatLocalTime(new Date(remision.hora_carga as any))
                    }
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700">Conductor</Label>
                  <div className="mt-1 font-medium">{remision.conductor || 'No especificado'}</div>
                </div>
                <div>
                  <Label className="text-gray-700">Camión</Label>
                  <div className="mt-1 font-medium">{remision.placas || 'No especificado'}</div>
                </div>
              </div>

              {/* Materials Used */}
              <div className="mt-6">
                <Label className="text-gray-700 font-medium">Materiales Consumidos</Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(remision.materials_real).map(([materialCode, amount]) => (
                    <div key={materialCode} className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-medium text-sm">{materialCode}</div>
                      <div className="text-lg font-bold text-blue-600">{amount.toFixed(2)} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Seleccionar Acción</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant={action === SPA.PROCEED_NORMAL ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2 min-h-[120px]"
                  onClick={() => setAction(SPA.PROCEED_NORMAL)}
                >
                  <div className="font-medium text-center">Procesar Normal</div>
                  <div className="text-xs text-center opacity-75 leading-relaxed">
                    Continuar con la importación normal de esta remisión
                  </div>
                </Button>

                <Button
                  variant={action === SPA.REASSIGN_TO_EXISTING ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2 min-h-[120px]"
                  onClick={() => {
                    setAction(SPA.REASSIGN_TO_EXISTING);
                    initializeMaterialsForTransfer();
                  }}
                  disabled={potentialTargets.length === 0}
                >
                  <ArrowRight className="h-5 w-5" />
                  <div className="font-medium text-center">Reasignar</div>
                  <div className="text-xs text-center opacity-75 leading-relaxed px-1">
                    Transferir materiales a otra remisión completada
                  </div>
                  {potentialTargets.length === 0 && (
                    <div className="text-xs text-red-600">No hay candidatos</div>
                  )}
                </Button>

                <Button
                  variant={action === SPA.MARK_AS_WASTE ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2 min-h-[120px]"
                  onClick={() => setAction(SPA.MARK_AS_WASTE)}
                >
                  <Trash2 className="h-5 w-5" />
                  <div className="font-medium text-center">Desperdicio</div>
                  <div className="text-xs text-center opacity-75 leading-relaxed">
                    Marcar materiales como desperdicio
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action-specific forms */}
          {action === SPA.REASSIGN_TO_EXISTING && potentialTargets.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Configurar Reasignación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Remision Selection Section */}
                <div className="space-y-2">
                  <Label htmlFor="target-remision" className="text-base font-medium">
                    Remisión Destino
                  </Label>
                  <Select value={targetRemisionNumber} onValueChange={setTargetRemisionNumber}>
                    <SelectTrigger className="h-auto p-3">
                      <SelectValue placeholder="Selecciona remisión destino" />
                    </SelectTrigger>
                    <SelectContent className="w-[480px] max-h-[350px] [&_.select-item]:relative [&_.select-item]:pr-8 [&_.select-item_svg]:hidden">
                      {potentialTargets.map(target => {
                        const indicators = getCompatibilityIndicators(remision, target);
                        const score = calculateCompatibilityScore(remision, target);
                        const hasZeroMaterials = Object.values(target.materials_real).every(amount => amount === 0);

                        return (
                          <SelectItem key={target.id} value={target.remision_number} className="p-2.5 select-item relative">
                            <div className="w-full space-y-2.5 pr-6">
                              {/* Header Row - Full information */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">#{target.remision_number}</span>
                                  {hasZeroMaterials && (
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 px-1.5 py-0.5">
                                      Sin materiales
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right text-xs text-gray-600">
                                  <div className="font-medium">{formatLocalDate(target.fecha)}</div>
                                  <div className="text-gray-500">{target.volumen_fabricado.toFixed(1)} m³</div>
                                </div>
                              </div>

                              {/* Compatibility Row - Full text */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-gray-500">Compatibilidad:</span>
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0.5">
                                    {score} pts
                                  </Badge>
                                </div>
                                <div className="flex gap-1.5">
                                  {indicators.map((indicator, idx) => {
                                    const IconComponent = indicator.icon;
                                    return (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className={`text-xs px-1.5 py-0.5 ${indicator.color}`}
                                        title={indicator.label}
                                      >
                                        <IconComponent className="h-3 w-3 mr-1" />
                                        <span className="text-xs">{indicator.label}</span>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Driver and Unit Info - Full names */}
                              <div className="flex gap-3 text-xs">
                                {target.conductor && (
                                  <div className="flex items-center gap-1.5 text-gray-700">
                                    <User className="h-3 w-3" />
                                    <span className="truncate max-w-[120px]">{target.conductor}</span>
                                  </div>
                                )}
                                {target.placas && (
                                  <div className="flex items-center gap-1.5 text-gray-700">
                                    <Truck className="h-3 w-3" />
                                    <span className="truncate max-w-[80px]">{target.placas}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Custom checkmark on the right side */}
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                              <Check className="h-4 w-4 text-blue-600 opacity-0 group-data-[state=checked]:opacity-100 transition-opacity" />
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  {/* Help Text */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="text-blue-600 mt-0.5">💡</div>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div><strong>Orden de compatibilidad:</strong> mismo conductor y unidad son prioritarios.</div>
                        <div><strong>Ideal:</strong> remisiones sin materiales para reasignaciones limpias.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Materials Transfer Section */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Materiales a Transferir</Label>
                  <div className="space-y-2">
                    {Object.entries(materialsToTransfer).map(([materialCode, amount]) => (
                      <div key={materialCode} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                        <div className="w-20">
                          <Label className="text-sm font-medium text-gray-700">{materialCode}</Label>
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => updateMaterialAmount(materialCode, parseFloat(e.target.value) || 0)}
                            className="w-full h-9"
                          />
                        </div>
                        <div className="w-10 text-center">
                          <span className="text-sm text-gray-600">kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Materials Help Text */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="text-green-600 mt-0.5">💡</div>
                      <div className="text-sm text-green-800">
                        Los materiales se sumarán al consumo real de la remisión destino para análisis de calidad
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {action === SPA.MARK_AS_WASTE && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Configurar Desperdicio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="waste-reason" className="text-base font-medium">
                    Razón del Desperdicio *
                  </Label>
                  <Input
                    id="waste-reason"
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    placeholder="Ej: Cancelación del cliente, falla en bomba, etc."
                    className="h-10 text-sm"
                  />
                </div>
                
                {/* Waste Help Text */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="text-orange-600 mt-0.5">⚠️</div>
                    <div className="text-sm text-orange-800">
                      Los materiales marcados como desperdicio no se importarán al sistema
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes section for all actions */}
          {action && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Notas Adicionales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Información adicional sobre esta decisión..."
                  className="min-h-[80px] text-sm resize-none"
                />
                
                {/* Notes Help Text */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="text-gray-600 mt-0.5">📝</div>
                    <div className="text-sm text-gray-700">
                      Las notas ayudan a documentar la razón de esta decisión para auditorías futuras
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="px-5 py-2"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!action}
              className="bg-blue-600 hover:bg-blue-700 px-5 py-2"
            >
              Guardar Decisión
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
