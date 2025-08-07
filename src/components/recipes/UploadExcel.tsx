/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { recipeService } from '@/lib/supabase/recipes';
import { ExcelRecipeData } from '@/types/recipes';
import { processExcelData } from '@/lib/recipes/excelProcessor';
import { ProcessingStatus } from './ProcessingStatus';
import { Upload, AlertCircle } from 'lucide-react';
import { saveRecipeReferenceMaterials } from '@/lib/recipes/recipeReferenceMaterials';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';

export const UploadExcel = () => {
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  const { profile } = useAuthBridge();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({
    total: 0,
    processed: 0,
    errors: [] as string[]
  });
  const [processedRecipes, setProcessedRecipes] = useState<any[]>([]);
  
  // Plant selection state for recipe uploads
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate plant selection before processing
    if (!selectedPlantId) {
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, 'Debes seleccionar una planta antes de subir las recetas']
      }));
      return;
    }

    // Validate user can create in selected plant
    if (!plantAwareDataService.canCreateInPlant(selectedPlantId, {
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    })) {
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, 'No tienes permisos para crear recetas en la planta seleccionada']
      }));
      return;
    }

    try {
      setIsProcessing(true);
      setStatus({ total: 0, processed: 0, errors: [] });
      setProcessedRecipes([]);

      const recipes = await processExcelData(file);
      
      setProcessedRecipes(recipes);
      setStatus(prev => ({
        ...prev,
        total: recipes.length,
        processed: recipes.length
      }));

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, `Error al procesar el archivo: ${errorMessage}`]
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRecipes = async () => {
    if (!selectedPlantId) {
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, 'Debes seleccionar una planta antes de guardar las recetas']
      }));
      return;
    }

    try {
      setIsProcessing(true);
      setStatus(prev => ({ ...prev, processed: 0, errors: [] }));
      
      for (let i = 0; i < processedRecipes.length; i++) {
        const recipe = processedRecipes[i];
        
        try {
          // Save the recipe with plant_id
          const savedRecipe = await recipeService.saveRecipe(recipe, selectedPlantId, profile?.id);

          // Get the current version for this recipe
          const { data: recipeWithVersions } = await recipeService.getRecipeById(savedRecipe.id!);
          
          if (recipeWithVersions && recipeWithVersions.recipe_versions && recipeWithVersions.recipe_versions.length > 0) {
            const currentVersion = recipeWithVersions.recipe_versions[0];

            // If recipe has reference data, save it to the specific version
            if (currentVersion.id && recipe.referenceData) {
              await saveRecipeReferenceMaterials(currentVersion.id, recipe.referenceData);
            }
          }
          
          // Update progress
          setStatus(prev => ({ ...prev, processed: prev.processed + 1 }));
          
        } catch (recipeError) {
          const errorMessage = recipeError instanceof Error ? recipeError.message : 'Error desconocido';
          setStatus(prev => ({
            ...prev,
            errors: [...prev.errors, `Error al guardar receta ${recipe.recipeCode}: ${errorMessage}`]
          }));
        }
      }
      
      if (status.errors.length === 0) {
        setProcessedRecipes([]);
        alert(`${processedRecipes.length} recetas guardadas exitosamente en la planta seleccionada`);
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, `Error general al guardar las recetas: ${errorMessage}`]
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plant Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Seleccionar Planta para las Recetas</h3>
        <div className="mb-4">
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
        
        {!selectedPlantId && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Debes seleccionar una planta antes de subir recetas.
            </span>
          </div>
        )}
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Cargar Archivo Excel</h3>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-upload"
            disabled={isProcessing || !selectedPlantId}
          />
          <label
            htmlFor="excel-upload"
            className={`cursor-pointer block text-center ${!selectedPlantId ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-500" />
              <span className="text-sm text-gray-600">
                {isProcessing ? (
                  'Procesando archivo...'
                ) : !selectedPlantId ? (
                  'Selecciona una planta primero'
                ) : (
                  'Haz clic aquí o arrastra un archivo Excel'
                )}
              </span>
              {selectedPlantId && (
                <span className="text-xs text-gray-500">
                  Las recetas se guardarán en: {currentPlant?.name || 'Planta seleccionada'}
                </span>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Processing Status */}
      {(isProcessing || status.errors.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <ProcessingStatus
            total={status.total}
            processed={status.processed}
            errors={status.errors}
          />
        </div>
      )}

      {/* Preview and Save */}
      {processedRecipes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Recetas Procesadas ({processedRecipes.length})
            </h3>
            <button
              onClick={handleSaveRecipes}
              disabled={isProcessing || !selectedPlantId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Guardando...' : 'Guardar Todas las Recetas'}
            </button>
          </div>
          
          {selectedPlantId && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Planta de destino:</strong> {currentPlant?.name || 'Planta seleccionada'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Todas las recetas se asignarán a esta planta
              </p>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resistencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Edad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenimiento
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedRecipes.map((recipe, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {recipe.recipeCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {recipe.recipeType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {recipe.characteristics.strength}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {recipe.characteristics.age} días
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {recipe.characteristics.slump} cm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}; 