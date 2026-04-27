'use client';

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import RecipeVersionGovernance from '@/components/quality/RecipeVersionGovernance';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  RefreshCw,
  Plus,
  Unlink,
  Link2,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  FileSearch,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';
import { AddRecipeModalV2 } from '@/components/recipes/AddRecipeModalV2';
import { RecipeSearchModal } from '@/components/recipes/RecipeSearchModal';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleIndicator from '@/components/ui/RoleIndicator';
import PlantRestrictedAccess from '@/components/quality/PlantRestrictedAccess';
import { isQualityTeamInRestrictedPlant } from '@/app/layout';
import type { RecipeSearchResult } from '@/types/recipes';

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

function MasterRecipesContent() {
  const { currentPlant } = usePlantContext();
  const { hasRole, profile } = useAuthBridge();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasEditPermission = hasRole(['QUALITY_TEAM', 'EXECUTIVE']);

  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<MasterRecipeWithStats[]>([]);
  const [orphans, setOrphans] = useState<OrphanRecipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOrphans, setShowOrphans] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [groupBy, setGroupBy] = useState<'none' | 'strength' | 'placement'>(
    (searchParams.get('groupBy') as 'none' | 'strength' | 'placement') || 'none',
  );
  const [activeOnly, setActiveOnly] = useState(searchParams.get('active') === '1');
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [promotingVariant, setPromotingVariant] = useState<string | null>(null);
  const [creatingMaster, setCreatingMaster] = useState(false);

  // Recipe creation + advanced search modals
  const [addRecipeOpen, setAddRecipeOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  // ARKIK bulk export selection (recipe codes)
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<'update' | 'new'>('update');

  // Ver versiones sheet state
  const [governanceSheet, setGovernanceSheet] = useState<{
    open: boolean;
    masterCode: string;
  }>({ open: false, masterCode: '' });

  // Persist filters in URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchTerm) params.set('q', searchTerm);
    else params.delete('q');
    if (groupBy !== 'none') params.set('groupBy', groupBy);
    else params.delete('groupBy');
    if (activeOnly) params.set('active', '1');
    else params.delete('active');
    const next = params.toString();
    const target = next ? `${pathname}?${next}` : pathname;
    router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, groupBy, activeOnly]);

  // Auto-expand a master when arriving from /quality/calculator with ?master=XXX
  useEffect(() => {
    const masterCodeFromUrl = searchParams.get('master');
    if (masterCodeFromUrl && masters.length > 0) {
      const m = masters.find((x) => x.master_code === masterCodeFromUrl);
      if (m) setExpandedMasters((prev) => new Set(prev).add(m.id));
    }
  }, [masters, searchParams]);

  // Master code dialog state (replaces browser prompt())
  const [masterCodeDialog, setMasterCodeDialog] = useState<{
    open: boolean;
    suggestedCode: string;
    inputValue: string;
    pendingOrphans: OrphanRecipe[];
  }>({ open: false, suggestedCode: '', inputValue: '', pendingOrphans: [] });

  const plantId = currentPlant?.id;

  const filteredMasters = useMemo(() => {
    let result = masters;
    if (activeOnly) {
      result = result.filter((m) => m.has_active_price || m.recent_usage_count > 0);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.master_code.toLowerCase().includes(lower) ||
          m.variants.some((v) => v.recipe_code.toLowerCase().includes(lower)),
      );
    }
    return result;
  }, [masters, searchTerm, activeOnly]);

  const filteredOrphans = useMemo(() => {
    if (!searchTerm) return orphans;
    const lower = searchTerm.toLowerCase();
    return orphans.filter((o) => o.recipe_code.toLowerCase().includes(lower));
  }, [orphans, searchTerm]);

  // Grouped view: by strength (numeric ascending) or by placement type
  const groupedMasters = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string | number, MasterRecipeWithStats[]>();
    for (const m of filteredMasters) {
      const key: string | number = groupBy === 'strength' ? m.strength_fc : m.placement_type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    // Stable, predictable ordering
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
    return sortedKeys.map((k) => ({ key: k, masters: groups.get(k)! }));
  }, [filteredMasters, groupBy]);

  const loadData = async () => {
    if (!plantId) return;
    setLoading(true);
    setError(null);

    try {
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

      if (!masterRows || masterRows.length === 0) {
        setMasters([]);
        const { data: orphanRows, error: orphanErr } = await supabase
          .from('recipes')
          .select('id, recipe_code, plant_id, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump, created_at')
          .eq('plant_id', plantId)
          .is('master_recipe_id', null)
          .order('recipe_code');
        if (orphanErr) throw orphanErr;
        setOrphans(orphanRows || []);
        return;
      }

      const masterIds = masterRows.map((m) => m.id);
      const { data: allPrices, error: pricesErr } = await supabase
        .from('product_prices')
        .select('master_recipe_id')
        .in('master_recipe_id', masterIds)
        .eq('is_active', true);
      if (pricesErr) throw pricesErr;

      const mastersWithActivePrice = new Set<string>(
        (allPrices || []).map((p) => p.master_recipe_id as string).filter(Boolean),
      );

      const allVariantIds = masterRows.flatMap((m) =>
        ((m.recipes as { id: string }[]) || []).map((r) => r.id),
      );

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateString = ninetyDaysAgo.toISOString().split('T')[0];

      const variantIdsForQuery = allVariantIds.length
        ? allVariantIds
        : ['00000000-0000-0000-0000-000000000000'];

      const CHUNK_SIZE = 500;
      const usageRows: { recipe_id: string }[] = [];
      for (let i = 0; i < variantIdsForQuery.length; i += CHUNK_SIZE) {
        const chunk = variantIdsForQuery.slice(i, i + CHUNK_SIZE);
        const { data: chunkData, error: usageErr } = await supabase
          .from('remisiones')
          .select('recipe_id')
          .in('recipe_id', chunk)
          .gte('fecha', dateString);
        if (usageErr) throw usageErr;
        if (chunkData) usageRows.push(...(chunkData as { recipe_id: string }[]));
      }

      const usageByRecipeId = usageRows.reduce<Record<string, number>>((acc, r) => {
        if (r.recipe_id) acc[r.recipe_id] = (acc[r.recipe_id] || 0) + 1;
        return acc;
      }, {});

      const enriched: MasterRecipeWithStats[] = (masterRows || []).map((master) => {
        const recipeList = (master.recipes as { id: string; recipe_code: string; variant_suffix: string | null; created_at: string }[]) || [];
        const variantIds = recipeList.map((r) => r.id);
        const recentUsageCount = variantIds.reduce((sum, vid) => sum + (usageByRecipeId[vid] || 0), 0);
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
          variant_count: recipeList.length,
          variants: recipeList.map((r) => ({
            id: r.id,
            recipe_code: r.recipe_code,
            variant_suffix: r.variant_suffix,
            created_at: r.created_at,
          })),
          has_active_price: mastersWithActivePrice.has(master.id),
          recent_usage_count: recentUsageCount,
        };
      });

      setMasters(enriched);

      const { data: orphanRows, error: orphanErr } = await supabase
        .from('recipes')
        .select('id, recipe_code, plant_id, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump, created_at')
        .eq('plant_id', plantId)
        .is('master_recipe_id', null)
        .order('recipe_code');
      if (orphanErr) throw orphanErr;
      setOrphans(orphanRows || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error cargando datos de maestros';
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
    setExpandedMasters((prev) => {
      const next = new Set(prev);
      if (next.has(masterId)) next.delete(masterId);
      else next.add(masterId);
      return next;
    });
  };

  const toggleOrphanSelection = (orphanId: string) => {
    setSelectedOrphans((prev) => {
      const next = new Set(prev);
      if (next.has(orphanId)) next.delete(orphanId);
      else next.add(orphanId);
      return next;
    });
  };

  const toggleCodeSelection = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const exportArkik = async () => {
    if (selectedCodes.size === 0) return;
    const params = new URLSearchParams({
      recipe_codes: Array.from(selectedCodes).join(','),
      export_type: exportType,
    });
    if (currentPlant?.id) params.append('plant_id', currentPlant.id);

    const res = await fetch(`/api/recipes/export/arkik?${params}`);
    if (!res.ok) {
      toast.error('Error al exportar ARKIK');
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

  const handleAdvancedSearchSelect = useCallback(
    (recipe: RecipeSearchResult) => {
      setAdvancedSearchOpen(false);
      // Drop the selected recipe code into the search field so the matching master expands
      setSearchTerm(recipe.recipe_code);
    },
    [],
  );

  const promoteVariantToMaster = async (variantId: string, recipeCode: string) => {
    if (!confirm(`¿Promover "${recipeCode}" a maestro independiente?`)) return;
    setPromotingVariant(variantId);
    try {
      const { error: unlinkErr } = await supabase.rpc('unlink_variant_from_master', {
        p_recipe_id: variantId,
      });
      if (unlinkErr) throw unlinkErr;
      toast.success('Variante promovida a maestro independiente');
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al promover variante');
    } finally {
      setPromotingVariant(null);
    }
  };

  const openCreateMasterDialog = () => {
    if (selectedOrphans.size === 0) {
      toast.error('Selecciona al menos una receta independiente');
      return;
    }

    const selectedRecipes = orphans.filter((o) => selectedOrphans.has(o.id));
    const first = selectedRecipes[0];
    const allSameSpec = selectedRecipes.every(
      (r) =>
        r.strength_fc === first.strength_fc &&
        r.age_days === first.age_days &&
        r.age_hours === first.age_hours &&
        r.placement_type === first.placement_type &&
        r.max_aggregate_size === first.max_aggregate_size &&
        r.slump === first.slump,
    );

    if (!allSameSpec) {
      toast.error('Las recetas seleccionadas deben tener las mismas especificaciones técnicas');
      return;
    }

    const { masterCode } = parseMasterAndVariantFromRecipeCode(first.recipe_code);
    const suggestedCode = masterCode || first.recipe_code.split('-').slice(0, -2).join('-');

    setMasterCodeDialog({
      open: true,
      suggestedCode,
      inputValue: suggestedCode,
      pendingOrphans: selectedRecipes,
    });
  };

  const confirmCreateMaster = async () => {
    const { inputValue, pendingOrphans } = masterCodeDialog;
    if (!inputValue.trim()) return;

    setMasterCodeDialog((d) => ({ ...d, open: false }));
    setCreatingMaster(true);

    try {
      const first = pendingOrphans[0];
      const { data: newMaster, error: masterErr } = await supabase
        .from('master_recipes')
        .insert({
          master_code: inputValue.trim(),
          plant_id: first.plant_id,
          strength_fc: first.strength_fc,
          age_days: first.age_days,
          age_hours: first.age_hours,
          placement_type: first.placement_type,
          max_aggregate_size: first.max_aggregate_size,
          slump: first.slump,
        })
        .select('id')
        .single();
      if (masterErr) throw masterErr;

      for (const recipe of pendingOrphans) {
        const { error: linkErr } = await supabase.rpc('link_variant_to_master', {
          p_recipe_id: recipe.id,
          p_master_id: newMaster.id,
        });
        if (linkErr) throw linkErr;
      }

      toast.success(`Maestro "${inputValue.trim()}" creado con ${pendingOrphans.length} variante(s)`);
      setSelectedOrphans(new Set());
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear maestro');
    } finally {
      setCreatingMaster(false);
    }
  };

  const unlinkVariantFromMaster = async (variantId: string, variantCode: string) => {
    if (!confirm(`¿Desvincular "${variantCode}" de su maestro?`)) return;
    try {
      const { error } = await supabase.rpc('unlink_variant_from_master', {
        p_recipe_id: variantId,
      });
      if (error) throw error;
      toast.success('Variante desvinculada');
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al desvincular variante');
    }
  };

  // Block QUALITY_TEAM in restricted plants from accessing the recipes destination
  if (isQualityTeamInRestrictedPlant(profile?.role, currentPlant?.code)) {
    return <PlantRestrictedAccess plantCode={currentPlant?.code || ''} sectionName="la gestión de recetas" />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Recetas
            {!hasEditPermission && (
              <RoleIndicator
                allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
                tooltipText="Solo el equipo de calidad y ejecutivos pueden administrar recetas"
              />
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredMasters.length} maestros · {filteredOrphans.length} recetas independientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE', 'SALES_AGENT']}
            onClick={() => setAdvancedSearchOpen(true)}
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' inline-flex items-center gap-2'}
            showDisabled
            disabledMessage="Solo usuarios autorizados pueden buscar recetas"
          >
            <FileSearch className="h-4 w-4" />
            Búsqueda avanzada
          </RoleProtectedButton>

          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            onClick={() => setAddRecipeOpen(true)}
            className={buttonVariants({ variant: 'primary', size: 'sm' }) + ' inline-flex items-center gap-2'}
            showDisabled
            disabledMessage="Solo el equipo de calidad y ejecutivos pueden agregar recetas"
          >
            <Plus className="h-4 w-4" />
            Agregar Receta
          </RoleProtectedButton>

          <Button
            variant={showOrphans ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowOrphans(!showOrphans)}
            className="gap-2"
          >
            {showOrphans ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showOrphans ? 'Ocultar independientes' : 'Mostrar independientes'}
          </Button>

          <Button variant="secondary" onClick={loadData} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refrescar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código maestro o variante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={groupBy} onValueChange={(v: 'none' | 'strength' | 'placement') => setGroupBy(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin agrupar</SelectItem>
            <SelectItem value="strength">Por resistencia</SelectItem>
            <SelectItem value="placement">Por colocación</SelectItem>
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setActiveOnly(!activeOnly)}
          className={`px-3 py-2 text-sm border rounded-xl transition-colors ${
            activeOnly
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Solo con uso reciente
        </button>
      </div>

      {/* ARKIK bulk-export action bar */}
      {selectedCodes.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <Label htmlFor="export-type" className="text-sm text-gray-700">Formato:</Label>
          <Select value={exportType} onValueChange={(v: 'update' | 'new') => setExportType(v)}>
            <SelectTrigger id="export-type" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="update">Actualizar existentes</SelectItem>
              <SelectItem value="new">Nuevas recetas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportArkik} variant="outline" size="sm">
            Exportar {selectedCodes.size} receta{selectedCodes.size !== 1 ? 's' : ''} a ARKIK
          </Button>
          <Button onClick={() => setSelectedCodes(new Set())} variant="ghost" size="sm">
            Limpiar selección
          </Button>
        </div>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Masters List */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2 text-gray-700">
          <Link2 className="h-4 w-4" />
          Recetas Maestras ({filteredMasters.length})
        </h2>

        {filteredMasters.length === 0 && !loading && (
          <Alert>
            <AlertDescription>No hay maestros creados para esta planta.</AlertDescription>
          </Alert>
        )}

        {groupedMasters ? (
          <div className="space-y-6">
            {groupedMasters.map(({ key, masters: groupMasters }) => (
              <section key={String(key)} className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {groupBy === 'strength' ? `${key} kg/cm²` : `Colocación: ${key}`}
                  </h3>
                  <span className="text-xs text-gray-400">{groupMasters.length} maestros</span>
                </div>
                {groupMasters.map((master) => renderMasterCard(master))}
              </section>
            ))}
          </div>
        ) : (
          filteredMasters.map((master) => renderMasterCard(master))
        )}
      </div>

      {/* Orphans Section */}
      {showOrphans && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2 text-gray-700">
              <Unlink className="h-4 w-4" />
              Recetas Independientes ({filteredOrphans.length})
            </h2>
            {selectedOrphans.size > 0 && hasEditPermission && (
              <Button onClick={openCreateMasterDialog} disabled={creatingMaster} className="gap-2">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrphans.map((orphan) => (
              <div
                key={orphan.id}
                className={`border rounded-xl p-4 bg-white transition-all ${
                  hasEditPermission ? 'cursor-pointer' : ''
                } ${
                  selectedOrphans.has(orphan.id)
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => hasEditPermission && toggleOrphanSelection(orphan.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-mono font-semibold text-sm break-all text-gray-800">
                    {orphan.recipe_code}
                  </h4>
                  {hasEditPermission && (
                    <input
                      type="checkbox"
                      checked={selectedOrphans.has(orphan.id)}
                      onChange={() => toggleOrphanSelection(orphan.id)}
                      className="mt-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>f&apos;c: {orphan.strength_fc} kg/cm²</div>
                  <div>Edad: {orphan.age_days ? `${orphan.age_days}d` : `${orphan.age_hours}h`}</div>
                  <div>
                    Rev: {orphan.slump} cm · TMA: {orphan.max_aggregate_size} mm
                  </div>
                  <div>{orphan.placement_type}</div>
                  <div className="text-gray-400">{new Date(orphan.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ver Versiones Sheet */}
      <Sheet
        open={governanceSheet.open}
        onOpenChange={(open) => setGovernanceSheet((s) => ({ ...s, open }))}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Versiones — {governanceSheet.masterCode}</SheetTitle>
          </SheetHeader>
          {plantId && governanceSheet.open && (
            <RecipeVersionGovernance
              plantId={plantId}
              initialSearch={governanceSheet.masterCode}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Master Code Dialog */}
      <Dialog
        open={masterCodeDialog.open}
        onOpenChange={(open) => setMasterCodeDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear Receta Maestra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Creando maestro para {masterCodeDialog.pendingOrphans.length} receta
              {masterCodeDialog.pendingOrphans.length !== 1 ? 's' : ''} independiente
              {masterCodeDialog.pendingOrphans.length !== 1 ? 's' : ''}.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="master-code-input">Código de maestro</Label>
              <Input
                id="master-code-input"
                value={masterCodeDialog.inputValue}
                onChange={(e) =>
                  setMasterCodeDialog((d) => ({ ...d, inputValue: e.target.value }))
                }
                placeholder={masterCodeDialog.suggestedCode}
                onKeyDown={(e) => e.key === 'Enter' && confirmCreateMaster()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setMasterCodeDialog((d) => ({ ...d, open: false }))}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmCreateMaster}
              disabled={!masterCodeDialog.inputValue.trim()}
            >
              Crear maestro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Recipe Modal V2 */}
      <AddRecipeModalV2
        isOpen={addRecipeOpen}
        onClose={() => setAddRecipeOpen(false)}
        onSuccess={() => {
          setAddRecipeOpen(false);
          loadData();
        }}
      />

      {/*
        TODO(2026-04-27): RecipeSearchModal does spec-based search filtered to recipes that
        have quality data (muestreos / site-checks). Underused on this page; observe usage for
        ~60 days and retire if not adopted. Owner: quality team.
      */}
      <RecipeSearchModal
        isOpen={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        onRecipeSelect={handleAdvancedSearchSelect}
      />
    </div>
  );
}

export default function MasterRecipesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Cargando...</div>}>
      <MasterRecipesContent />
    </Suspense>
  );
}
