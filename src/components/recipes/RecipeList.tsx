/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { recipeService } from '@/lib/supabase/recipes';
import { Recipe } from '@/types/recipes';
import { RecipeDetailsModal } from './RecipeDetailsModal';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { usePlantAwareRecipes } from '@/hooks/usePlantAwareRecipes';

interface RecipeListProps {
  hasEditPermission?: boolean;
}

type RecipeWithVersions = Recipe & {
  recipe_versions: { notes?: string }[];
  recipe_type?: string;
  loaded_to_k2?: boolean;
  arkik_long_code?: string;
  arkik_short_code?: string;
};

export const RecipeList = ({ hasEditPermission = false }: RecipeListProps) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  
  // State to manage expanded/collapsed groups
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [expandedStrengths, setExpandedStrengths] = useState<Record<string, Record<number, boolean>>>({});

  // Use plant-aware recipes hook
  const { recipes: rawRecipes, isLoading, error, canCreateRecipe, defaultPlantForCreation } = usePlantAwareRecipes({
    limit: 100,
    autoRefresh: true
  });

  // Cast recipes to the expected type with recipe_versions
  const recipes = rawRecipes as RecipeWithVersions[];

  const toggleSelected = (code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const exportArkik = async () => {
    if (selectedCodes.size === 0) return;
    const codesParam = Array.from(selectedCodes).join(',');
    const params = new URLSearchParams({ recipe_codes: codesParam });
    const res = await fetch(`/api/recipes/export/arkik?${params.toString()}`);
    if (!res.ok) {
      alert('Error al exportar ARKIK');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arkik_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  // Define a proper type for grouped recipes
  type RecipeItem = {
    id: string;
    recipe_code: string;
    [key: string]: unknown;
  };
  
  // Avoid circular reference by using a non-generic index type
  type RecipeGroup = RecipeItem[] | {
    [key: string]: RecipeItem[] | {
      [key: string]: RecipeItem[]
    }
  };

  // Helper function to count recipes in a group
  const countRecipes = (group: unknown): number => {
    if (Array.isArray(group)) {
      return group.length;
    }
    if (typeof group === 'object' && group !== null) {
      return Object.values(group).reduce((sum: number, subGroup) => sum + countRecipes(subGroup), 0);
    }
    return 0;
  };

  if (isLoading) {
    return <div>Cargando recetas...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

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
                className="w-full p-4 bg-white hover:bg-gray-50 flex justify-between items-center cursor-pointer border-b"
              >
                <h3 className="text-lg font-semibold">Tipo: {type}</h3>
                <div className="flex items-center gap-2">
                  <span className="mr-2 text-gray-600">{countRecipes(strengthGroups)} Recetas</span>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); exportArkik(); }}>Exportar ARKIK</Button>
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
                              
                              <div className={`grid gap-4 p-4 pl-8 pr-8 bg-white ${
                                recipesInGroup.length > 1 
                                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                                  : 'grid-cols-1'
                              }`}>
                                {recipesInGroup.map((recipe) => (
                                  <div 
                                    key={recipe.id} 
                                    className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden"
                                  >
                                    <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50">
                                      <div className="flex items-center gap-2">
                                        <Checkbox checked={selectedCodes.has(recipe.recipe_code)} onCheckedChange={() => toggleSelected(recipe.recipe_code)} />
                                        <h3 className="text-lg font-semibold text-gray-800">{recipe.recipe_code}</h3>
                                      </div>
                                      <span className="text-sm text-gray-500">
                                        {recipe.recipe_versions[0]?.notes || 'N/A'}
                                      </span>
                                    </div>
                                    
                                    <div className="p-4">
                                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                        <div className="flex flex-col">
                                          <span className="text-gray-600 mb-1">Edad:</span>
                                          <span className="font-medium">{(recipe as any).age_hours ? `${(recipe as any).age_hours} horas` : `${recipe.age_days} días`}</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-gray-600 mb-1">Colocación:</span>
                                          <span className="font-medium">{recipe.placement_type}</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-gray-600 mb-1">T.M.N.:</span>
                                          <span className="font-medium">{recipe.max_aggregate_size} mm</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-gray-600 mb-1">Revenimiento:</span>
                                          <span className="font-medium">{recipe.slump} cm</span>
                                        </div>
                                        <div className="flex flex-col col-span-2">
                                          <span className="text-gray-600 mb-1">Códigos:</span>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                            <div className="p-2 bg-gray-50 rounded border">
                                              <div className="text-gray-600">Sistema</div>
                                              <div className="font-mono break-all">{recipe.recipe_code}</div>
                                            </div>
                                            <div className="p-2 bg-gray-50 rounded border">
                                              <div className="text-gray-600">ARKIK Largo</div>
                                              <div className="font-mono break-all">{(recipe as any).arkik_long_code || '-'}</div>
                                            </div>
                                            <div className="p-2 bg-gray-50 rounded border">
                                              <div className="text-gray-600">ARKIK Corto</div>
                                              <div className="font-mono break-all">{(recipe as any).arkik_short_code || '-'}</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex justify-end border-t border-gray-100 pt-3">
                                        <button 
                                          onClick={() => recipe.id && handleViewDetails(recipe.id)}
                                          className="bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600 text-sm font-medium"
                                        >
                                          Ver Detalles
                                        </button>
                                      </div>
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