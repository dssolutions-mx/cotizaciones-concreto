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
import { AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import type { StagingRemision, StatusProcessingDecision, StatusProcessingAction } from '@/types/arkik';

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

    if (action === 'reassign_to_existing') {
      if (!targetRemisionNumber) {
        alert('Selecciona una remisión destino para la reasignación');
        return;
      }
      decision.target_remision_number = targetRemisionNumber;
      decision.materials_to_transfer = Object.keys(materialsToTransfer).length > 0 
        ? materialsToTransfer 
        : remision.materials_real;
    }

    if (action === 'mark_as_waste') {
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
      case 'proceed_normal': return 'Procesar Normalmente';
      case 'reassign_to_existing': return 'Reasignar Materiales';
      case 'mark_as_waste': return 'Marcar como Desperdicio';
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  variant={action === 'proceed_normal' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setAction('proceed_normal')}
                >
                  <div className="font-medium">Procesar Normal</div>
                  <div className="text-xs text-center opacity-75">
                    Continuar con la importación normal de esta remisión
                  </div>
                </Button>

                <Button
                  variant={action === 'reassign_to_existing' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => {
                    setAction('reassign_to_existing');
                    initializeMaterialsForTransfer();
                  }}
                  disabled={potentialTargets.length === 0}
                >
                  <ArrowRight className="h-5 w-5" />
                  <div className="font-medium">Reasignar</div>
                  <div className="text-xs text-center opacity-75">
                    Transferir materiales a otra remisión completada
                  </div>
                  {potentialTargets.length === 0 && (
                    <div className="text-xs text-red-600">No hay candidatos</div>
                  )}
                </Button>

                <Button
                  variant={action === 'mark_as_waste' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setAction('mark_as_waste')}
                >
                  <Trash2 className="h-5 w-5" />
                  <div className="font-medium">Desperdicio</div>
                  <div className="text-xs text-center opacity-75">
                    Marcar materiales como desperdicio
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action-specific forms */}
          {action === 'reassign_to_existing' && potentialTargets.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Configurar Reasignación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="target-remision">Remisión Destino</Label>
                  <Select value={targetRemisionNumber} onValueChange={setTargetRemisionNumber}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona remisión destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {potentialTargets.map(target => (
                        <SelectItem key={target.id} value={target.remision_number}>
                          <div className="flex items-center justify-between w-full">
                            <span>#{target.remision_number}</span>
                            <span className="text-sm text-gray-500 ml-4">
                              {formatLocalDate(target.fecha)} - {target.volumen_fabricado.toFixed(1)}m³
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Materiales a Transferir</Label>
                  <div className="mt-2 space-y-3">
                    {Object.entries(materialsToTransfer).map(([materialCode, amount]) => (
                      <div key={materialCode} className="flex items-center gap-3">
                        <Label className="w-20 text-sm">{materialCode}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => updateMaterialAmount(materialCode, parseFloat(e.target.value) || 0)}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-500">kg</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    💡 Los materiales se sumarán al consumo real de la remisión destino para análisis de calidad
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {action === 'mark_as_waste' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Configurar Desperdicio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="waste-reason">Razón del Desperdicio *</Label>
                  <Input
                    id="waste-reason"
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    placeholder="Ej: Cancelación del cliente, falla en bomba, etc."
                    className="mt-1"
                  />
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
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Información adicional sobre esta decisión..."
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!action}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Guardar Decisión
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
