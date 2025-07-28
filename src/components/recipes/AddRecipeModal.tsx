/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantContext } from '@/contexts/PlantContext';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth();
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Plant selection state for recipe creation
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(() => {
    return plantAwareDataService.getDefaultPlantForCreation({
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    });
  });
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string | null>(
    currentPlant?.business_unit_id || null
  );

  const [formData, setFormData] = useState({
    recipeCode: '',
    strengthFc: '',
    ageDays: '28',
    placementType: 'D',
    maxAggregateSize: '',
    slump: '',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate plant selection
    if (!selectedPlantId) {
      setError('Debes seleccionar una planta para crear la receta');
      return;
    }

    // Validate user can create in selected plant
    if (!plantAwareDataService.canCreateInPlant(selectedPlantId, {
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    })) {
      setError('No tienes permisos para crear recetas en la planta seleccionada');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create the recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          recipe_code: formData.recipeCode,
          strength_fc: parseFloat(formData.strengthFc),
          age_days: parseInt(formData.ageDays),
          placement_type: formData.placementType,
          max_aggregate_size: parseFloat(formData.maxAggregateSize),
          slump: parseFloat(formData.slump),
          plant_id: selectedPlantId, // Include plant assignment
          created_by: profile?.id
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // 2. Create the initial version
      const { data: version, error: versionError } = await supabase
        .from('recipe_versions')
        .insert({
          recipe_id: recipe.id,
          version_number: 1,
          effective_date: new Date().toISOString(),
          is_current: true,
          notes: formData.notes || null
        })
        .select()
        .single();

      if (versionError) throw versionError;

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        recipeCode: '',
        strengthFc: '',
        ageDays: '28',
        placementType: 'D',
        maxAggregateSize: '',
        slump: '',
        notes: '',
      });
      
    } catch (err: any) {
      setError(err.message || 'Error al crear la receta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Agregar Nueva Receta</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Plant Selection */}
          <div>
            <EnhancedPlantSelector
              mode="CREATE"
              selectedPlantId={selectedPlantId}
              selectedBusinessUnitId={selectedBusinessUnitId}
              onPlantChange={setSelectedPlantId}
              onBusinessUnitChange={setSelectedBusinessUnitId}
              required
              showLabel
            />
          </div>

          {/* Recipe Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de Receta *
            </label>
            <input
              type="text"
              name="recipeCode"
              value={formData.recipeCode}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: FC-25-28-D-20-10"
            />
          </div>

          {/* Strength */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resistencia f'c (MPa) *
            </label>
            <input
              type="number"
              name="strengthFc"
              value={formData.strengthFc}
              onChange={handleInputChange}
              required
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="25"
            />
          </div>

          {/* Age Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Edad (días) *
            </label>
            <input
              type="number"
              name="ageDays"
              value={formData.ageDays}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Placement Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Colocación *
            </label>
            <select
              name="placementType"
              value={formData.placementType}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="D">Directa</option>
              <option value="B">Bombeado</option>
            </select>
          </div>

          {/* Max Aggregate Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tamaño Máximo de Agregado (mm) *
            </label>
            <input
              type="number"
              name="maxAggregateSize"
              value={formData.maxAggregateSize}
              onChange={handleInputChange}
              required
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="20"
            />
          </div>

          {/* Slump */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Revenimiento (cm) *
            </label>
            <input
              type="number"
              name="slump"
              value={formData.slump}
              onChange={handleInputChange}
              required
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="10"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas / Tipo de Receta
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: FC (Resistencia), MR (Módulo de Rotura), etc."
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPlantId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creando...' : 'Crear Receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 