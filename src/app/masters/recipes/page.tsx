'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { usePlantContext } from '@/contexts/PlantContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, Plus, Unlink, Link2, Eye, EyeOff, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';

type MasterRecipeWithStats = {
  id: string;
  master_code: string;
  plant_id: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  variant_count: number;
  variants: Array<{
    id: string;
    recipe_code: string;
    variant_suffix: string | null;
    created_at: string;
  }>;
  has_active_price: boolean;
  recent_usage_count: number;
};

type OrphanRecipe = {
  id: string;
  recipe_code: string;
  plant_id: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  created_at: string;
};

export default function MasterRecipesManagementPage() {
  const { currentPlant } = usePlantContext();
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<MasterRecipeWithStats[]>([]);
  const [orphans, setOrphans] = useState<OrphanRecipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOrphans, setShowOrphans] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [promotingVariant, setPromotingVariant] = useState<string | null>(null);
  const [creatingMaster, setCreatingMaster] = useState(false);

  const plantId = currentPlant?.id;

  const filteredMasters = useMemo(() => {
    if (!searchTerm) return masters;
    const lower = searchTerm.toLowerCase();
    return masters.filter(m => 
      m.master_code.toLowerCase().includes(lower) ||
      m.variants.some(v => v.recipe_code.toLowerCase().includes(lower))
    );
  }, [masters, searchTerm]);

  const filteredOrphans = useMemo(() => {
    if (!searchTerm) return orphans;
    const lower = searchTerm.toLowerCase();
    return orphans.filter(o => o.recipe_code.toLowerCase().includes(lower));
  }, [orphans, searchTerm]);

  const loadData = async () => {
    if (!plantId) return;
    setLoading(true);
    setError(null);
    
    try {
      // Load masters with variants and stats
      const { data: masterRows, error: masterErr } = await supabase
        .from('master_recipes')
        .select(`
          id,
          master_code,
          plant_id,
          strength_fc,
          age_days,
          age_hours,
          placement_type,
          max_aggregate_size,
          slump,
          recipes!recipes_master_recipe_id_fkey(id, recipe_code, variant_suffix, created_at)
        `)
        .eq('plant_id', plantId)
        .order('master_code');

      if (masterErr) throw masterErr;

      // Enrich with pricing and usage stats
      const enriched = await Promise.all(
        (masterRows || []).map(async (master: any) => {
          const variantIds = (master.recipes || []).map((r: any) => r.id);

          // Check for active master-level pricing
          const { data: priceData } = await supabase
            .from('product_prices')
            .select('id')
            .eq('master_recipe_id', master.id)
            .eq('is_active', true)
            .limit(1);

          // Count recent usage (remisiones in last 90 days)
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          const { count } = await supabase
            .from('remisiones')
            .select('id', { count: 'exact', head: true })
            .in('recipe_id', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000'])
            .gte('fecha', ninetyDaysAgo.toISOString().split('T')[0]);

          return {
            id: master.id,
            master_code: master.master_code,
            plant_id: master.plant_id,
            strength_fc: master.strength_fc,
            age_days: master.age_days,
            age_hours: master.age_hours,
            placement_type: master.placement_type,
            max_aggregate_size: master.max_aggregate_size,
            slump: master.slump,
            variant_count: (master.recipes || []).length,
            variants: (master.recipes || []).map((r: any) => ({
              id: r.id,
              recipe_code: r.recipe_code,
              variant_suffix: r.variant_suffix,
              created_at: r.created_at
            })),
            has_active_price: (priceData || []).length > 0,
            recent_usage_count: count || 0
          };
        })
      );

      setMasters(enriched);

      // Load orphan recipes (no master assigned)
      const { data: orphanRows, error: orphanErr } = await supabase
        .from('recipes')
        .select('id, recipe_code, plant_id, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump, created_at')
        .eq('plant_id', plantId)
        .is('master_recipe_id', null)
        .order('recipe_code');

      if (orphanErr) throw orphanErr;

      setOrphans(orphanRows || []);
    } catch (e: any) {
      const msg = e.message || 'Error cargando datos de maestros';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId]);

  const toggleMaster = (masterId: string) => {
    setExpandedMasters(prev => {
      const next = new Set(prev);
      if (next.has(masterId)) next.delete(masterId);
      else next.add(masterId);
      return next;
    });
  };

  const toggleOrphanSelection = (orphanId: string) => {
    setSelectedOrphans(prev => {
      const next = new Set(prev);
      if (next.has(orphanId)) next.delete(orphanId);
      else next.add(orphanId);
      return next;
    });
  };

  const promoteVariantToMaster = async (variantId: string, recipeCode: string) => {
    if (!confirm(`¿Promover "${recipeCode}" a maestro independiente?`)) return;
    
    setPromotingVariant(variantId);
    try {
      // Call RPC to orphan (unlink from master)
      const { error: unlinkErr } = await supabase.rpc('unlink_variant_from_master', {
        p_recipe_id: variantId
      });

      if (unlinkErr) throw unlinkErr;

      toast.success('Variante promovida a maestro independiente');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error al promover variante');
    } finally {
      setPromotingVariant(null);
    }
  };

  const createMasterFromOrphans = async () => {
    if (selectedOrphans.size === 0) {
      toast.error('Selecciona al menos una receta independiente');
      return;
    }

    const selectedRecipes = orphans.filter(o => selectedOrphans.has(o.id));
    
    // Validate all have same core specs
    const first = selectedRecipes[0];
    const allSameSpec = selectedRecipes.every(r =>
      r.strength_fc === first.strength_fc &&
      r.age_days === first.age_days &&
      r.age_hours === first.age_hours &&
      r.placement_type === first.placement_type &&
      r.max_aggregate_size === first.max_aggregate_size &&
      r.slump === first.slump
    );

    if (!allSameSpec) {
      toast.error('Las recetas seleccionadas deben tener las mismas especificaciones técnicas');
      return;
    }

    // Suggest master code from first recipe
    const { masterCode } = parseMasterAndVariantFromRecipeCode(first.recipe_code);
    const suggestedMasterCode = masterCode || first.recipe_code.split('-').slice(0, -2).join('-');

    const userMasterCode = prompt(
      `Crear maestro para ${selectedRecipes.length} receta(s).\nCódigo sugerido:`,
      suggestedMasterCode
    );

    if (!userMasterCode) return;

    setCreatingMaster(true);
    try {
      // Create master
      const { data: newMaster, error: masterErr } = await supabase
        .from('master_recipes')
        .insert({
          master_code: userMasterCode.trim(),
          plant_id: first.plant_id,
          strength_fc: first.strength_fc,
          age_days: first.age_days,
          age_hours: first.age_hours,
          placement_type: first.placement_type,
          max_aggregate_size: first.max_aggregate_size,
          slump: first.slump
        })
        .select('id')
        .single();

      if (masterErr) throw masterErr;

      // Link variants via RPC
      for (const recipe of selectedRecipes) {
        const { error: linkErr } = await supabase.rpc('link_variant_to_master', {
          p_recipe_id: recipe.id,
          p_master_id: newMaster.id
        });
        if (linkErr) throw linkErr;
      }

      toast.success(`Maestro "${userMasterCode}" creado con ${selectedRecipes.length} variante(s)`);
      setSelectedOrphans(new Set());
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error al crear maestro');
    } finally {
      setCreatingMaster(false);
    }
  };

  const unlinkVariantFromMaster = async (variantId: string, variantCode: string) => {
    if (!confirm(`¿Desvincular "${variantCode}" de su maestro?`)) return;

    try {
      const { error } = await supabase.rpc('unlink_variant_from_master', {
        p_recipe_id: variantId
      });

      if (error) throw error;

      toast.success('Variante desvinculada');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error al desvincular variante');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Recetas Maestras</h1>
          <p className="text-sm text-gray-600 mt-1">
            {filteredMasters.length} maestros • {filteredOrphans.length} recetas independientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showOrphans ? "primary" : "secondary"}
            size="sm"
            onClick={() => setShowOrphans(!showOrphans)}
            className="gap-2"
          >
            {showOrphans ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showOrphans ? 'Ocultar independientes' : 'Mostrar independientes'}
          </Button>
          <Button variant="secondary" onClick={loadData} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refrescar
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por código maestro o variante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Masters List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Recetas Maestras ({filteredMasters.length})
        </h2>

        {filteredMasters.length === 0 && !loading && (
          <Alert>
            <AlertDescription>No hay maestros creados para esta planta.</AlertDescription>
          </Alert>
        )}

        {filteredMasters.map(master => {
          const isExpanded = expandedMasters.has(master.id);
          
          return (
            <div key={master.id} className="border rounded-lg bg-white shadow-sm">
              {/* Master Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleMaster(master.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-bold text-lg">{master.master_code}</h3>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                          {master.variant_count} variante{master.variant_count !== 1 ? 's' : ''}
                        </span>
                        {master.has_active_price && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                            Precio activo
                          </span>
                        )}
                        {master.recent_usage_count > 0 && (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                            {master.recent_usage_count} uso{master.recent_usage_count !== 1 ? 's' : ''} (90d)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        f'c: {master.strength_fc} kg/cm² • Edad: {master.age_days ? `${master.age_days}d` : `${master.age_hours}h`} • 
                        Rev: {master.slump} cm • TMA: {master.max_aggregate_size} mm • {master.placement_type}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variants List */}
              {isExpanded && (
                <div className="border-t bg-gray-50">
                  <div className="p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Variantes:</h4>
                    {master.variants.map(variant => (
                      <div key={variant.id} className="flex items-center justify-between p-3 bg-white rounded border">
                        <div className="flex-1">
                          <div className="font-mono font-semibold">{variant.recipe_code}</div>
                          {variant.variant_suffix && (
                            <div className="text-xs text-gray-600">Sufijo: {variant.variant_suffix}</div>
                          )}
                          <div className="text-xs text-gray-500">
                            Creada: {new Date(variant.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => unlinkVariantFromMaster(variant.id, variant.recipe_code)}
                            className="gap-1"
                          >
                            <Unlink className="h-3 w-3" />
                            Desvincular
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => promoteVariantToMaster(variant.id, variant.recipe_code)}
                            disabled={promotingVariant === variant.id}
                            className="gap-1"
                          >
                            {promotingVariant === variant.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            Promover a maestro
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Orphans Section */}
      {showOrphans && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Unlink className="h-5 w-5" />
              Recetas Independientes ({filteredOrphans.length})
            </h2>
            {selectedOrphans.size > 0 && (
              <Button
                onClick={createMasterFromOrphans}
                disabled={creatingMaster}
                className="gap-2"
              >
                {creatingMaster ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Crear maestro ({selectedOrphans.size})
              </Button>
            )}
          </div>

          {filteredOrphans.length === 0 && !loading && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                ✓ Todas las recetas están vinculadas a un maestro.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrphans.map(orphan => (
              <div
                key={orphan.id}
                className={`border rounded-lg p-4 bg-white cursor-pointer transition-all ${
                  selectedOrphans.has(orphan.id) ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleOrphanSelection(orphan.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-mono font-semibold text-sm break-all">{orphan.recipe_code}</h4>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(orphan.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedOrphans.has(orphan.id)}
                    onChange={() => toggleOrphanSelection(orphan.id)}
                    className="mt-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>f'c: {orphan.strength_fc} kg/cm²</div>
                  <div>Edad: {orphan.age_days ? `${orphan.age_days}d` : `${orphan.age_hours}h`}</div>
                  <div>Rev: {orphan.slump} cm • TMA: {orphan.max_aggregate_size} mm</div>
                  <div>{orphan.placement_type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

