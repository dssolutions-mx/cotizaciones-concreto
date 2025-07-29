'use client';

import React, { useState } from 'react';
import { X, Search, Filter, Eye } from 'lucide-react';
import { recipeService } from '@/lib/supabase/recipes';
import { RecipeSearchFilters, RecipeSearchResult, RecipeSpecification } from '@/types/recipes';
import { usePlantContext } from '@/contexts/PlantContext';

interface RecipeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSelect: (recipe: RecipeSearchResult) => void;
}

export const RecipeSearchModal: React.FC<RecipeSearchModalProps> = ({
  isOpen,
  onClose,
  onRecipeSelect
}) => {
  const { currentPlant } = usePlantContext();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<RecipeSearchFilters>({
    strength_fc: undefined,
    age_days: undefined,
    placement_type: undefined,
    max_aggregate_size: undefined,
    slump: undefined,
    application_type: undefined,
    has_waterproofing: undefined,
    performance_grade: undefined,
    plant_id: currentPlant?.id,
    recipe_type: undefined
  });

  if (!isOpen) return null;

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);

    try {
      // Remove undefined values from filters
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ) as RecipeSearchFilters;

      const results = await recipeService.findRecipesBySpecifications(cleanFilters);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || 'Error al buscar recetas');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterChange = (field: keyof RecipeSearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
  };

  const handleRecipeSelect = (recipe: RecipeSearchResult) => {
    onRecipeSelect(recipe);
    onClose();
  };

  const getApplicationTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      'standard': 'Estándar',
      'pavimento': 'Pavimento',
      'relleno_fluido': 'Relleno Fluido',
      'mortero': 'Mortero'
    };
    return labels[type || ''] || type || 'N/A';
  };

  const getPerformanceGradeLabel = (grade?: string) => {
    const labels: Record<string, string> = {
      'standard': 'Estándar',
      'high_performance': 'Alto Rendimiento',
      'rapid': 'Rápido'
    };
    return labels[grade || ''] || grade || 'N/A';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Buscar Recetas por Especificaciones</h2>
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

        {/* Search Filters */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Filtros de Búsqueda</h3>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600"
            >
              <Filter size={16} />
              {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
              {/* Strength */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resistencia f'c (MPa)
                </label>
                <input
                  type="number"
                  value={filters.strength_fc || ''}
                  onChange={(e) => handleFilterChange('strength_fc', e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="25"
                />
              </div>

              {/* Age Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Edad (días)
                </label>
                <input
                  type="number"
                  value={filters.age_days || ''}
                  onChange={(e) => handleFilterChange('age_days', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="28"
                />
              </div>

              {/* Placement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Colocación
                </label>
                <select
                  value={filters.placement_type || ''}
                  onChange={(e) => handleFilterChange('placement_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="D">Directa</option>
                  <option value="B">Bombeado</option>
                </select>
              </div>

              {/* Max Aggregate Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamaño Máx. Agregado (mm)
                </label>
                <input
                  type="number"
                  value={filters.max_aggregate_size || ''}
                  onChange={(e) => handleFilterChange('max_aggregate_size', e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="20"
                />
              </div>

              {/* Slump */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Revenimiento (cm)
                </label>
                <input
                  type="number"
                  value={filters.slump || ''}
                  onChange={(e) => handleFilterChange('slump', e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>

              {/* Application Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Aplicación
                </label>
                <select
                  value={filters.application_type || ''}
                  onChange={(e) => handleFilterChange('application_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="standard">Estándar</option>
                  <option value="pavimento">Pavimento</option>
                  <option value="relleno_fluido">Relleno Fluido</option>
                  <option value="mortero">Mortero</option>
                </select>
              </div>

              {/* Performance Grade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grado de Rendimiento
                </label>
                <select
                  value={filters.performance_grade || ''}
                  onChange={(e) => handleFilterChange('performance_grade', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="standard">Estándar</option>
                  <option value="high_performance">Alto Rendimiento</option>
                  <option value="rapid">Rápido</option>
                </select>
              </div>

              {/* Has Waterproofing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impermeabilización
                </label>
                <select
                  value={filters.has_waterproofing === undefined ? '' : filters.has_waterproofing.toString()}
                  onChange={(e) => handleFilterChange('has_waterproofing', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="true">Con Impermeabilización</option>
                  <option value="false">Sin Impermeabilización</option>
                </select>
              </div>

              {/* Recipe Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Receta
                </label>
                <select
                  value={filters.recipe_type || ''}
                  onChange={(e) => handleFilterChange('recipe_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los tipos</option>
                  <option value="FC">Receta de Concreto (FC)</option>
                  <option value="MR">Receta de Mortero (MR)</option>
                </select>
              </div>
            </div>
          )}

          {/* Search Button */}
          <div className="flex justify-center mt-4">
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex items-center gap-2 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <Search size={16} />
              {isSearching ? 'Buscando...' : 'Buscar Recetas'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Resultados ({searchResults.length} recetas encontradas)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((recipe) => (
                <div
                  key={recipe.recipe_id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleRecipeSelect(recipe)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-blue-600">{recipe.recipe_code}</h4>
                    <span className={`text-xs px-2 py-1 rounded ${
                      recipe.coding_system === 'new_system' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {recipe.coding_system === 'new_system' ? 'Nuevo' : 'Legacy'}
                    </span>
                  </div>

                  {recipe.new_system_code && (
                    <p className="text-sm text-gray-600 mb-2">
                      Nuevo código: {recipe.new_system_code}
                    </p>
                  )}

                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Resistencia:</span> {recipe.specification.strength_fc} MPa</p>
                    <p><span className="font-medium">Edad:</span> {recipe.specification.age_days} días</p>
                    <p><span className="font-medium">Colocación:</span> {recipe.specification.placement_type}</p>
                    <p><span className="font-medium">T.M.N.:</span> {recipe.specification.max_aggregate_size} mm</p>
                    <p><span className="font-medium">Revenimiento:</span> {recipe.specification.slump} cm</p>
                    <p><span className="font-medium">Aplicación:</span> {getApplicationTypeLabel(recipe.application_type)}</p>
                    <p><span className="font-medium">Rendimiento:</span> {getPerformanceGradeLabel(recipe.performance_grade)}</p>
                    {recipe.recipe_type && (
                      <p><span className="font-medium">Tipo:</span> {recipe.recipe_type === 'FC' ? 'Concreto (FC)' : 'Mortero (MR)'}</p>
                    )}
                    {recipe.has_waterproofing && (
                      <p className="text-green-600 font-medium">✓ Con Impermeabilización</p>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t text-xs text-gray-500">
                    <p>Versión actual: {recipe.current_version_number}</p>
                    <p>Total versiones: {recipe.total_versions}</p>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecipeSelect(recipe);
                      }}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <Eye size={14} />
                      Seleccionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchResults.length === 0 && !isSearching && (
          <div className="text-center text-gray-500 py-8">
            <Search size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No se han realizado búsquedas aún</p>
            <p className="text-sm">Usa los filtros arriba para buscar recetas</p>
          </div>
        )}
      </div>
    </div>
  );
}; 