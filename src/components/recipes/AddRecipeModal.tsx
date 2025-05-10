/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState } from 'react';
import { recipeService } from '@/lib/supabase/recipes';
import { saveRecipeReferenceMaterials } from '@/lib/recipes/recipeReferenceMaterials';
import { X } from 'lucide-react';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ 
  isOpen, 
  onClose,
  onSuccess 
}) => {
  const [recipeData, setRecipeData] = useState({
    // Recipe data
    recipeCode: '',
    recipeType: 'FC', // Default to 'FC'
    
    // Characteristics
    strength: '',
    age: '',
    placement: 'D', // Default to 'Directa'
    maxAggregateSize: '',
    slump: '',
    
    // Materials
    cement: '',
    water: '',
    gravel: '',
    gravel40mm: '',
    volcanicSand: '',
    basalticSand: '',
    additive1: '',
    additive2: '',
    
    // Reference data
    sssWater: ''
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRecipeData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsProcessing(true);
      
      // Create an ExcelRecipeData-like object from form data
      const formattedRecipe = {
        recipeCode: recipeData.recipeCode,
        recipeType: recipeData.recipeType as 'FC' | 'MR',
        characteristics: {
          strength: parseFloat(recipeData.strength),
          age: parseInt(recipeData.age),
          placement: recipeData.placement,
          maxAggregateSize: parseFloat(recipeData.maxAggregateSize),
          slump: parseFloat(recipeData.slump)
        },
        materials: {
          cement: parseFloat(recipeData.cement),
          water: parseFloat(recipeData.water),
          gravel: parseFloat(recipeData.gravel),
          ...(recipeData.recipeType === 'MR' && recipeData.gravel40mm && { 
            gravel40mm: parseFloat(recipeData.gravel40mm) 
          }),
          volcanicSand: parseFloat(recipeData.volcanicSand),
          basalticSand: parseFloat(recipeData.basalticSand),
          additive1: parseFloat(recipeData.additive1),
          additive2: parseFloat(recipeData.additive2)
        },
        referenceData: recipeData.sssWater ? {
          sssWater: parseFloat(recipeData.sssWater)
        } : undefined
      };
      
      // Validate required fields
      if (!formattedRecipe.recipeCode) {
        throw new Error('El código de receta es obligatorio');
      }
      
      if (isNaN(formattedRecipe.characteristics.strength)) {
        throw new Error('La resistencia debe ser un número válido');
      }
      
      // Save the recipe
      const savedRecipe = await recipeService.saveRecipe(formattedRecipe);
      
      // Get the current version for this recipe
      const { data: recipeWithVersions } = await recipeService.getRecipeById(savedRecipe.id!);
      
      if (recipeWithVersions && recipeWithVersions.recipe_versions && recipeWithVersions.recipe_versions.length > 0) {
        const currentVersion = recipeWithVersions.recipe_versions[0];

        // If recipe has reference data, save it to the specific version
        if (currentVersion.id && formattedRecipe.referenceData) {
          await saveRecipeReferenceMaterials(currentVersion.id, formattedRecipe.referenceData);
        }
      }
      
      // Reset form and call success callback
      setRecipeData({
        recipeCode: '',
        recipeType: 'FC',
        strength: '',
        age: '',
        placement: 'D',
        maxAggregateSize: '',
        slump: '',
        cement: '',
        water: '',
        gravel: '',
        gravel40mm: '',
        volcanicSand: '',
        basalticSand: '',
        additive1: '',
        additive2: '',
        sssWater: ''
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (err) {
      console.error('Error al guardar la receta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">Agregar Nueva Receta</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-lg mb-4 border-b pb-2">Información General</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de Receta *</label>
                  <input
                    type="text"
                    name="recipeCode"
                    value={recipeData.recipeCode}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md p-2"
                    placeholder="ej. F100-10-D"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Receta *</label>
                  <select
                    name="recipeType"
                    value={recipeData.recipeType}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md p-2"
                  >
                    <option value="FC">FC (Resistencia a Compresión)</option>
                    <option value="MR">MR (Módulo de Ruptura)</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4 border-b pb-2">Características</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resistencia (kg/cm²) *</label>
                    <input
                      type="number"
                      name="strength"
                      value={recipeData.strength}
                      onChange={handleInputChange}
                      required
                      className="w-full border border-gray-300 rounded-md p-2"
                      placeholder="ej. 100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Edad (días) *</label>
                    <input
                      type="number"
                      name="age"
                      value={recipeData.age}
                      onChange={handleInputChange}
                      required
                      className="w-full border border-gray-300 rounded-md p-2"
                      placeholder="ej. 28"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño Máx. Agregado (mm) *</label>
                    <input
                      type="number"
                      name="maxAggregateSize"
                      value={recipeData.maxAggregateSize}
                      onChange={handleInputChange}
                      required
                      className="w-full border border-gray-300 rounded-md p-2"
                      placeholder="ej. 20"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Revenimiento (cm) *</label>
                    <input
                      type="number"
                      name="slump"
                      value={recipeData.slump}
                      onChange={handleInputChange}
                      required
                      className="w-full border border-gray-300 rounded-md p-2"
                      placeholder="ej. 10"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Colocación *</label>
                  <select
                    name="placement"
                    value={recipeData.placement}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md p-2"
                  >
                    <option value="D">Directa</option>
                    <option value="B">Bombeado</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-4 border-b pb-2">Cantidades de Materiales</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cemento (kg/m³) *</label>
                <input
                  type="number"
                  name="cement"
                  value={recipeData.cement}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agua (l/m³) *</label>
                <input
                  type="number"
                  name="water"
                  value={recipeData.water}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grava 20mm (kg/m³) *</label>
                <input
                  type="number"
                  name="gravel"
                  value={recipeData.gravel}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grava 40mm (kg/m³) {recipeData.recipeType === 'MR' ? '*' : ''}
                </label>
                <input
                  type="number"
                  name="gravel40mm"
                  value={recipeData.gravel40mm}
                  onChange={handleInputChange}
                  required={recipeData.recipeType === 'MR'}
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                  disabled={recipeData.recipeType !== 'MR'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arena Volcánica (kg/m³) *</label>
                <input
                  type="number"
                  name="volcanicSand"
                  value={recipeData.volcanicSand}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arena Basáltica (kg/m³) *</label>
                <input
                  type="number"
                  name="basalticSand"
                  value={recipeData.basalticSand}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aditivo 1 (l/m³) *</label>
                <input
                  type="number"
                  name="additive1"
                  value={recipeData.additive1}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aditivo 2 (l/m³) *</label>
                <input
                  type="number"
                  name="additive2"
                  value={recipeData.additive2}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-4 border-b pb-2">Materiales de Referencia</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agua SSS (kg/m³)</label>
              <input
                type="number"
                name="sssWater"
                value={recipeData.sssWater}
                onChange={handleInputChange}
                step="0.01"
                className="w-full border border-gray-300 rounded-md p-2"
              />
              <p className="text-xs text-gray-500 mt-1">Valor de referencia para agua en condición Saturada con Superficie Seca</p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {isProcessing ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 