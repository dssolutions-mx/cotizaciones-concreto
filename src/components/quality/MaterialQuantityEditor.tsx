'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { MaterialQuantityWithDetails, AvailableMaterial } from '@/lib/services/recipeGovernanceService';

interface MaterialQuantityEditorProps {
  variantId: string;
  materials: MaterialQuantityWithDetails[];
  availableMaterials: AvailableMaterial[];
  latestVersionId: string;
  onSave: (materials: MaterialQuantityWithDetails[]) => Promise<void>;
  onCancel: () => void;
}

export default function MaterialQuantityEditor({
  variantId,
  materials: initialMaterials,
  availableMaterials,
  latestVersionId,
  onSave,
  onCancel,
}: MaterialQuantityEditorProps) {
  const [editedMaterials, setEditedMaterials] = useState<MaterialQuantityWithDetails[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [newMaterialId, setNewMaterialId] = useState<string>('');

  useEffect(() => {
    // Initialize edited materials from initial materials
    setEditedMaterials(
      initialMaterials.map(m => ({
        ...m,
        recipe_version_id: latestVersionId, // Ensure version ID is set
      }))
    );
  }, [initialMaterials, latestVersionId]);

  const validateMaterials = (): boolean => {
    const newErrors: Record<number, string> = {};

    editedMaterials.forEach((material, index) => {
      if (!material.material_id && !material.material_type) {
        newErrors[index] = 'Material es requerido';
      }
      if (!material.quantity || material.quantity <= 0) {
        newErrors[index] = 'Cantidad debe ser mayor a 0';
      }
      if (!material.unit) {
        newErrors[index] = 'Unidad es requerida';
      }
    });

    // Check for duplicates
    const materialIds = editedMaterials
      .map(m => m.material_id || m.material_type)
      .filter(Boolean);
    const duplicates = materialIds.filter((id, index) => materialIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      editedMaterials.forEach((material, index) => {
        const id = material.material_id || material.material_type;
        if (duplicates.includes(id)) {
          newErrors[index] = 'Material duplicado';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const numValue = parseFloat(quantity);
    if (isNaN(numValue) && quantity !== '' && quantity !== '-') {
      return;
    }

    const updated = [...editedMaterials];
    updated[index] = {
      ...updated[index],
      quantity: quantity === '' || quantity === '-' ? 0 : numValue,
    };
    setEditedMaterials(updated);

    // Clear error for this field
    if (errors[index]) {
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    }
  };

  const handleUnitChange = (index: number, unit: string) => {
    const updated = [...editedMaterials];
    updated[index] = {
      ...updated[index],
      unit,
    };
    setEditedMaterials(updated);
  };

  const handleAddMaterial = () => {
    if (!newMaterialId) {
      toast.error('Por favor selecciona un material');
      return;
    }

    const material = availableMaterials.find(m => m.id === newMaterialId);
    if (!material) {
      toast.error('Material no encontrado');
      return;
    }

    // Check if material already exists
    const exists = editedMaterials.some(
      m => m.material_id === newMaterialId || m.material_type === material.material_code
    );
    if (exists) {
      toast.error('Este material ya está agregado');
      return;
    }

    const newMaterial: MaterialQuantityWithDetails = {
      recipe_version_id: latestVersionId,
      material_id: material.id,
      material_type: material.material_code, // Fallback for legacy
      quantity: 0,
      unit: material.unit,
      material: {
        id: material.id,
        material_name: material.material_name,
        material_code: material.material_code,
        category: material.category,
      },
    };

    setEditedMaterials([...editedMaterials, newMaterial]);
    setNewMaterialId('');
  };

  const handleRemoveMaterial = (index: number) => {
    if (editedMaterials.length <= 1) {
      toast.error('Debe haber al menos un material');
      return;
    }
    const updated = editedMaterials.filter((_, i) => i !== index);
    setEditedMaterials(updated);
  };

  const handleSave = async () => {
    if (!validateMaterials()) {
      toast.error('Por favor corrige los errores antes de guardar');
      return;
    }

    if (editedMaterials.length === 0) {
      toast.error('Debe haber al menos un material');
      return;
    }

    setSaving(true);
    try {
      await onSave(editedMaterials);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setSaving(false);
    }
  };

  // Get materials not already added
  const availableToAdd = availableMaterials.filter(
    m => !editedMaterials.some(em => em.material_id === m.id)
  );

  return (
    <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h5 className="font-semibold text-gray-900">Editar Materiales</h5>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            variant="default"
          >
            {saving ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Guardar
              </>
            )}
          </Button>
          <Button
            onClick={onCancel}
            disabled={saving}
            size="sm"
            variant="outline"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-gray-700">Material</th>
              <th className="text-right p-3 font-medium text-gray-700">Cantidad</th>
              <th className="text-left p-3 font-medium text-gray-700">Unidad</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {editedMaterials.map((material, index) => {
              const materialName = material.material?.material_name || material.material_type;
              const hasError = !!errors[index];

              return (
                <tr key={material.id || index} className={`border-b ${hasError ? 'bg-red-50' : ''}`}>
                  <td className="p-3">
                    <div>
                      <div className="font-medium">{materialName}</div>
                      {material.material?.material_code && (
                        <div className="text-xs text-gray-500">{material.material.material_code}</div>
                      )}
                      {hasError && (
                        <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors[index]}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={material.quantity || ''}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      className={`w-24 text-right ${hasError ? 'border-red-300' : ''}`}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-3">
                    <Select
                      value={material.unit}
                      onValueChange={(value) => handleUnitChange(index, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg/m³">kg/m³</SelectItem>
                        <SelectItem value="l/m³">l/m³</SelectItem>
                        <SelectItem value="m³/m³">m³/m³</SelectItem>
                        <SelectItem value="unidad/m³">unidad/m³</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {editedMaterials.length > 1 && (
                      <Button
                        onClick={() => handleRemoveMaterial(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Material */}
      {availableToAdd.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Agregar Material
            </label>
            <Select value={newMaterialId} onValueChange={setNewMaterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar material..." />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.material_name} ({material.material_code}) - {material.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAddMaterial}
            variant="outline"
            size="sm"
            disabled={!newMaterialId}
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        </div>
      )}

      {availableToAdd.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-2">
          Todos los materiales disponibles ya están agregados
        </p>
      )}
    </div>
  );
}
