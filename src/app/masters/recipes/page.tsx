'use client';

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';
import { AddRecipeModalV2 } from '@/components/recipes/AddRecipeModalV2';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleIndicator from '@/components/ui/RoleIndicator';
import PlantRestrictedAccess from '@/components/quality/PlantRestrictedAccess';
import { isQualityTeamInRestrictedPlant } from '@/app/layout';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';

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
  const [activeOnly, setActiveOnly] = useState(searchParams.get('active') === '1');
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  // Hierarchical grouping expand/collapse:
  // collapsedStrengths = strength values explicitly collapsed (default: all open)
  // expandedSubGroups = composite keys "a:{fc}_{ageKey}", "t:{fc}_{ageKey}_{tma}", "r:{fc}_{ageKey}_{tma}_{slump}" that are open
  const [collapsedStrengths, setCollapsedStrengths] = useState<Set<number>>(new Set());
  const [expandedSubGroups, setExpandedSubGroups] = useState<Set<string>>(new Set());
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [promotingVariant, setPromotingVariant] = useState<string | null>(null);
  const [creatingMaster, setCreatingMaster] = useState(false);

  const [addRecipeOpen, setAddRecipeOpen] = useState(false);

  // ARKIK bulk export selection (recipe codes)
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<'update' | 'new'>('update');

  // Ver versiones sheet state
  const [governanceSheet, setGovernanceSheet] = useState<{
    open: boolean;
    masterCode: string;
    masterId: string;
  }>({ open: false, masterCode: '', masterId: '' });

  // Persist filters in URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchTerm) params.set('q', searchTerm);
    else params.delete('q');
    params.delete('groupBy'); // hierarchy is always on, no need to persist
    if (activeOnly) params.set('active', '1');
    else params.delete('active');
    const next = params.toString();
    const target = next ? `${pathname}?${next}` : pathname;
    router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeOnly]);

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

  // 4-level hierarchy: strength → age → TMA → slump → masters
  const hierarchy = useMemo(() => {
    type SlumpGroup = { slump: number; masters: MasterRecipeWithStats[] };
    type TmaGroup = { tma: number; total: number; slumps: SlumpGroup[] };
    type AgeGroup = { ageKey: string; ageLabel: string; total: number; tmas: TmaGroup[] };
    type StrengthGroup = { strength: number; total: number; ages: AgeGroup[] };

    const s = new Map<number, Map<string, Map<number, Map<number, MasterRecipeWithStats[]>>>>();
    for (const m of filteredMasters) {
      const ageKey = m.age_days ? `${m.age_days}d` : `${m.age_hours}h`;
      if (!s.has(m.strength_fc)) s.set(m.strength_fc, new Map());
      const ag = s.get(m.strength_fc)!;
      if (!ag.has(ageKey)) ag.set(ageKey, new Map());
      const tm = ag.get(ageKey)!;
      if (!tm.has(m.max_aggregate_size)) tm.set(m.max_aggregate_size, new Map());
      const sl = tm.get(m.max_aggregate_size)!;
      if (!sl.has(m.slump)) sl.set(m.slump, []);
      sl.get(m.slump)!.push(m);
    }

    const result: StrengthGroup[] = [...s.entries()]
      .sort(([a], [b]) => a - b)
      .map(([strength, ageMap]) => {
        const ages: AgeGroup[] = [...ageMap.entries()]
          .sort(([a], [b]) => {
            const da = a.endsWith('d') ? Number(a.slice(0, -1)) : Number(a.slice(0, -1)) / 24;
            const db = b.endsWith('d') ? Number(b.slice(0, -1)) : Number(b.slice(0, -1)) / 24;
            return da - db;
          })
          .map(([ageKey, tmaMap]) => {
            const tmas: TmaGroup[] = [...tmaMap.entries()]
              .sort(([a], [b]) => a - b)
              .map(([tma, slumpMap]) => {
                const slumps: SlumpGroup[] = [...slumpMap.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([slump, masters]) => ({ slump, masters }));
                return { tma, total: slumps.reduce((n, g) => n + g.masters.length, 0), slumps };
              });
            const total = tmas.reduce((n, g) => n + g.total, 0);
            const ageLabel = ageKey.endsWith('d')
              ? `${ageKey.slice(0, -1)} días`
              : `${ageKey.slice(0, -1)} horas`;
            return { ageKey, ageLabel, total, tmas };
          });
        const total = ages.reduce((n, g) => n + g.total, 0);
        return { strength, total, ages };
      });

    return result;
  }, [filteredMasters]);

  const toggleStrengthGroup = (strength: number) => {
    setCollapsedStrengths((prev) => {
      const next = new Set(prev);
      if (next.has(strength)) next.delete(strength);
      else next.add(strength);
      return next;
    });
  };

  const toggleSubGroup = (key: string) => {
    setExpandedSubGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderMasterCard = (master: MasterRecipeWithStats) => {
    const isExpanded = expandedMasters.has(master.id);
    return (
      <div key={master.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
          onClick={() => toggleMaster(master.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-gray-900">{master.master_code}</span>
                  <Badge className="bg-sky-100 text-sky-800 border border-sky-200">
                    {master.variant_count} variante{master.variant_count !== 1 ? 's' : ''}
                  </Badge>
                  {master.has_active_price && <Badge variant="success">Precio activo</Badge>}
                  {master.recent_usage_count > 0 && (
                    <Badge variant="secondary">
                      {master.recent_usage_count} uso{master.recent_usage_count !== 1 ? 's' : ''} (90d)
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  f&apos;c: {master.strength_fc} kg/cm² · Edad:{' '}
                  {master.age_days ? `${master.age_days}d` : `${master.age_hours}h`} · Rev:{' '}
                  {master.slump} cm · TMA: {master.max_aggregate_size} mm · {master.placement_type}
                </div>
              </div>
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Variantes</h4>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1 h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setGovernanceSheet({ open: true, masterCode: master.master_code, masterId: master.id });
                }}
              >
                Ver versiones
              </Button>
            </div>
            {master.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedCodes.has(variant.recipe_code)}
                    onCheckedChange={() => toggleCodeSelection(variant.recipe_code)}
                    aria-label={`Seleccionar ${variant.recipe_code} para exportación ARKIK`}
                  />
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-sm text-gray-800 truncate">
                      {variant.recipe_code}
                    </div>
                    {variant.variant_suffix && (
                      <div className="text-xs text-gray-500">Sufijo: {variant.variant_suffix}</div>
                    )}
                    <div className="text-xs text-gray-400">
                      {new Date(variant.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {hasEditPermission && (
                  <div className="flex gap-2 shrink-0">
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
                      variant="outline"
                      onClick={() => promoteVariantToMaster(variant.id, variant.recipe_code)}
                      disabled={promotingVariant === variant.id}
                      className="gap-1"
                    >
                      {promotingVariant === variant.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Promover
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
      <QualityBreadcrumb
        hubName="Recetas"
        hubHref="/quality/recetas-hub"
        items={[{ label: 'Maestros' }]}
      />

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
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            onClick={() => setAddRecipeOpen(true)}
            className="h-9 px-3 py-1.5 text-sm rounded-xl bg-sky-600 text-white hover:bg-sky-700 inline-flex items-center gap-2 font-medium transition-all duration-200 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            showDisabled
            disabledMessage="Solo el equipo de calidad y ejecutivos pueden agregar recetas"
          >
            <Plus className="h-4 w-4" />
            Agregar Receta
          </RoleProtectedButton>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowOrphans(!showOrphans)}
            className={cn('gap-2', showOrphans && 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100')}
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
            className="w-full pl-10 pr-9 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
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

        <button
          type="button"
          onClick={() => setActiveOnly(!activeOnly)}
          className={cn(
            'px-3 py-2 text-sm border rounded-xl transition-colors',
            activeOnly ? 'bg-sky-50 border-sky-300 text-sky-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
          )}
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

      {/* Masters — 4-level hierarchy: resistencia → días → TMA → revenimiento */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="h-4 w-4 text-gray-500" />
          <span className="text-base font-semibold text-gray-700">
            Recetas Maestras ({filteredMasters.length})
          </span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        </div>

        {filteredMasters.length === 0 && !loading && (
          <Alert>
            <AlertDescription>No hay maestros creados para esta planta.</AlertDescription>
          </Alert>
        )}

        {hierarchy.map(({ strength, total, ages }) => {
          const isStrengthOpen = !collapsedStrengths.has(strength);
          return (
            <section key={strength} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* L1: Resistencia */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-sky-50 transition-colors text-left"
                onClick={() => toggleStrengthGroup(strength)}
              >
                <div className="flex items-center gap-2">
                  {isStrengthOpen ? (
                    <ChevronDown className="h-4 w-4 text-sky-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                  <span className="font-semibold text-gray-900">
                    f&apos;c {strength} kg/cm²
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-medium">
                  {total} maestro{total !== 1 ? 's' : ''}
                </span>
              </button>

              {isStrengthOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {ages.map(({ ageKey, ageLabel, total: ageTotal, tmas }) => {
                    const ageGroupKey = `a:${strength}_${ageKey}`;
                    const isAgeOpen = expandedSubGroups.has(ageGroupKey);
                    return (
                      <div key={ageKey} className="bg-gray-50/50">
                        {/* L2: Días */}
                        <button
                          type="button"
                          className="w-full flex items-center justify-between pl-8 pr-4 py-2 hover:bg-sky-50/60 transition-colors text-left"
                          onClick={() => toggleSubGroup(ageGroupKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isAgeOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            )}
                            <span className="text-sm font-medium text-gray-700">{ageLabel}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {ageTotal} maestro{ageTotal !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {isAgeOpen && (
                          <div className="divide-y divide-gray-100">
                            {tmas.map(({ tma, total: tmaTotal, slumps }) => {
                              const tmaGroupKey = `t:${strength}_${ageKey}_${tma}`;
                              const isTmaOpen = expandedSubGroups.has(tmaGroupKey);
                              return (
                                <div key={tma} className="bg-white/60">
                                  {/* L3: TMA */}
                                  <button
                                    type="button"
                                    className="w-full flex items-center justify-between pl-12 pr-4 py-1.5 hover:bg-sky-50/40 transition-colors text-left"
                                    onClick={() => toggleSubGroup(tmaGroupKey)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isTmaOpen ? (
                                        <ChevronDown className="h-3 w-3 text-sky-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                                      )}
                                      <span className="text-xs font-medium text-gray-600">
                                        TMA {tma} mm
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                      {tmaTotal} maestro{tmaTotal !== 1 ? 's' : ''}
                                    </span>
                                  </button>

                                  {isTmaOpen && (
                                    <div className="divide-y divide-gray-50">
                                      {slumps.map(({ slump, masters: slumpMasters }) => {
                                        const slumpGroupKey = `r:${strength}_${ageKey}_${tma}_${slump}`;
                                        const isSlumpOpen = expandedSubGroups.has(slumpGroupKey);
                                        return (
                                          <div key={slump}>
                                            {/* L4: Revenimiento */}
                                            <button
                                              type="button"
                                              className="w-full flex items-center justify-between pl-16 pr-4 py-1.5 hover:bg-gray-50 transition-colors text-left"
                                              onClick={() => toggleSubGroup(slumpGroupKey)}
                                            >
                                              <div className="flex items-center gap-2">
                                                {isSlumpOpen ? (
                                                  <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                                                ) : (
                                                  <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                                                )}
                                                <span className="text-xs text-gray-500">
                                                  Rev {slump} cm
                                                </span>
                                              </div>
                                              <span className="text-xs text-gray-400">
                                                {slumpMasters.length} maestro{slumpMasters.length !== 1 ? 's' : ''}
                                              </span>
                                            </button>
                                            {isSlumpOpen && (
                                              <div className="pl-16 pr-4 pb-3 pt-1 space-y-2 bg-gray-50/30">
                                                {slumpMasters.map((master) => renderMasterCard(master))}
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
              )}
            </section>
          );
        })}
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
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-hidden">
          <SheetHeader className="shrink-0 mb-2">
            <SheetTitle>Versiones — {governanceSheet.masterCode}</SheetTitle>
          </SheetHeader>
          {plantId && governanceSheet.open && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <RecipeVersionGovernance
                plantId={plantId}
                initialSearch={governanceSheet.masterCode}
                initialMasterId={governanceSheet.masterId}
              />
            </div>
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
