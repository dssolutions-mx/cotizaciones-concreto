'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { RecipeSearchResult } from '@/types/recipes';
import { Badge } from '@/components/ui/badge';

interface ProfessionalRecipeListProps {
  results: RecipeSearchResult[];
  onSelect: (recipe: RecipeSearchResult) => void;
}

export const ProfessionalRecipeList: React.FC<ProfessionalRecipeListProps> = ({ results, onSelect }) => {
  // Group by strength_fc ascending — meaningful taxonomy, not provenance notes
  const groups = useMemo(() => {
    const map = new Map<number, RecipeSearchResult[]>();
    for (const r of results) {
      const fc = (r.specification?.strength_fc as number) ?? 0;
      if (!map.has(fc)) map.set(fc, []);
      map.get(fc)!.push(r);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([fc, recipes]) => ({
        fc,
        recipes: [...recipes].sort((a, b) => {
          const ageDiff = ((a.specification?.age_days as number) ?? 0) - ((b.specification?.age_days as number) ?? 0);
          return ageDiff !== 0 ? ageDiff : a.recipe_code.localeCompare(b.recipe_code);
        }),
      }));
  }, [results]);

  // All strength groups expanded by default
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (fc: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(fc)) next.delete(fc);
      else next.add(fc);
      return next;
    });

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No se encontraron recetas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[56vh] overflow-y-auto">
      {groups.map(({ fc, recipes }) => {
        const isOpen = !collapsed.has(fc);
        return (
          <div key={fc} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              onClick={() => toggle(fc)}
            >
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                )}
                <span className="font-semibold text-gray-900">f&apos;c {fc} kg/cm²</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {recipes.length} receta{recipes.length !== 1 ? 's' : ''}
              </Badge>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {recipes.map((recipe) => {
                  const spec = recipe.specification;
                  return (
                    <button
                      key={recipe.recipe_id}
                      type="button"
                      className="w-full flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-sky-50 transition-colors text-left group"
                      onClick={() => onSelect(recipe)}
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-sm text-sky-700 group-hover:text-sky-900 truncate">
                          {recipe.recipe_code}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {spec?.age_days ? `${spec.age_days}d` : spec?.age_hours ? `${spec.age_hours}h` : '—'} ·{' '}
                          TMA {spec?.max_aggregate_size ?? '—'} mm · Rev {spec?.slump ?? '—'} cm ·{' '}
                          {spec?.placement_type === 'B' ? 'Bombeo' : spec?.placement_type === 'D' ? 'Directa' : spec?.placement_type ?? '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs text-gray-400 group-hover:text-sky-600">
                        <Eye className="h-3.5 w-3.5" />
                        <span>Seleccionar</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
