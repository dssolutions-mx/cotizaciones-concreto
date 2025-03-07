'use client';

import React, { useState, useEffect } from 'react';
import { recipeService } from '@/lib/supabase/recipes';
import { Recipe } from '@/types/recipes';
import { RecipeDetailsModal } from './RecipeDetailsModal';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';

interface RecipeListProps {
  hasEditPermission?: boolean;
}

export const RecipeList = ({ hasEditPermission = false }: RecipeListProps) => {
  const [recipes, setRecipes] = useState<(Recipe & { recipe_versions: { notes?: string }[] })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  
  // State to manage expanded/collapsed groups
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [expandedStrengths, setExpandedStrengths] = useState<Record<string, Record<number, boolean>>>({});

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const { data: fetchedRecipes } = await recipeService.getRecipes();
        setRecipes(fetchedRecipes);
      } catch (err) {
        setError('Error al cargar las recetas');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  const handleViewDetails = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
  };

  const handleCloseModal = () => {
    setSelectedRecipeId(null);
  };

  // Toggle type expansion
  const toggleTypeExpansion = (type: string) => {
    setExpandedTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Toggle strength expansion within a type
  const toggleStrengthExpansion = (type: string, strength: number) => {
    setExpandedStrengths(prev => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [strength]: !(prev[type]?.[strength] ?? false)
      }
    }));
  };

  // Group recipes by type, strength, and slump
  const groupedRecipes = recipes.reduce((acc, recipe) => {
    // Use the first recipe version's notes to determine the type
    const type = recipe.recipe_versions[0]?.notes?.trim() || 'Sin Tipo';
    const strength = recipe.strength_fc;
    const slump = recipe.slump;

    if (!acc[type]) {
      acc[type] = {};
    }
    if (!acc[type][strength]) {
      acc[type][strength] = {};
    }
    if (!acc[type][strength][slump]) {
      acc[type][strength][slump] = [];
    }
    acc[type][strength][slump].push(recipe);

    return acc;
  }, {} as Record<string, Record<number, Record<number, (Recipe & { recipe_versions: { notes?: string }[] })[]>>>);

  if (isLoading) {
    return <div>Cargando recetas...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  // Helper function to count recipes in a group
  const countRecipes = (group: any): number => {
    if (Array.isArray(group)) {
      return group.length;
    }
    return Object.values(group).reduce((sum: number, subGroup: any) => sum + countRecipes(subGroup), 0);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Lista de Recetas</h2>
      
      {Object.keys(groupedRecipes).length === 0 ? (
        <div className="text-gray-500">No hay recetas disponibles</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRecipes).map(([type, strengthGroups]) => (
            <div key={type} className="border rounded-lg overflow-hidden">
              <div 
                onClick={() => toggleTypeExpansion(type)}
                className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center cursor-pointer"
              >
                <h3 className="text-lg font-semibold">Tipo: {type}</h3>
                <div className="flex items-center">
                  <span className="mr-2 text-gray-600">{countRecipes(strengthGroups)} Recetas</span>
                  <svg
                    className={`w-5 h-5 transform transition-transform ${
                      expandedTypes[type] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              
              {expandedTypes[type] && (
                <div className="border-t">
                  {Object.entries(strengthGroups).map(([strength, slumpGroups]) => (
                    <div key={`${type}-${strength}`} className="border-b last:border-b-0">
                      <div 
                        onClick={() => toggleStrengthExpansion(type, Number(strength))}
                        className="w-full p-3 pl-6 bg-white hover:bg-gray-50 flex justify-between items-center cursor-pointer"
                      >
                        <h4 className="text-md font-medium">Resistencia: {strength} Kg/cm²</h4>
                        <div className="flex items-center">
                          <span className="mr-2 text-gray-600">{countRecipes(slumpGroups)} Recetas</span>
                          <svg
                            className={`w-4 h-4 transform transition-transform ${
                              expandedStrengths[type]?.[Number(strength)] ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                      
                      {expandedStrengths[type]?.[Number(strength)] && (
                        <div className="border-t">
                          {Object.entries(slumpGroups).map(([slump, recipesInGroup]) => (
                            <div key={`${type}-${strength}-${slump}`} className="border-b last:border-b-0">
                              <div className="w-full p-2 pl-8 bg-white hover:bg-gray-50 flex justify-between items-center">
                                <h5 className="text-sm font-medium">Revenimiento: {slump} cm</h5>
                                <span className="text-gray-600">{recipesInGroup.length} Recetas</span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pl-10 bg-gray-50">
                                {recipesInGroup.map((recipe) => (
                                  <div 
                                    key={recipe.id} 
                                    className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition-shadow"
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <h3 className="text-lg font-semibold">{recipe.recipe_code}</h3>
                                      <span className="text-sm text-gray-500">
                                        {recipe.recipe_versions[0]?.notes || 'N/A'}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-gray-600">Edad:</span>
                                        <span className="ml-2">{recipe.age_days} días</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Colocación:</span>
                                        <span className="ml-2">{recipe.placement_type}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">T.M.N.:</span>
                                        <span className="ml-2">{recipe.max_aggregate_size} mm</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Revenimiento:</span>
                                        <span className="ml-2">{recipe.slump} cm</span>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-4 flex justify-end">
                                      <button 
                                        onClick={() => recipe.id && handleViewDetails(recipe.id)}
                                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                                      >
                                        Ver Detalles
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedRecipeId && (
        <RecipeDetailsModal 
          recipeId={selectedRecipeId} 
          isOpen={!!selectedRecipeId} 
          onClose={handleCloseModal} 
          hasEditPermission={hasEditPermission} 
        />
      )}
    </div>
  );
}; 