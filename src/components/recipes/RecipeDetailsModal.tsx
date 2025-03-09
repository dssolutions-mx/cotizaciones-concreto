/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { recipeService } from '@/lib/supabase/recipes';
import { getRecipeReferenceMaterials } from '@/lib/recipes/recipeReferenceMaterials';
import { Recipe, RecipeVersion, MaterialQuantity, RecipeReferenceMaterial } from '@/types/recipes';
import { supabase } from '@/lib/supabase';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';

interface RecipeDetailsModalProps {
  recipeId: string;
  isOpen: boolean;
  onClose: () => void;
  hasEditPermission?: boolean;
}

export const RecipeDetailsModal: React.FC<RecipeDetailsModalProps> = ({ 
  recipeId, 
  isOpen, 
  onClose,
  hasEditPermission = false
}) => {
  const [recipeDetails, setRecipeDetails] = useState<{
    recipe: Recipe, 
    versions: RecipeVersion[], 
    materials: MaterialQuantity[]
  } | null>(null);
  const [referenceMaterials, setReferenceMaterials] = useState<RecipeReferenceMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingK2Status, setIsUpdatingK2Status] = useState(false);

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      if (!isOpen || !recipeId) return;

      try {
        setIsLoading(true);
        // Fetch recipe details
        const details = await recipeService.getRecipeDetails(recipeId);
        setRecipeDetails(details);

        // Find the current version
        const currentVersion = details.versions.find(v => v.is_current);
        
        if (currentVersion) {
          // Fetch reference materials for the current version
          const refMaterials = await getRecipeReferenceMaterials(currentVersion.id!);
          setReferenceMaterials(refMaterials);
        }
      } catch (err) {
        console.error('Error fetching recipe details:', err);
        setError('No se pudieron cargar los detalles de la receta');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipeDetails();
  }, [recipeId, isOpen]);

  const updateK2LoadStatus = async (versionId: string, isLoaded: boolean) => {
    if (!hasEditPermission) {
      console.warn('User does not have permission to update K2 status');
      return;
    }
    
    try {
      setIsUpdatingK2Status(true);
      
      // Update directly with supabase
      const { error: updateError } = await supabase
        .from('recipe_versions')
        .update({ loaded_to_k2: isLoaded })
        .eq('id', versionId);
      
      if (updateError) throw updateError;
      
      // Update local state to reflect changes
      setRecipeDetails(prev => {
        if (!prev) return null;
        
        const updatedVersions = prev.versions.map(v => 
          v.id === versionId ? { ...v, loaded_to_k2: isLoaded } : v
        );
        
        return {
          ...prev,
          versions: updatedVersions
        };
      });
    } catch (err) {
      console.error('Error updating K2 status:', err);
      setError('No se pudo actualizar el estado de carga a K2');
    } finally {
      setIsUpdatingK2Status(false);
    }
  };

  if (!isOpen) return null;

  const renderMaterialRow = (material: MaterialQuantity) => {
    const materialNames: { [key: string]: string } = {
      'additive1': 'Aditivo 1',
      'additive2': 'Aditivo 2',
      'water': 'Agua',
      'basalticSand': 'Arena Basáltica',
      'gravel40mm': 'Grava 40mm',
      'gravel': 'Grava 20mm',
      'volcanicSand': 'Arena Volcánica',
      'cement': 'Cemento'
    };

    return (
      <tr key={material.id} className="border-b">
        <td className="py-2 px-4">{materialNames[material.material_type] || material.material_type}</td>
        <td className="py-2 px-4 text-right">{material.quantity.toFixed(2)} {material.unit}</td>
      </tr>
    );
  };

  // Custom sorting function for materials
  const sortedMaterials = recipeDetails?.materials ? 
    recipeDetails.materials.sort((a, b) => {
      const materialOrder = [
        'additive1', 
        'additive2', 
        'water', 
        'basalticSand', 
        'gravel40mm', 
        'gravel', 
        'volcanicSand', 
        'cement'
      ];
      
      return materialOrder.indexOf(a.material_type) - materialOrder.indexOf(b.material_type);
    }) 
    : [];

  const renderReferenceMaterialRow = (material: RecipeReferenceMaterial) => {
    const materialNames: { [key: string]: string } = {
      'basaltic_sand': 'Arena Basáltica',
      'volcanic_sand': 'Arena Volcánica',
      'gravel_20mm': 'Grava 20mm',
      'gravel_40mm': 'Grava 40mm',
      'water': 'Agua (SSS)'
    };

    return (
      <tr key={material.id} className="border-b">
        <td className="py-2 px-4">{materialNames[material.material_type] || material.material_type}</td>
        <td className="py-2 px-4 text-right">{material.sss_value.toFixed(2)} kg/m³</td>
      </tr>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <p>Cargando detalles de la receta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={onClose} 
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (!recipeDetails) return null;

  const { recipe, versions, materials } = recipeDetails;
  const currentVersion = versions.find(v => v.is_current);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Detalles de Receta: {recipe.recipe_code}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-600 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="font-semibold text-lg mb-2">Características</h3>
            <div className="space-y-2">
              <p><span className="font-medium">Resistencia:</span> {recipe.strength_fc} Kg/cm²</p>
              <p><span className="font-medium">Edad:</span> {recipe.age_days} días</p>
              <p><span className="font-medium">Colocación:</span> {recipe.placement_type}</p>
              <p><span className="font-medium">Tamaño Máximo de Agregado:</span> {recipe.max_aggregate_size} mm</p>
              <p><span className="font-medium">Revenimiento:</span> {recipe.slump} cm</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Versión Actual</h3>
            {currentVersion && (
              <div className="space-y-2">
                <p><span className="font-medium">Número de Versión:</span> {currentVersion.version_number}</p>
                <p><span className="font-medium">Fecha de Efectividad:</span> {new Date(currentVersion.effective_date).toLocaleDateString()}</p>
                {currentVersion.notes && (
                  <p><span className="font-medium">Notas:</span> {currentVersion.notes}</p>
                )}
                <div className="flex items-center mt-3">
                  <span className="font-medium mr-2">Cargada en K2:</span>
                  <RoleProtectedButton
                    allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
                    onClick={() => updateK2LoadStatus(currentVersion.id!, !currentVersion.loaded_to_k2)}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded"
                    disabled={isUpdatingK2Status}
                    showDisabled={true}
                  >
                    {currentVersion.loaded_to_k2 ? 'Marcar como No Cargado' : 'Marcar como Cargado a K2'}
                  </RoleProtectedButton>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">Cantidades de Materiales</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 text-left">Material</th>
                <th className="py-2 px-4 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {sortedMaterials.map(renderMaterialRow)}
            </tbody>
          </table>
        </div>

        {referenceMaterials.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-2">Materiales de Referencia (SSS)</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 text-left">Material</th>
                  <th className="py-2 px-4 text-right">Valor SSS</th>
                </tr>
              </thead>
              <tbody>
                {referenceMaterials.map(renderReferenceMaterialRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}; 