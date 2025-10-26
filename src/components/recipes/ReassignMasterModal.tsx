'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link2, Unlink } from 'lucide-react';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';

interface ReassignMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: {
    id: string;
    plant_id: string;
    recipe_code: string;
    master_recipe_id?: string | null;
    strength_fc: number;
    age_days: number | null;
    age_hours: number | null;
    placement_type: string;
    max_aggregate_size: number;
    slump: number;
  };
  onChanged?: () => void;
}

type MasterRow = {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  plant_id: string;
};

export default function ReassignMasterModal({ isOpen, onClose, recipe, onChanged }: ReassignMasterModalProps) {
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<string>('');

  const ageKey = useMemo(() => (recipe.age_days != null ? `D${recipe.age_days}` : `H${recipe.age_hours ?? 0}`), [recipe.age_days, recipe.age_hours]);

  const loadMasters = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('master_recipes')
        .select('id, master_code, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump, plant_id')
        .eq('plant_id', recipe.plant_id)
        .eq('strength_fc', recipe.strength_fc)
        .eq('placement_type', recipe.placement_type)
        .eq('max_aggregate_size', recipe.max_aggregate_size)
        .eq('slump', recipe.slump);
      if (error) throw error;
      const filtered = (data || []).filter((m: any) => {
        const mAgeKey = m.age_days != null ? `D${m.age_days}` : `H${m.age_hours ?? 0}`;
        return mAgeKey === ageKey;
      });
      setMasters(filtered as any);
    } catch (e: any) {
      setError(e.message || 'Error cargando maestros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMasters(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isOpen, recipe.id]);

  if (!isOpen) return null;

  const detach = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('recipes')
        .update({ master_recipe_id: null, variant_suffix: null })
        .eq('id', recipe.id);
      if (error) throw error;
      onChanged?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error desvinculando receta');
    } finally {
      setLoading(false);
    }
  };

  const assignToSelected = async () => {
    if (!selectedMasterId) return;
    setLoading(true);
    setError(null);
    try {
      // Try server RPC to compute suffix; fallback to client computation
      const { error: rpcErr } = await supabase.rpc('link_recipes_to_master', {
        p_recipe_ids: [recipe.id],
        p_master_recipe_id: selectedMasterId
      });
      if (rpcErr) {
        const { variantSuffix } = (() => {
          const parsed = parseMasterAndVariantFromRecipeCode(recipe.recipe_code || '');
          return { variantSuffix: parsed.variantSuffix };
        })();
        const { error: upErr } = await supabase
          .from('recipes')
          .update({ master_recipe_id: selectedMasterId, variant_suffix: variantSuffix })
          .eq('id', recipe.id);
        if (upErr) throw upErr;
      }
      onChanged?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error reasignando maestro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-xl rounded shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Reasignar maestro</h3>
          <button className="text-sm text-gray-600" onClick={onClose}>Cerrar</button>
        </div>

        {error && (
          <Alert className="mb-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-gray-700 mb-3">
          <div><span className="font-mono">{recipe.recipe_code}</span></div>
          <div>f'c {recipe.strength_fc} • {ageKey} • Rev {recipe.slump} • {recipe.placement_type} • TMA {recipe.max_aggregate_size}mm</div>
        </div>

        <div className="space-y-3">
          <div className="p-2 border rounded bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Desvincular de maestro</div>
                <div className="text-xs text-gray-600">La receta quedará sin maestro; podrás asignarla después.</div>
              </div>
              <Button variant="outline" onClick={detach} disabled={loading}>
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando</>) : (<><Unlink className="h-4 w-4 mr-2" />Desvincular</>)}
              </Button>
            </div>
          </div>

          <div className="p-2 border rounded">
            <div className="font-medium mb-2">Asignar a maestro compatible</div>
            {loading ? (
              <div className="text-sm text-gray-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-auto">
                {masters.length === 0 ? (
                  <div className="text-sm text-gray-600">No hay maestros compatibles para estas especificaciones.</div>
                ) : masters.map(m => (
                  <label key={m.id} className={`flex items-center justify-between p-2 border rounded ${selectedMasterId===m.id?'bg-green-50 border-green-200':''}`}>
                    <div>
                      <div className="font-mono text-sm font-semibold">{m.master_code}</div>
                      <div className="text-xs text-gray-600">f'c {m.strength_fc} • Rev {m.slump} • {m.placement_type} • TMA {m.max_aggregate_size}mm</div>
                    </div>
                    <input type="radio" name="master" checked={selectedMasterId===m.id} onChange={()=>setSelectedMasterId(m.id)} />
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-2">
              <Button onClick={assignToSelected} disabled={!selectedMasterId || loading}>
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Asignando…</>) : (<><Link2 className="h-4 w-4 mr-2" />Asignar</>)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


