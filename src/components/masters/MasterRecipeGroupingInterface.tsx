'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Button } from '@/components/ui/button';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

type RecipeRow = {
  id: string;
  plant_id: string;
  recipe_code: string | null;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  master_recipe_id?: string | null;
};

type SuggestedGroup = {
  key: string; // spec-based grouping key
  plant_id: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  // Suggested master code derived from first variant's ARKIK (master prefix),
  // used for display and default master_code when creating the master
  suggested_code?: string;
  variants: RecipeRow[];
};

interface MasterRecipeGroupingInterfaceProps {
  enabled?: boolean; // feature flag gate
}

// Extract suggested master code from ARKIK-based recipe code by removing the last 2 segments
function deriveSuggestedMaster(code: string): string | null {
  if (!code) return null;
  const { masterCode } = parseMasterAndVariantFromRecipeCode(code);
  return masterCode || code;
}

export default function MasterRecipeGroupingInterface({ enabled = true }: MasterRecipeGroupingInterfaceProps) {
  const { currentPlant } = usePlantContext();
  const { profile } = useAuthBridge();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [executing, setExecuting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Visual grouping state - hierarchical expansion
  const [expandedStrengths, setExpandedStrengths] = useState<Set<number>>(new Set());
  const [expandedSlumps, setExpandedSlumps] = useState<Set<string>>(new Set()); // key: strength|slump
  const [expandedPlacements, setExpandedPlacements] = useState<Set<string>>(new Set()); // key: strength|slump|placement

  const plantId = currentPlant?.id;

  const load = async () => {
    if (!plantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, plant_id, recipe_code, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump, master_recipe_id')
        .eq('plant_id', plantId)
        .order('recipe_code');
      if (error) throw error;
      setRecipes((data || []) as unknown as RecipeRow[]);
    } catch (e: any) {
      setError(e.message || 'Error cargando recetas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId]);

  // Build hierarchical structure: Strength → Slump → Placement → Groups
  const hierarchy = useMemo(() => {
    const byStrength = new Map<number, Map<number, Map<string, SuggestedGroup[]>>>();
    
    for (const r of recipes) {
      const code = r.recipe_code || '';
      const suggested = deriveSuggestedMaster(code) || code;
      // Group STRICTLY by core specification, ignoring code prefixes
      // Normalize age: if age_days exists, ignore hours; else use hours
      const ageKey = (r.age_days !== null && r.age_days !== undefined)
        ? `D${r.age_days}`
        : `H${r.age_hours ?? 0}`;

      const groupKey = [
        r.plant_id,
        r.strength_fc,
        ageKey,
        r.placement_type,
        r.max_aggregate_size,
        r.slump
      ].join('|');
      
      if (!byStrength.has(r.strength_fc)) {
        byStrength.set(r.strength_fc, new Map());
      }
      const strengthLevel = byStrength.get(r.strength_fc)!;
      
      if (!strengthLevel.has(r.slump)) {
        strengthLevel.set(r.slump, new Map());
      }
      const slumpLevel = strengthLevel.get(r.slump)!;
      
      if (!slumpLevel.has(r.placement_type)) {
        slumpLevel.set(r.placement_type, []);
      }
      const placementGroups = slumpLevel.get(r.placement_type)!;
      
      // Find or create group in this placement using spec-based key
      let group = placementGroups.find(g => g.key === groupKey);
      if (!group) {
        group = {
          key: groupKey,
          plant_id: r.plant_id,
          strength_fc: r.strength_fc,
          age_days: r.age_days,
          age_hours: r.age_hours ?? null,
          placement_type: r.placement_type,
          max_aggregate_size: r.max_aggregate_size,
          slump: r.slump,
          suggested_code: suggested,
          variants: []
        };
        placementGroups.push(group);
      }
      group.variants.push(r);
    }
    
    return byStrength;
  }, [recipes]);

  const executeGroup = async (group: SuggestedGroup) => {
    if (!enabled) return;
    setExecuting(true);
    setStatusMsg(null);
    try {
      // 1) Create master_recipes row (if table exists)
      const masterPayload: any = {
        master_code: group.suggested_code || group.key,
        strength_fc: group.strength_fc,
        age_days: group.age_days,
        age_hours: group.age_hours,
        placement_type: group.placement_type,
        max_aggregate_size: group.max_aggregate_size,
        slump: group.slump,
        plant_id: group.plant_id,
        display_name: group.suggested_code || group.key,
        description: 'Generado desde UI de agrupación',
        created_by: profile?.id || null
      };
      const { data: master, error: masterErr } = await supabase
        .from('master_recipes')
        .insert(masterPayload)
        .select('id')
        .single();
      if (masterErr) throw masterErr;

      // 2) Link variants to master and derive variant_suffix from recipe_code
      const updates = group.variants.map(v => ({ id: v.id }));
      // Batch in chunks to avoid payload limits
      const chunkSize = 100;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const slice = updates.slice(i, i + chunkSize).map(u => u.id);
        // Compute variant_suffix on server using regex-like approach with SQL; client sends only master id
        const { error: upErr } = await supabase.rpc('link_recipes_to_master', {
          p_recipe_ids: slice,
          p_master_recipe_id: master.id
        });
        if (upErr) throw upErr;
      }

      setStatusMsg('Grupo ejecutado correctamente.');
      await load();
    } catch (e: any) {
      // If master_recipes or RPC does not exist, inform user but do not break UI
      setError(e.message || 'Error al ejecutar agrupación');
    } finally {
      setExecuting(false);
    }
  };

  if (!enabled) {
    return (
      <Alert>
        <AlertDescription>
          La interfaz de agrupación está deshabilitada por configuración.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Agrupación de Recetas por Especificación</h2>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Cargando</>) : (<><RefreshCw className="h-4 w-4 mr-2" />Refrescar</>)}
        </Button>
      </div>
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <TriangleAlert className="h-4 w-4 text-red-600" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {statusMsg && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription>{statusMsg}</AlertDescription>
        </Alert>
      )}
      <div className="text-sm text-gray-600 mb-3">Agrupación visual jerárquica: Resistencia → Revenimiento → Colocación → Grupos de variantes. Acciones son seguras y validadas en servidor.</div>
      
      <div className="space-y-4">
        {Array.from(hierarchy.entries()).sort((a, b) => a[0] - b[0]).map(([strength, slumpMap]) => {
          const strengthExpanded = expandedStrengths.has(strength);
          const totalVariants = Array.from(slumpMap.values())
            .flatMap(placementMap => Array.from(placementMap.values()))
            .flatMap(groups => groups)
            .reduce((sum, g) => sum + g.variants.length, 0);
          
          return (
            <div key={strength} className="border rounded bg-white">
              {/* Level 1: Strength */}
              <div 
                className="p-3 cursor-pointer hover:bg-blue-50 bg-blue-100" 
                onClick={() => {
                  const next = new Set(expandedStrengths);
                  if (strengthExpanded) next.delete(strength); else next.add(strength);
                  setExpandedStrengths(next);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-400">{strengthExpanded ? '▼' : '▶'}</div>
                    <div className="font-semibold">Resistencia: {strength} kg/cm²</div>
                    <div className="text-xs px-2 py-1 bg-white rounded">{totalVariants} variantes</div>
                  </div>
                </div>
              </div>
              
              {strengthExpanded && (
                <div className="p-2 space-y-2">
                  {Array.from(slumpMap.entries()).sort((a, b) => a[0] - b[0]).map(([slump, placementMap]) => {
                    const slumpKey = `${strength}|${slump}`;
                    const slumpExpanded = expandedSlumps.has(slumpKey);
                    const slumpVariants = Array.from(placementMap.values())
                      .flatMap(groups => groups)
                      .reduce((sum, g) => sum + g.variants.length, 0);
                    
                    return (
                      <div key={slumpKey} className="border rounded bg-white ml-4">
                        {/* Level 2: Slump */}
                        <div 
                          className="p-2 cursor-pointer hover:bg-green-50 bg-green-100" 
                          onClick={() => {
                            const next = new Set(expandedSlumps);
                            if (slumpExpanded) next.delete(slumpKey); else next.add(slumpKey);
                            setExpandedSlumps(next);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-gray-400">{slumpExpanded ? '▼' : '▶'}</div>
                              <div className="text-sm font-medium">Revenimiento: {slump} cm</div>
                              <div className="text-xs px-2 py-1 bg-white rounded">{slumpVariants} variantes</div>
                            </div>
                          </div>
                        </div>
                        
                        {slumpExpanded && (
                          <div className="p-2 space-y-2">
                            {Array.from(placementMap.entries()).sort().map(([placement, groups]) => {
                              const placementKey = `${slumpKey}|${placement}`;
                              const placementExpanded = expandedPlacements.has(placementKey);
                              const placementVariants = groups.reduce((sum, g) => sum + g.variants.length, 0);
                              const placementLabel = placement === 'D' ? 'Directo' : placement === 'B' ? 'Bombeado' : placement;
                              
                              return (
                                <div key={placementKey} className="border rounded bg-white ml-4">
                                  {/* Level 3: Placement */}
                                  <div 
                                    className="p-2 cursor-pointer hover:bg-yellow-50 bg-yellow-100" 
                                    onClick={() => {
                                      const next = new Set(expandedPlacements);
                                      if (placementExpanded) next.delete(placementKey); else next.add(placementKey);
                                      setExpandedPlacements(next);
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="text-xs text-gray-400">{placementExpanded ? '▼' : '▶'}</div>
                                        <div className="text-sm">Colocación: {placementLabel}</div>
                                        <div className="text-xs px-2 py-1 bg-white rounded">{placementVariants} variantes</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {placementExpanded && (
                                    <div className="p-2 space-y-2">
                                      {/* Level 4: Master Groups */}
                                      {groups.map(group => (
                                        <div key={group.key} className="border rounded bg-white ml-4">
                                          <div className="p-2 bg-gray-50">
                                            <div className="flex items-center justify-between mb-2">
                                              <div>
                                                <div className="font-mono text-sm font-semibold">{group.key}</div>
                                                <div className="text-xs text-gray-600">
                                                  Edad: {group.age_days ?? group.age_hours ?? '—'}{group.age_days !== null ? 'D' : (group.age_hours !== null ? 'H' : '')} • TMA: {group.max_aggregate_size}mm • {group.variants.length} variantes
                                                </div>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              <div className="text-xs max-h-32 overflow-auto space-y-1">
                                                {group.variants.map(v => (
                                                  <div key={v.id} className="flex items-center justify-between p-1 bg-white border rounded">
                                                    <div className="font-mono text-[11px]">{v.recipe_code}</div>
                                                    {v.master_recipe_id && (
                                                      <div className="text-green-600 text-[10px]">✓</div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                              <div>
                                                {group.variants.some(v => v.master_recipe_id) ? (
                                                  <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                                    ✓ Vinculado
                                                  </div>
                                                ) : (
                                                  <Button 
                                                    size="sm"
                                                    className="w-full" 
                                                    disabled={executing || loading} 
                                                    onClick={() => executeGroup(group)}
                                                  >
                                                    {executing ? 'Ejecutando…' : 'Crear Maestro'}
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


