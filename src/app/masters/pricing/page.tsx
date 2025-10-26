'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { usePlantContext } from '@/contexts/PlantContext';
import PriceConflictResolver from '@/components/masters/PriceConflictResolver';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type MasterWithConflicts = {
  master_id: string;
  master_code: string;
  strength_fc: number;
  slump: number;
  placement_type: string;
  client_id: string;
  business_name: string;
  construction_site: string | null;
  price_variations: number;
  different_prices: number[];
  variants_with_prices: string[];
  needs_consolidation: boolean;
  has_master_price: boolean;
};

export default function MasterPricingConsolidationPage() {
  const { currentPlant } = usePlantContext();
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<MasterWithConflicts[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null);
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);

  const plantId = currentPlant?.id;

  const filteredConflicts = useMemo(() => {
    if (showResolved) return conflicts;
    return conflicts.filter(c => !c.has_master_price || c.price_variations > 1);
  }, [conflicts, showResolved]);

  const resolvedCount = useMemo(() => {
    return conflicts.filter(c => c.has_master_price && c.price_variations <= 1).length;
  }, [conflicts]);

  const loadConflicts = async () => {
    if (!plantId) return;
    setLoading(true);
    setError(null);
    try {
      // 1) Get recipes linked to masters in this plant
      const { data: recipeRows, error: rErr } = await supabase
        .from('recipes')
        .select('id, recipe_code, master_recipe_id, plant_id, master_recipes:master_recipe_id(master_code, strength_fc, slump, placement_type)')
        .eq('plant_id', plantId)
        .not('master_recipe_id', 'is', null);
      if (rErr) throw rErr;

      const recipeIds = (recipeRows || []).map((r: any) => r.id);
      const masterIds = Array.from(new Set((recipeRows || []).map((r: any) => r.master_recipe_id)));

      if (recipeIds.length === 0) {
        setConflicts([]);
        return;
      }

      // 2) Variant-level active prices for those recipes
      const [{ data: variantPrices }, { data: approvedQuotes }, { data: masterPrices }] = await Promise.all([
        supabase
          .from('product_prices')
          .select('recipe_id, base_price, client_id, construction_site')
          .eq('is_active', true)
          .in('recipe_id', recipeIds),
        supabase
          .from('quote_details')
          .select('recipe_id, final_price, quotes:quote_id(status, client_id, construction_site)')
          .in('recipe_id', recipeIds),
        supabase
          .from('product_prices')
          .select('master_recipe_id, base_price, client_id, construction_site, is_active')
          .eq('is_active', true)
          .in('master_recipe_id', masterIds.length ? masterIds : ['00000000-0000-0000-0000-000000000000'])
      ]);

      // 3) Group by master + client/site scope
      const grouped = new Map<string, MasterWithConflicts>();

      const recipeIdToMaster = new Map<string, any>();
      (recipeRows || []).forEach((r: any) => {
        recipeIdToMaster.set(r.id, r);
      });

      (variantPrices || []).forEach((p: any) => {
        const r = recipeIdToMaster.get(p.recipe_id);
        if (!r) return;
        const key = `${r.master_recipe_id}|${p.client_id || ''}|${p.construction_site || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            master_id: r.master_recipe_id,
            master_code: r.master_recipes?.master_code || '—',
            strength_fc: r.master_recipes?.strength_fc || 0,
            slump: r.master_recipes?.slump || 0,
            placement_type: r.master_recipes?.placement_type || '',
            client_id: p.client_id || '',
            business_name: '—',
            construction_site: p.construction_site || null,
            price_variations: 0,
            different_prices: [],
            variants_with_prices: [],
            needs_consolidation: true,
            has_master_price: false
          });
        }
        const entry = grouped.get(key)!;
        if (!entry.different_prices.includes(p.base_price)) entry.different_prices.push(p.base_price);
        if (!entry.variants_with_prices.includes(recipeIdToMaster.get(p.recipe_id)?.recipe_code)) {
          entry.variants_with_prices.push(recipeIdToMaster.get(p.recipe_id)?.recipe_code);
        }
        entry.price_variations = entry.different_prices.length;
      });

      (approvedQuotes || []).filter((q: any) => q.quotes?.status === 'APPROVED').forEach((q: any) => {
        const r = recipeIdToMaster.get(q.recipe_id);
        if (!r) return;
        const key = `${r.master_recipe_id}|${q.quotes?.client_id || ''}|${q.quotes?.construction_site || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            master_id: r.master_recipe_id,
            master_code: r.master_recipes?.master_code || '—',
            strength_fc: r.master_recipes?.strength_fc || 0,
            slump: r.master_recipes?.slump || 0,
            placement_type: r.master_recipes?.placement_type || '',
            client_id: q.quotes?.client_id || '',
            business_name: '—',
            construction_site: q.quotes?.construction_site || null,
            price_variations: 0,
            different_prices: [],
            variants_with_prices: [],
            needs_consolidation: true,
            has_master_price: false
          });
        }
        const entry = grouped.get(key)!;
        if (!entry.different_prices.includes(q.final_price)) entry.different_prices.push(q.final_price);
        if (!entry.variants_with_prices.includes(recipeIdToMaster.get(q.recipe_id)?.recipe_code)) {
          entry.variants_with_prices.push(recipeIdToMaster.get(q.recipe_id)?.recipe_code);
        }
        entry.price_variations = entry.different_prices.length;
      });

      // Mark entries that already have an active master-level price as resolved
      const masterPriceKeys = new Set<string>();
      (masterPrices || []).forEach((m: any) => {
        const k = `${m.master_recipe_id}|${m.client_id || ''}|${m.construction_site || ''}`;
        masterPriceKeys.add(k);
      });
      grouped.forEach((val, k) => {
        if (masterPriceKeys.has(k)) val.has_master_price = true;
      });

      // Show all groups (filter in UI based on showResolved toggle)
      setConflicts(Array.from(grouped.values()));
    } catch (e: any) {
      const msg = e.message || 'Error cargando conflictos de precio';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId]);

  const toggleExpand = (key: string) => {
    const next = new Set(expandedMasters);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedMasters(next);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Consolidación de Precios por Maestro</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant={showResolved ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
            className="gap-2"
          >
            {showResolved ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showResolved ? 'Mostrando resueltos' : 'Ocultar resueltos'}
            {resolvedCount > 0 && <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">{resolvedCount}</span>}
          </Button>
          <Button variant="outline" onClick={loadConflicts} disabled={loading}>
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Cargando</>) : (<><RefreshCw className="h-4 w-4 mr-2" />Refrescar</>)}
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && filteredConflicts.length === 0 && conflicts.length > 0 && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription>
            ✓ Todos los conflictos han sido resueltos. {resolvedCount} maestros consolidados.
          </AlertDescription>
        </Alert>
      )}

      {!loading && conflicts.length === 0 && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription>
            ✓ No hay conflictos de precio.
          </AlertDescription>
        </Alert>
      )}

      <div className="text-sm text-gray-600">
        {showResolved 
          ? `Mostrando ${filteredConflicts.length} maestros (${resolvedCount} resueltos)`
          : `Mostrando ${filteredConflicts.length} conflictos pendientes`
        }
      </div>

      <div className="space-y-3">
        {filteredConflicts.map(conflict => {
          const key = `${conflict.master_id}|${conflict.client_id}|${conflict.construction_site || ''}`;
          const isExpanded = expandedMasters.has(key);
          const badge = conflict.has_master_price ? (
            <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">✓ Resuelto</div>
          ) : (
            <div className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">{conflict.price_variations} precios</div>
          );
          
          return (
            <div key={key} className="border rounded bg-white">
              <div 
                className="p-3 cursor-pointer hover:bg-gray-50" 
                onClick={() => toggleExpand(key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</div>
                      <div className="font-mono font-semibold">{conflict.master_code}</div>
                      {badge}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Cliente: {conflict.business_name} • Obra: {conflict.construction_site || 'General'}
                    </div>
                    <div className="text-xs text-gray-600">
                      f'c: {conflict.strength_fc} • Rev: {conflict.slump} • {conflict.placement_type}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-red-600">
                    ${Math.min(...conflict.different_prices).toFixed(2)} - ${Math.max(...conflict.different_prices).toFixed(2)}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t bg-gray-50">
                  <PriceConflictResolver
                    masterRecipeId={conflict.master_id}
                    clientId={conflict.client_id}
                    constructionSite={conflict.construction_site}
                    onResolved={() => {
                      toast.success('Precio consolidado correctamente');
                      loadConflicts();
                      setExpandedMasters(new Set());
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

