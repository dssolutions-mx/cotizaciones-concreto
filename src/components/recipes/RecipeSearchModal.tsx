'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Search, Filter, Eye } from 'lucide-react';
import { recipeService } from '@/lib/supabase/recipes';
import { supabase } from '@/lib/supabase';
import { RecipeSearchFilters, RecipeSearchResult, RecipeSpecification } from '@/types/recipes';
import { usePlantContext } from '@/contexts/PlantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProfessionalRecipeList } from './ProfessionalRecipeList';

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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([]);
  const [displayedResults, setDisplayedResults] = useState<RecipeSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Always filter for recipes with quality data (muestreos OR site checks)
  const requireQualityData = true;

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

  // Debounced simple text query for recipe_code
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);

    try {
      // Remove undefined values from filters
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ) as RecipeSearchFilters;

      const results = await recipeService.findRecipesBySpecifications({
        ...cleanFilters,
        // Allow simple recipe_code includes search if query is provided
        // The service should ignore unknown filters gracefully
        // @ts-ignore
        recipe_code_ilike: debouncedQuery ? `%${debouncedQuery}%` : undefined,
      } as any);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || 'Error al buscar recetas');
    } finally {
      setIsSearching(false);
    }
  };

  // Initial load: fetch all accessible recipes for the current plant
  useEffect(() => {
    const loadAll = async () => {
      try {
        setIsSearching(true);
        setError(null);
        const plantIds = currentPlant?.id ? [currentPlant.id] : null;
        const dataRes: any = await recipeService.getRecipes(10000, plantIds);
        const list: any[] = Array.isArray(dataRes) ? dataRes : (dataRes?.data || []);
        const mapped: RecipeSearchResult[] = (list || []).map((r: any) => {
          const currentVersion = (r.recipe_versions || []).find((v: any) => v.is_current) || (r.recipe_versions || [])[0];
          const recipeType = (r.recipe_versions || [])[0]?.notes || undefined;
          const spec: RecipeSpecification = {
            strength_fc: Number(r.strength_fc) || 0,
            age_days: Number(r.age_days) || 0,
            age_hours: r.age_hours || undefined,
            placement_type: r.placement_type,
            max_aggregate_size: Number(r.max_aggregate_size) || 0,
            slump: Number(r.slump) || 0,
            application_type: r.application_type || undefined,
            has_waterproofing: r.has_waterproofing || undefined,
            performance_grade: r.performance_grade || undefined,
            recipe_type: recipeType,
          };
          return {
            recipe_id: String(r.id),
            recipe_code: r.recipe_code,
            new_system_code: r.new_system_code || undefined,
            coding_system: r.coding_system || 'legacy',
            current_version_number: currentVersion?.version_number || 0,
            total_versions: (r.recipe_versions || []).length || 0,
            application_type: r.application_type || undefined,
            has_waterproofing: r.has_waterproofing || undefined,
            performance_grade: r.performance_grade || undefined,
            recipe_type: recipeType,
            specification: spec,
          } as RecipeSearchResult;
        });
        setSearchResults(mapped);
      } catch (e: any) {
        setError(e?.message || 'Error cargando recetas');
      } finally {
        setIsSearching(false);
      }
    };
    if (isOpen) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentPlant?.id]);

  // Enrich and filter results by activity (muestreos / site checks)
  useEffect(() => {
    const run = async () => {
      if (!searchResults || searchResults.length === 0) { setDisplayedResults([]); return; }
      // Base filter: code query (client-side contains)
      const baseFiltered = debouncedQuery
        ? searchResults.filter(r => r.recipe_code?.toLowerCase().includes(debouncedQuery.toLowerCase()))
        : searchResults;
      if (!requireQualityData) { setDisplayedResults(baseFiltered); return; }
      try {
        const ids = Array.from(new Set(searchResults.map(r => r.recipe_id)));
        if (ids.length === 0) { setDisplayedResults([]); return; }

        // Fetch remisiones for these recipes (by plant if available)
        let q = supabase.from('remisiones').select('id, recipe_id').in('recipe_id', ids);
        if (currentPlant?.id) q = q.eq('plant_id', currentPlant.id);
        const { data: remRows, error: remErr } = await q as any;
        if (remErr) throw remErr;
        const recipeIdToRemisionIds = new Map<string, string[]>();
        (remRows || []).forEach((r: any) => {
          const key = String(r.recipe_id);
          const arr = recipeIdToRemisionIds.get(key) || [];
          arr.push(String(r.id));
          recipeIdToRemisionIds.set(key, arr);
        });

        let recipeIdsWithMuestreos = new Set<string>();
        let recipeIdsWithSiteChecks = new Set<string>();

        // Always fetch both types of data when quality filtering is enabled
        if (requireQualityData) {
          const allRemisionIds = Array.from(new Set((remRows || []).map((r: any) => String(r.id))));
          
          // Fetch muestreos data
          if (allRemisionIds.length > 0) {
            for (let i = 0; i < allRemisionIds.length; i += 500) {
              const slice = allRemisionIds.slice(i, i + 500);
              const { data: muestRows, error: muErr } = await supabase
                .from('muestreos')
                .select('remision_id')
                .in('remision_id', slice);
              if (muErr) continue;
              const hasRem = new Set((muestRows || []).map((m: any) => String(m.remision_id)));
              recipeIdToRemisionIds.forEach((remIds, rid) => {
                if (remIds.some(id => hasRem.has(id))) recipeIdsWithMuestreos.add(rid);
              });
            }
          }

          // Fetch site checks data
          if (allRemisionIds.length > 0) {
            for (let i = 0; i < allRemisionIds.length; i += 500) {
              const slice = allRemisionIds.slice(i, i + 500);
              const { data: scRows, error: scErr } = await supabase
                .from('site_checks')
                .select('remision_id')
                .in('remision_id', slice);
              if (scErr) continue;
              const hasRem = new Set((scRows || []).map((m: any) => String(m.remision_id)));
              recipeIdToRemisionIds.forEach((remIds, rid) => {
                if (remIds.some(id => hasRem.has(id))) recipeIdsWithSiteChecks.add(rid);
              });
            }
          }
        }


        const filtered = baseFiltered.filter(r => {
          const id = r.recipe_id;
          const hasMuestreos = recipeIdsWithMuestreos.has(id);
          const hasSiteChecks = recipeIdsWithSiteChecks.has(id);
          
          // Recipe must have at least muestreos OR site checks (OR condition)
          return hasMuestreos || hasSiteChecks;
        });
        setDisplayedResults(filtered);
      } catch (e) {
        setDisplayedResults(baseFiltered);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults, debouncedQuery, requireQualityData, currentPlant?.id]);

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

  // Grouped results subcomponent
  function GroupedResults({ results, groupBy, sortBy, onSelect }: { results: RecipeSearchResult[]; groupBy: 'type' | 'strength' | 'application'; sortBy: 'code' | 'strength' | 'versions'; onSelect: (r: RecipeSearchResult) => void }) {
    const groups = useMemo(() => {
      const map = new Map<string, RecipeSearchResult[]>();
      results.forEach((r) => {
        const spec: any = r?.specification || {};
        const key = groupBy === 'type'
          ? (r.recipe_type || spec.recipe_type || 'N/A')
          : groupBy === 'strength'
          ? String(spec?.strength_fc ?? 'N/A')
          : (r.application_type || spec.application_type || 'N/A');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      });
      const sortFn = (a: RecipeSearchResult, b: RecipeSearchResult) => {
        if (sortBy === 'code') return a.recipe_code.localeCompare(b.recipe_code);
        if (sortBy === 'strength') {
          const sa = (a.specification?.strength_fc ?? 0) as number;
          const sb = (b.specification?.strength_fc ?? 0) as number;
          return sa - sb;
        }
        return (a.current_version_number || 0) - (b.current_version_number || 0);
      };
      return Array.from(map.entries()).map(([key, items]) => ({ key, items: items.sort(sortFn) }));
    }, [results, groupBy, sortBy]);

    return (
      <div className="space-y-6">
        {groups.map(({ key, items }) => (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{groupBy === 'strength' ? `${key} MPa` : key}</Badge>
              <span className="text-xs text-gray-500">{items.length} recetas</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((recipe) => {
                const spec: any = recipe?.specification || {};
                const strength = spec?.strength_fc ?? (recipe as any)?.strength_fc ?? 'N/A';
                const ageDays = spec?.age_days ?? (recipe as any)?.age_days ?? 'N/A';
                const placement = spec?.placement_type ?? (recipe as any)?.placement_type ?? 'N/A';
                const maxAgg = spec?.max_aggregate_size ?? (recipe as any)?.max_aggregate_size ?? 'N/A';
                const slump = spec?.slump ?? (recipe as any)?.slump ?? 'N/A';
                const codingSystem = recipe?.coding_system || 'legacy';
                const appType = recipe?.application_type || spec?.application_type;
                const perfGrade = recipe?.performance_grade || spec?.performance_grade;
                return (
                  <div
                    key={recipe.recipe_id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onSelect(recipe)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-blue-600">{recipe.recipe_code}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        codingSystem === 'new_system' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {codingSystem === 'new_system' ? 'Nuevo' : 'Legacy'}
                      </span>
                    </div>
                    {recipe.new_system_code && (
                      <p className="text-sm text-gray-600 mb-2">Nuevo código: {recipe.new_system_code}</p>
                    )}
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Resistencia:</span> {strength} MPa</p>
                      <p><span className="font-medium">Edad:</span> {ageDays} días</p>
                      <p><span className="font-medium">Colocación:</span> {placement}</p>
                      <p><span className="font-medium">T.M.N.:</span> {maxAgg} mm</p>
                      <p><span className="font-medium">Revenimiento:</span> {slump} cm</p>
                      <p><span className="font-medium">Aplicación:</span> {getApplicationTypeLabel(appType)}</p>
                      <p><span className="font-medium">Rendimiento:</span> {getPerformanceGradeLabel(perfGrade)}</p>
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
                        onClick={(e) => { e.stopPropagation(); onSelect(recipe); }}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Eye size={14} />
                        Seleccionar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-screen max-w-none sm:max-w-6xl sm:w-full h-[90dvh] sm:h-auto p-0">
        <div className="flex flex-col h-full">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b p-4">
            <DialogHeader>
              <DialogTitle>Buscar Recetas por Especificaciones</DialogTitle>
            </DialogHeader>

            {error && (
              <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="mt-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="recipe-code">Buscar por código de receta</Label>
                  <Input id="recipe-code" ref={searchInputRef} placeholder="Ej. 250-14-D-20" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={() => setShowFilters(!showFilters)} variant="secondary" className="whitespace-nowrap">
                    <Filter size={16} className="mr-2" /> {showFilters ? 'Ocultar Filtros' : 'Más Filtros'}
                  </Button>
                  <Button type="button" onClick={handleSearch} disabled={isSearching}>
                    <Search size={16} className="mr-2" /> {isSearching ? 'Buscando...' : 'Buscar'}
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg mt-4">
                  {/* Strength */}
                  <div>
                    <Label>Resistencia f'c (MPa)</Label>
                    <Input type="number" value={filters.strength_fc || ''} onChange={(e) => handleFilterChange('strength_fc', e.target.value)} step="0.1" placeholder="25" />
                  </div>

                  {/* Age Days */}
                  <div>
                    <Label>Edad (días)</Label>
                    <Input type="number" value={filters.age_days || ''} onChange={(e) => handleFilterChange('age_days', e.target.value)} placeholder="28" />
                  </div>

                  {/* Placement Type */}
                  <div>
                    <Label>Tipo de Colocación</Label>
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
                    <Label>Tamaño Máx. Agregado (mm)</Label>
                    <Input type="number" value={filters.max_aggregate_size || ''} onChange={(e) => handleFilterChange('max_aggregate_size', e.target.value)} step="0.1" placeholder="20" />
                  </div>

                  {/* Slump */}
                  <div>
                    <Label>Revenimiento (cm)</Label>
                    <Input type="number" value={filters.slump || ''} onChange={(e) => handleFilterChange('slump', e.target.value)} step="0.1" placeholder="10" />
                  </div>

                  {/* Application Type */}
                  <div>
                    <Label>Tipo de Aplicación</Label>
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
                    <Label>Grado de Rendimiento</Label>
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
                    <Label>Impermeabilización</Label>
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
                    <Label>Tipo de Receta</Label>
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
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {(searchResults && searchResults.length > 0) && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold">
                    Resultados ({displayedResults.length} de {searchResults.length} recetas)
                  </h3>
                  <div className="text-xs text-gray-500">
                    Mostrando solo recetas con datos de calidad (muestreos o registros en obra)
                  </div>
                </div>

                <ProfessionalRecipeList results={displayedResults} onSelect={(r) => handleRecipeSelect(r)} />
              </div>
            )}

            {(!searchResults || searchResults.length === 0) && !isSearching && (
              <div className="text-center text-gray-500 py-16">
                <Search size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No se han realizado búsquedas aún</p>
                <p className="text-sm">Usa los filtros arriba para buscar recetas</p>
              </div>
            )}

            {isSearching && (
              <div className="text-center text-gray-600 py-8">Buscando recetas…</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 