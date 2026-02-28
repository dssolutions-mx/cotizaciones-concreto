'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AccessDeniedMessage from '@/components/ui/AccessDeniedMessage';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { supabase } from '@/lib/supabase/client';
import {
  type MasterRecipeRow,
  type PricingFamily,
  getAllMasterCosts,
  groupMastersIntoFamilies,
  computeFamilyMatrix,
} from '@/lib/services/listPriceWorkspaceService';
import {
  type ListPriceRow,
  type PerformanceRow,
  type MasterDraft,
  type RowSaveStatus,
  todayIso,
} from '@/components/list-prices/shared';
import { FamilySidebar } from '@/components/list-prices/FamilySidebar';
import { RuleHelper } from '@/components/list-prices/RuleHelper';
import { MasterRow, MasterTableHeader } from '@/components/list-prices/MasterRow';
import { InsightsTab } from '@/components/list-prices/InsightsTab';
import { toast } from 'sonner';
import { ArrowLeft, Building2, DollarSign, Download, Loader2, RefreshCw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Reads ?tab= param — must live inside <Suspense> to avoid hydration mismatch */
function TabParamReader({ onTab }: { onTab: (t: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'insights' || tab === 'workspace') onTab(tab);
  }, [searchParams, onTab]);
  return null;
}

export default function ListPricesPage() {
  const { profile, hasRole } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const canManage = hasRole(['EXECUTIVE', 'ADMIN_OPERATIONS']);

  // Defer auth-dependent rendering to after mount to prevent SSR/client
  // hydration mismatch (auth is always falsy on the server).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [masters, setMasters]     = useState<MasterRecipeRow[]>([]);
  const [families, setFamilies]   = useState<PricingFamily[]>([]);
  const [listPrices, setListPrices] = useState<ListPriceRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);

  // ── Cost cache (lazy per family) ─────────────────────────────────────────
  const [anchorCostByFamily, setAnchorCostByFamily] = useState<Map<string, number>>(new Map());
  const [costByMaster, setCostByMaster]             = useState<Map<string, number>>(new Map());
  const [costsLoadingFamily, setCostsLoadingFamily] = useState<string | null>(null);

  // ── Drafts + save status ─────────────────────────────────────────────────
  const [drafts, setDrafts]       = useState<Record<string, MasterDraft>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowSaveStatus>>({});
  const [vigenciaByFamily, setVigenciaByFamily] = useState<Record<string, string>>({});

  // ── Rule helper state ────────────────────────────────────────────────────
  const [ruleAnchorPrice, setRuleAnchorPrice]       = useState('');
  const [ruleDeltaRev, setRuleDeltaRev]             = useState('');
  const [ruleUpliftBombeado, setRuleUpliftBombeado] = useState('');

  // ── UI ───────────────────────────────────────────────────────────────────
  const [loading, setLoading]                   = useState(true);
  const [activeTab, setActiveTab]               = useState('workspace');
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const currentLpByMaster = useMemo(() => {
    const map = new Map<string, ListPriceRow>();
    listPrices.forEach((row) => {
      const ex = map.get(row.master_recipe_id);
      if (!ex || row.effective_date > ex.effective_date) map.set(row.master_recipe_id, row);
    });
    return map;
  }, [listPrices]);

  const perfByLpId = useMemo(() => {
    const map = new Map<string, PerformanceRow>();
    performance.forEach((r) => map.set(r.list_price_id, r));
    return map;
  }, [performance]);

  const selectedFamily = useMemo(
    () => families.find((f) => f.key === selectedFamilyKey) ?? null,
    [families, selectedFamilyKey],
  );

  const familiesByStrength = useMemo(() => {
    const map = new Map<number, PricingFamily[]>();
    families.forEach((f) => {
      if (!map.has(f.strengthFc)) map.set(f.strengthFc, []);
      map.get(f.strengthFc)!.push(f);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [families]);

  const dirtyCount = useMemo(
    () => Object.values(rowStatus).filter((s) => s === 'dirty').length,
    [rowStatus],
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!currentPlant?.id) {
      setMasters([]); setFamilies([]); setListPrices([]); setPerformance([]);
      setDrafts({}); setRowStatus({}); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: mastersData, error: mastersErr } = await supabase
        .from('master_recipes')
        .select('id, master_code, display_name, strength_fc, age_days, age_hours, placement_type, slump, max_aggregate_size, plant_id')
        .eq('is_active', true)
        .eq('plant_id', currentPlant.id)
        .order('strength_fc', { ascending: false })
        .order('slump', { ascending: true });

      if (mastersErr) throw mastersErr;
      const loadedMasters = (mastersData ?? []) as MasterRecipeRow[];
      setMasters(loadedMasters);

      const loadedFamilies = groupMastersIntoFamilies(loadedMasters);
      setFamilies(loadedFamilies);

      if (loadedMasters.length === 0) {
        setListPrices([]); setPerformance([]); setDrafts({}); setRowStatus({});
        return;
      }

      const masterIds = loadedMasters.map((m) => m.id);
      const { data: lpData, error: lpErr } = await supabase
        .from('list_prices')
        .select('id, master_recipe_id, base_price, effective_date, expires_at')
        .in('master_recipe_id', masterIds)
        .eq('is_active', true);
      if (lpErr) throw lpErr;
      const loadedLp = (lpData ?? []) as ListPriceRow[];
      setListPrices(loadedLp);

      const lpIds = loadedLp.map((l) => l.id);
      if (lpIds.length > 0) {
        const { data: perfData } = await supabase
          .from('list_price_performance')
          .select('list_price_id, market_fit, vw_avg_floor_delta, sub_floor_volume_pct, vw_delta_zone_ab, vw_delta_zone_c, vw_delta_zone_d, vw_delta_zone_e')
          .in('list_price_id', lpIds);
        setPerformance((perfData ?? []) as PerformanceRow[]);
      } else {
        setPerformance([]);
      }

      const lpByMasterTemp = new Map<string, ListPriceRow>();
      loadedLp.forEach((row) => {
        const ex = lpByMasterTemp.get(row.master_recipe_id);
        if (!ex || row.effective_date > ex.effective_date) lpByMasterTemp.set(row.master_recipe_id, row);
      });

      const nextDrafts: Record<string, MasterDraft> = {};
      const nextStatus: Record<string, RowSaveStatus> = {};
      const nextVigencia: Record<string, string> = {};

      loadedMasters.forEach((m) => {
        const lp = lpByMasterTemp.get(m.id);
        nextDrafts[m.id] = { listPrice: lp ? String(lp.base_price) : '', isDirty: false };
        nextStatus[m.id] = 'idle';
      });
      loadedFamilies.forEach((fam) => {
        const anchorM  = fam.masters.find((m) => m.id === fam.anchorMasterId);
        const anchorLp = anchorM ? lpByMasterTemp.get(anchorM.id) : null;
        nextVigencia[fam.key] = anchorLp ? anchorLp.effective_date.slice(0, 10) : todayIso();
      });

      setDrafts(nextDrafts);
      setRowStatus(nextStatus);
      setVigenciaByFamily(nextVigencia);

      if (loadedFamilies.length > 0) setSelectedFamilyKey((prev) => prev ?? loadedFamilies[0].key);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);

  // Lazy-load costs for the selected family only (cached after first load)
  useEffect(() => {
    if (!selectedFamily || !currentPlant?.id) return;
    const unloaded = selectedFamily.masters.filter((m) => !costByMaster.has(m.id));
    if (unloaded.length === 0) return;

    setCostsLoadingFamily(selectedFamily.key);
    getAllMasterCosts(selectedFamily.masters, currentPlant.id)
      .then((costs) => {
        setCostByMaster((prev) => {
          const next = new Map(prev);
          costs.forEach((cost, masterId) => next.set(masterId, cost));
          return next;
        });
        const anchorId   = selectedFamily.anchorMasterId;
        const anchorCost = anchorId ? costs.get(anchorId) : undefined;
        if (anchorCost != null) {
          setAnchorCostByFamily((prev) => new Map(prev).set(selectedFamily.key, anchorCost));
        }
      })
      .catch(() => {})
      .finally(() => setCostsLoadingFamily(null));
  }, [selectedFamily?.key, currentPlant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill rule inputs when family changes
  useEffect(() => {
    if (!selectedFamily) { setRuleAnchorPrice(''); setRuleDeltaRev(''); setRuleUpliftBombeado(''); return; }
    const anchorM  = selectedFamily.masters.find((m) => m.id === selectedFamily.anchorMasterId);
    const anchorLp = anchorM ? currentLpByMaster.get(anchorM.id) : null;
    setRuleAnchorPrice(anchorLp ? String(anchorLp.base_price) : '');

    if (selectedFamily.slumpValues.length >= 2) {
      const [s0, s1] = selectedFamily.slumpValues;
      const m0 = selectedFamily.masters.find((m) => m.slump === s0 && m.placement_type.toUpperCase().startsWith('D'));
      const m1 = selectedFamily.masters.find((m) => m.slump === s1 && m.placement_type.toUpperCase().startsWith('D'));
      const p0 = m0 ? currentLpByMaster.get(m0.id)?.base_price : null;
      const p1 = m1 ? currentLpByMaster.get(m1.id)?.base_price : null;
      if (p0 && p1 && s1 > s0) {
        const steps = (s1 - s0) / 4;
        setRuleDeltaRev(steps > 0 ? ((p1 - p0) / steps).toFixed(2) : '0');
      } else setRuleDeltaRev('');
    }

    const baseSlump = selectedFamily.slumpValues[0] ?? 0;
    const bombeoM  = selectedFamily.masters.find((m) => m.placement_type.toUpperCase().startsWith('B'));
    const directoM = selectedFamily.masters.find((m) => m.slump === baseSlump && m.placement_type.toUpperCase().startsWith('D'));
    if (bombeoM && directoM) {
      const bp = currentLpByMaster.get(bombeoM.id)?.base_price;
      const dp = currentLpByMaster.get(directoM.id)?.base_price;
      if (bp && dp) {
        const steps = Math.max(0, Math.round((bombeoM.slump - baseSlump) / 4));
        const delta = Number(ruleDeltaRev) || 0;
        setRuleUpliftBombeado(Math.max(0, bp - dp - steps * delta).toFixed(2));
      } else setRuleUpliftBombeado('');
    }
  }, [selectedFamily?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  const setMasterPrice = (masterId: string, value: string) => {
    setDrafts((p)    => ({ ...p, [masterId]: { listPrice: value, isDirty: true } }));
    setRowStatus((p) => ({ ...p, [masterId]: 'dirty' }));
  };

  const applyRuleToFamily = () => {
    if (!selectedFamily) return;
    const anchor = Number(ruleAnchorPrice);
    if (!anchor || anchor <= 0) { toast.error('Define un precio ancla válido'); return; }

    const matrix = computeFamilyMatrix(selectedFamily, anchor, Number(ruleDeltaRev) || 0, Number(ruleUpliftBombeado) || 0);
    setDrafts((prev) => {
      const next = { ...prev };
      selectedFamily.masters.forEach((m) => {
        const price = matrix.get(m.id);
        if (price != null) next[m.id] = { listPrice: String(price), isDirty: true };
      });
      return next;
    });
    setRowStatus((prev) => {
      const next = { ...prev };
      selectedFamily.masters.forEach((m) => { next[m.id] = 'dirty'; });
      return next;
    });
    toast.success(`Regla aplicada a ${selectedFamily.masters.length} maestros`);
  };

  const saveMaster = useCallback(async (masterId: string) => {
    if (!profile?.id) { toast.error('Usuario no identificado'); return; }
    const draft = drafts[masterId];
    const price = Number(draft?.listPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setRowStatus((p) => ({ ...p, [masterId]: 'error' }));
      toast.error('El precio debe ser mayor que cero');
      return;
    }
    const fam           = families.find((f) => f.masters.some((m) => m.id === masterId));
    const effectiveDate = fam ? (vigenciaByFamily[fam.key] ?? todayIso()) : todayIso();

    setRowStatus((p) => ({ ...p, [masterId]: 'saving' }));
    try {
      const existing = currentLpByMaster.get(masterId);
      if (existing && existing.effective_date.slice(0, 10) === effectiveDate) {
        const { error } = await supabase.from('list_prices').update({ base_price: price }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('list_prices').insert({
          master_recipe_id: masterId, base_price: price,
          effective_date: effectiveDate, created_by: profile.id, is_active: true,
        });
        if (error) throw error;
      }
      setRowStatus((p) => ({ ...p, [masterId]: 'saved' }));
      setTimeout(() => setRowStatus((p) => ({ ...p, [masterId]: p[masterId] === 'saved' ? 'idle' : p[masterId] })), 2000);
    } catch (err: unknown) {
      setRowStatus((p) => ({ ...p, [masterId]: 'error' }));
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }, [drafts, currentLpByMaster, profile?.id, families, vigenciaByFamily]);

  const saveFamilyAll = useCallback(async () => {
    if (!selectedFamily || !profile?.id) return;
    const targets = selectedFamily.masters.filter((m) => drafts[m.id]?.listPrice);
    if (targets.length === 0) { toast.warning('Sin precios para guardar'); return; }
    for (const m of targets) await saveMaster(m.id); // eslint-disable-line no-await-in-loop
    await refresh();
    toast.success(`Familia f'c ${selectedFamily.strengthFc} guardada`);
  }, [selectedFamily, drafts, profile?.id, saveMaster, refresh]);

  const exportCsv = () => {
    const headers = ["f'c", 'Madurez', 'Código maestro', 'TMA (mm)', 'Revenimiento (cm)', 'Colocación', 'Costo materiales', 'Precio lista', 'Margen %', 'Vigencia'];
    const rows = families.flatMap((fam) =>
      fam.masters.map((m) => {
        const price  = Number(drafts[m.id]?.listPrice || 0);
        const cost   = costByMaster.get(m.id);
        const margin = cost && price ? (((price - cost) / cost) * 100).toFixed(2) : '';
        return [fam.strengthFc, fam.ageLabel, m.master_code, m.max_aggregate_size ?? '', m.slump, m.placement_type, cost?.toFixed(2) ?? '', price ? price.toFixed(2) : '', margin, vigenciaByFamily[fam.key] ?? ''];
      }),
    );
    const csv = [headers, ...rows].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `list-prices-${currentPlant?.code ?? 'plant'}-${todayIso()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  // The outer shell is always rendered identically (server + client first pass)
  // so React hydration never sees a mismatch. Auth-dependent content renders
  // only after mount (client-only).
  return (
    <div className="container mx-auto p-6 space-y-6">
      {mounted && !canManage && (
        <Card><CardContent className="p-6">
          <AccessDeniedMessage action="gestionar precios ejecutivos" requiredRoles={['EXECUTIVE', 'ADMIN_OPERATIONS']} />
        </CardContent></Card>
      )}
      {mounted && canManage && (<>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href="/prices" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-2 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Volver a Gestión de Precios
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <DollarSign className="h-6 w-6 text-slate-600" />
            Precios Ejecutivos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentPlant
              ? `Planta ${currentPlant.name} · ${families.length} familias · ${masters.length} recetas maestras`
              : 'Selecciona una planta para comenzar.'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:mt-1">
          {dirtyCount > 0 && (
            <Badge variant="warning">{dirtyCount} {dirtyCount === 1 ? 'fila modificada' : 'filas modificadas'}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {!currentPlant ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 mb-4">
              <Building2 className="h-7 w-7 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">Sin planta seleccionada</p>
            <p className="text-sm text-slate-500 mt-1">Selecciona una planta en el selector global.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Suspense fallback={null}>
            <TabParamReader onTab={setActiveTab} />
          </Suspense>
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="workspace">Gestión de Precios</TabsTrigger>
            <TabsTrigger value="insights">Insights KPI</TabsTrigger>
          </TabsList>

          {/* ── Tab: Gestión de Precios ─────────────────────────────── */}
          <TabsContent value="workspace" className="space-y-0">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : families.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <p className="font-semibold text-slate-600">Sin recetas maestras activas</p>
                  <p className="text-sm text-slate-400 mt-1">No hay maestros configurados para {currentPlant.name}.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-6 h-[calc(100vh-220px)]">

                <FamilySidebar
                  familiesByStrength={familiesByStrength}
                  currentLpByMaster={currentLpByMaster}
                  selectedFamilyKey={selectedFamilyKey}
                  onSelect={setSelectedFamilyKey}
                />

                <div className="flex-1 overflow-y-auto space-y-4 pb-4 custom-scrollbar">
                  {!selectedFamily ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">
                      Selecciona una familia del panel izquierdo
                    </div>
                  ) : (
                    <>
                      {/* Family header */}
                      <Card>
                        <CardHeader className="pb-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                            {/* Identity block */}
                            <div className="flex items-center gap-4">
                              {/* f'c pill */}
                              <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900 text-white px-4 py-2.5 shrink-0 min-w-[72px]">
                                <span className="text-xs font-semibold uppercase tracking-widest text-white/40 leading-none mb-0.5">f&apos;c</span>
                                <span className="text-xl font-bold leading-none tabular-nums">{selectedFamily.strengthFc}</span>
                                <span className="text-xs text-white/40 mt-0.5">kg/cm²</span>
                              </div>

                              <div>
                                <p className="font-semibold text-slate-900 leading-tight">
                                  {selectedFamily.ageLabel}
                                </p>
                                <p className="text-sm text-slate-500 mt-0.5">
                                  {selectedFamily.masters.length} maestros ·{' '}
                                  Rev. {selectedFamily.slumpValues.join(', ')} cm ·{' '}
                                  {selectedFamily.placements.map((p) => p.toUpperCase().startsWith('D') ? 'Directa' : 'Bombeado').join(' y ')}
                                </p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-end gap-3 shrink-0">
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                                  Vigencia (familia)
                                </label>
                                <input
                                  type="date"
                                  value={vigenciaByFamily[selectedFamily.key] ?? todayIso()}
                                  onChange={(e) => setVigenciaByFamily((p) => ({ ...p, [selectedFamily.key]: e.target.value }))}
                                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                                />
                              </div>
                              <Button
                                onClick={saveFamilyAll}
                              >
                                <Save className="h-4 w-4 mr-2" />
                                Guardar familia ({selectedFamily.masters.filter((m) => drafts[m.id]?.listPrice).length})
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>

                      <RuleHelper
                        family={selectedFamily}
                        anchorCost={anchorCostByFamily.get(selectedFamily.key)}
                        ruleAnchorPrice={ruleAnchorPrice}
                        ruleDeltaRev={ruleDeltaRev}
                        ruleUpliftBombeado={ruleUpliftBombeado}
                        onAnchorChange={setRuleAnchorPrice}
                        onDeltaRevChange={setRuleDeltaRev}
                        onUpliftChange={setRuleUpliftBombeado}
                        onApply={applyRuleToFamily}
                      />

                      {/* Masters table */}
                      <Card>
                        <CardHeader className="pb-0">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-slate-700">
                              Recetas maestras
                            </CardTitle>
                            {costsLoadingFamily === selectedFamily.key && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Calculando costos…
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 mt-3 overflow-x-auto">
                          <MasterTableHeader />

                          <div className="divide-y divide-gray-100">
                            {selectedFamily.slumpValues.map((slump) => {
                              const slumpMasters = selectedFamily.masters.filter((m) => m.slump === slump);
                              if (slumpMasters.length === 0) return null;
                              return (
                                <div key={slump}>
                                  {/* Revenimiento group header */}
                                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-l-4 border-slate-300">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 tabular-nums">
                                      Rev. {slump} cm
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      · {slumpMasters.length} {slumpMasters.length === 1 ? 'maestro' : 'maestros'}
                                    </span>
                                  </div>
                                  {slumpMasters.map((master) => (
                                    <MasterRow
                                      key={master.id}
                                      master={master}
                                      plantId={currentPlant.id}
                                      cost={costByMaster.get(master.id)}
                                      costsLoading={costsLoadingFamily === selectedFamily.key}
                                      draft={drafts[master.id]}
                                      status={rowStatus[master.id] ?? 'idle'}
                                      currentLp={currentLpByMaster.get(master.id)}
                                      onPriceChange={setMasterPrice}
                                      onSave={saveMaster}
                                    />
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      <p className="text-xs text-slate-400 px-1">
                        Misma vigencia = actualiza precio existente. Fecha nueva = crea versión histórica.
                        Haz clic en el código de un maestro para ver el desglose de materiales.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Insights KPI ──────────────────────────────────── */}
          <TabsContent value="insights" className="space-y-6">
            <InsightsTab
              familiesByStrength={familiesByStrength}
              currentLpByMaster={currentLpByMaster}
              perfByLpId={perfByLpId}
            />
          </TabsContent>
        </Tabs>
      )}
      </>)}
    </div>
  );
}
