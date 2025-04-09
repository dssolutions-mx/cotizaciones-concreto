/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { recipeService } from '@/lib/supabase/recipes';
import { ExcelRecipeData } from '@/types/recipes';
import { processExcelData } from '@/lib/recipes/excelProcessor';
import { ProcessingStatus } from './ProcessingStatus';
import { Upload } from 'lucide-react';
import { saveRecipeReferenceMaterials } from '@/lib/recipes/recipeReferenceMaterials';

export const UploadExcel = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({
    total: 0,
    processed: 0,
    errors: [] as string[]
  });
  const [processedRecipes, setProcessedRecipes] = useState<any[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    try {
      setIsProcessing(true);
      for (const recipe of processedRecipes) {
        // Save the recipe
        const savedRecipe = await recipeService.saveRecipe(recipe);

        // Get the current version for this recipe
        const { data: recipeWithVersions } = await recipeService.getRecipeById(savedRecipe.id!);
        
        if (recipeWithVersions && recipeWithVersions.recipe_versions && recipeWithVersions.recipe_versions.length > 0) {
          const currentVersion = recipeWithVersions.recipe_versions[0];

          // If recipe has reference data, save it to the specific version
          if (currentVersion.id && recipe.referenceData) {
            await saveRecipeReferenceMaterials(currentVersion.id, recipe.referenceData);
          }
        }
      }
      setProcessedRecipes([]);
      alert('Recetas guardadas exitosamente');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, `Error al guardar las recetas: ${errorMessage}`]
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="excel-upload"
          disabled={isProcessing}
        />
        <label
          htmlFor="excel-upload"
          className="cursor-pointer block text-center"
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-500" />
            <span className="text-sm text-gray-600">
              {isProcessing ? (
                'Procesando archivo...'
              ) : (
                'Haz clic aquí o arrastra un archivo Excel'
              )}
            </span>
          </div>
        </label>
      </div>

      {/* Mostrar estado del procesamiento */}
      {(isProcessing || status.errors.length > 0) && (
        <ProcessingStatus
          total={status.total}
          processed={status.processed}
          errors={status.errors}
        />
      )}

      {/* Mostrar recetas procesadas */}
      {processedRecipes.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Recetas Procesadas</h3>
          </div>
          <div className="overflow-x-auto">
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
                    f&apos;c/MR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Edad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coloc.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    T.M.N.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rev.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cemento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agua
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grava
                  </th>
                  {processedRecipes.some(r => r.recipeType === 'MR') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grava 40mm
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arena V.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arena B.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adit. 1
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adit. 2
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedRecipes.map((recipe, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.recipeCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        px-2 py-1 rounded-full text-xs font-medium
                        ${recipe.recipeType === 'FC' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                        }
                      `}>
                        {recipe.recipeType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.characteristics.strength}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.characteristics.age}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.characteristics.placement}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.characteristics.maxAggregateSize}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.characteristics.slump}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.cement}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.water}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.gravel}</td>
                    {processedRecipes.some(r => r.recipeType === 'MR') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {recipe.recipeType === 'MR' ? recipe.materials.gravel40mm : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.volcanicSand}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.basalticSand}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.additive1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipe.materials.additive2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSaveRecipes}
              disabled={isProcessing}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isProcessing ? 'Guardando...' : 'Guardar Recetas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 