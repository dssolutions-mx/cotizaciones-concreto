'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Beaker, Zap } from 'lucide-react';
import { RecipeSearchResult } from '@/types/recipes';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface ProfessionalRecipeListProps {
  results: RecipeSearchResult[];
  onSelect: (recipe: RecipeSearchResult) => void;
}

interface GroupedRecipes {
  [recipeType: string]: {
    [strength: string]: {
      [slump: string]: RecipeSearchResult[];
    };
  };
}

export const ProfessionalRecipeList: React.FC<ProfessionalRecipeListProps> = ({ 
  results, 
  onSelect 
}) => {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['FC'])); // Expand FC by default
  const [expandedStrengths, setExpandedStrengths] = useState<Set<string>>(new Set());

  // Group recipes by type → strength → slump (like RecipeList)
  const groupedRecipes = useMemo(() => {
    const grouped: GroupedRecipes = {};
    
    results.forEach(recipe => {
      const spec = recipe.specification;
      const recipeType = recipe.recipe_type || spec?.recipe_type || 'FC';
      const strength = spec?.strength_fc || 0;
      const slump = spec?.slump || 0;
      
      if (!grouped[recipeType]) grouped[recipeType] = {};
      if (!grouped[recipeType][strength]) grouped[recipeType][strength] = {};
      if (!grouped[recipeType][strength][slump]) grouped[recipeType][strength][slump] = [];
      
      grouped[recipeType][strength][slump].push(recipe);
    });
    
    return grouped;
  }, [results]);

  const toggleType = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const toggleStrength = (typeStrengthKey: string) => {
    const newExpanded = new Set(expandedStrengths);
    if (newExpanded.has(typeStrengthKey)) {
      newExpanded.delete(typeStrengthKey);
    } else {
      newExpanded.add(typeStrengthKey);
    }
    setExpandedStrengths(newExpanded);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'FC': return 'Concreto (FC)';
      case 'MR': return 'Mortero (MR)';
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FC': return <Beaker className="h-4 w-4" />;
      case 'MR': return <Zap className="h-4 w-4" />;
      default: return <Beaker className="h-4 w-4" />;
    }
  };

  const countRecipesInGroup = (group: any): number => {
    if (Array.isArray(group)) return group.length;
    return Object.values(group).reduce((sum: number, subGroup) => sum + countRecipesInGroup(subGroup), 0);
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Beaker className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No se encontraron recetas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {Object.entries(groupedRecipes).map(([recipeType, strengthGroups]) => (
        <Card key={recipeType} className="overflow-hidden">
          {/* Recipe Type Header */}
          <div 
            className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors border-b"
            onClick={() => toggleType(recipeType)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedTypes.has(recipeType) ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
                {getTypeIcon(recipeType)}
                <h3 className="font-semibold text-gray-900">{getTypeLabel(recipeType)}</h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {countRecipesInGroup(strengthGroups)} recetas
              </Badge>
            </div>
          </div>

          {/* Strength Groups */}
          {expandedTypes.has(recipeType) && (
            <div>
              {Object.entries(strengthGroups)
                .sort(([a], [b]) => Number(b) - Number(a)) // Sort by strength descending
                .map(([strength, slumpGroups]) => {
                  const typeStrengthKey = `${recipeType}-${strength}`;
                  const isStrengthExpanded = expandedStrengths.has(typeStrengthKey);
                  
                  return (
                    <div key={typeStrengthKey} className="border-b last:border-b-0">
                      {/* Strength Header */}
                      <div 
                        className="p-3 pl-8 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleStrength(typeStrengthKey)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isStrengthExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="font-medium text-gray-800">
                              f'c {strength} MPa
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {countRecipesInGroup(slumpGroups)} recetas
                          </Badge>
                        </div>
                      </div>

                      {/* Slump Groups & Recipes */}
                      {isStrengthExpanded && (
                        <div className="bg-gray-50">
                          {Object.entries(slumpGroups)
                            .sort(([a], [b]) => Number(a) - Number(b)) // Sort by slump ascending
                            .map(([slump, recipes]) => (
                              <div key={`${typeStrengthKey}-${slump}`} className="border-b last:border-b-0">
                                {/* Slump Header */}
                                <div className="p-2 pl-12 bg-gray-100 text-sm font-medium text-gray-700">
                                  Revenimiento {slump} cm ({recipes.length} recetas)
                                </div>
                                
                                {/* Recipe Cards */}
                                <div className="p-4 pl-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {recipes.map(recipe => (
                                    <RecipeCard 
                                      key={recipe.recipe_id} 
                                      recipe={recipe} 
                                      onSelect={onSelect} 
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

const RecipeCard: React.FC<{ 
  recipe: RecipeSearchResult; 
  onSelect: (recipe: RecipeSearchResult) => void; 
}> = ({ recipe, onSelect }) => {
  const spec = recipe.specification;
  const codingSystem = recipe.coding_system || 'legacy';

  return (
    <div 
      className="bg-white border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onSelect(recipe)}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-blue-600 group-hover:text-blue-800 text-sm">
          {recipe.recipe_code}
        </h4>
        <Badge 
          variant={codingSystem === 'new_system' ? 'default' : 'secondary'} 
          className="text-xs"
        >
          {codingSystem === 'new_system' ? 'Nuevo' : 'Legacy'}
        </Badge>
      </div>
      
      <div className="space-y-1 text-xs text-gray-600 mb-3">
        <div className="flex justify-between">
          <span>Edad:</span>
          <span className="font-medium">{spec?.age_days || 'N/A'} días</span>
        </div>
        <div className="flex justify-between">
          <span>Colocación:</span>
          <span className="font-medium">{spec?.placement_type || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>T.M.N.:</span>
          <span className="font-medium">{spec?.max_aggregate_size || 'N/A'} mm</span>
        </div>
        {recipe.has_waterproofing && (
          <div className="text-green-600 font-medium text-xs">✓ Impermeabilizado</div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>v{recipe.current_version_number}</span>
        <div className="flex items-center gap-1 text-blue-600 group-hover:text-blue-800">
          <Eye className="h-3 w-3" />
          <span>Seleccionar</span>
        </div>
      </div>
    </div>
  );
};
