'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw, Search, CheckCircle2, AlertCircle, XCircle, AlertTriangle,
  Edit2, X, Loader2, ShieldAlert, ChevronDown, ChevronUp, ArrowLeft,
  MinusCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  recipeGovernanceService,
  type MasterGovernanceData,
  type VariantVersionStatus,
  type AvailableMaterial,
  type MaterialQuantityWithDetails,
  type MaterialValidationIssue,
} from '@/lib/services/recipeGovernanceService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MaterialQuantityEditor from './MaterialQuantityEditor';

interface RecipeVersionGovernanceProps {
  plantId: string;
  initialSearch?: string;
  initialMasterId?: string;
}

// --- Typed issue-type metadata map (TS enforces full coverage) ---
const ISSUE_TYPE_META: Record<MaterialValidationIssue['type'], { label: string; Icon: LucideIcon }> = {
  missing_cement: { label: 'Falta Cemento', Icon: XCircle },
  missing_water: { label: 'Falta Agua', Icon: XCircle },
  low_cement: { label: 'Cemento Bajo', Icon: AlertTriangle },
  too_few_materials: { label: 'Pocos Materiales', Icon: AlertTriangle },
  low_quantities: { label: 'Cantidades Bajas', Icon: AlertTriangle },
  invalid_quantities: { label: 'Cantidades Inválidas', Icon: XCircle },
};

// --- Status → semantic classes helper ---
function getStatusMeta(status: VariantVersionStatus['status']): {
  label: string;
  Icon: LucideIcon;
  badgeClass: string;
  iconClass: string;
} {
  switch (status) {
    case 'up-to-date':
      return { label: 'Actualizado', Icon: CheckCircle2, badgeClass: 'bg-green-100 text-green-800 border-green-200', iconClass: 'text-green-600' };
    case 'outdated':
      return { label: 'Desactualizado', Icon: AlertCircle, badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200', iconClass: 'text-yellow-600' };
    case 'no-version':
      return { label: 'Sin Versión', Icon: XCircle, badgeClass: 'bg-red-100 text-red-800 border-red-200', iconClass: 'text-red-600' };
    case 'inconsistent':
      return { label: 'Inconsistente', Icon: AlertCircle, badgeClass: 'bg-orange-100 text-orange-800 border-orange-200', iconClass: 'text-orange-600' };
    default:
      return { label: status, Icon: MinusCircle, badgeClass: 'bg-gray-100 text-gray-700', iconClass: 'text-gray-400' };
  }
}

export default function RecipeVersionGovernance({ plantId, initialSearch, initialMasterId }: RecipeVersionGovernanceProps) {
  const [masters, setMasters] = useState<MasterGovernanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableMaterials, setAvailableMaterials] = useState<AvailableMaterial[]>([]);
  const [editingVariant, setEditingVariant] = useState<VariantVersionStatus | null>(null);
  const [loadingMaterialsFor, setLoadingMaterialsFor] = useState<Set<string>>(new Set());
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());

  // Filter state — reset on plantId change
  const [searchTerm, setSearchTerm] = useState(initialSearch ?? '');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VariantVersionStatus['status']>('all');

  // Master/detail selection state
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(initialMasterId ?? null);
  const [activeTab, setActiveTab] = useState<'variants' | 'validaciones'>('variants');

  const hasAutoExpandedRef = useRef(false);

  // Reset filters and selection when plant changes
  useEffect(() => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setSearchTerm(initialSearch ?? '');
    setSelectedMasterId(initialMasterId ?? null);
    setExpandedVariants(new Set());
    hasAutoExpandedRef.current = false;
  }, [plantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(null);
    hasAutoExpandedRef.current = false;
    try {
      const [governanceData, materials] = await Promise.all([
        recipeGovernanceService.getMasterGovernanceData(plantId),
        recipeGovernanceService.getAvailableMaterials(plantId),
      ]);
      setMasters(governanceData);
      setAvailableMaterials(materials);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [plantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first master with critical issues (or the initialMasterId) after load
  useEffect(() => {
    if (masters.length === 0 || hasAutoExpandedRef.current) return;
    hasAutoExpandedRef.current = true;

    if (initialMasterId) {
      const found = masters.find((m) => m.masterId === initialMasterId);
      if (found) { setSelectedMasterId(initialMasterId); return; }
    }

    // Auto-expand QB variants with issues
    const toExpand = new Set<string>();
    for (const master of masters) {
      for (const v of master.variants) {
        if (v.isQuoteBuilderVariant && (v.validationIssues?.length ?? 0) > 0) {
          toExpand.add(v.variantId);
        }
      }
    }
    if (toExpand.size > 0) setExpandedVariants(toExpand);
  }, [masters]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVariantExpansion = async (variant: VariantVersionStatus) => {
    const { variantId } = variant;
    const next = new Set(expandedVariants);
    if (next.has(variantId)) {
      next.delete(variantId);
      setExpandedVariants(next);
      return;
    }
    next.add(variantId);
    setExpandedVariants(next);

    if (variant.materials.length === 0 && (variant.materialCount ?? 0) > 0 && variant.latestVersion?.id) {
      setLoadingMaterialsFor((prev) => new Set(prev).add(variantId));
      try {
        const mats = await recipeGovernanceService.getMaterialsForVersion(variant.latestVersion.id);
        setMasters((prev) =>
          prev.map((m) => ({
            ...m,
            variants: m.variants.map((v) => (v.variantId === variantId ? { ...v, materials: mats } : v)),
          }))
        );
      } catch {
        toast.error('No se pudieron cargar los materiales');
      } finally {
        setLoadingMaterialsFor((prev) => {
          const s = new Set(prev);
          s.delete(variantId);
          return s;
        });
      }
    }
  };

  const handleMaterialSave = async (variantId: string, materials: MaterialQuantityWithDetails[]) => {
    try {
      await recipeGovernanceService.updateVariantMaterials(
        variantId,
        materials.map((m) => ({
          recipe_version_id: m.recipe_version_id,
          material_type: m.material_type,
          material_id: m.material_id,
          quantity: m.quantity,
          unit: m.unit,
        })),
        'Actualización desde Gobernanza de Versiones'
      );
      toast.success('Materiales actualizados. Nueva versión creada.');
      setEditingVariant(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar materiales';
      toast.error(msg);
      throw err;
    }
  };

  // --- Filtered masters ---
  const filteredMasters = useMemo(() => {
    return masters
      .map((master) => ({
        ...master,
        variants: master.variants.filter((variant) => {
          if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            if (!variant.recipeCode.toLowerCase().includes(q) && !master.masterCode.toLowerCase().includes(q)) return false;
          }
          if (statusFilter !== 'all' && variant.status !== statusFilter) return false;
          if (severityFilter !== 'all') {
            const issues = variant.validationIssues ?? [];
            if (!issues.some((i) => i.severity === severityFilter)) return false;
          }
          return true;
        }),
      }))
      .filter((m) => m.variants.length > 0)
      .sort((a, b) => {
        const aErr = a.variants.some((v) => v.isQuoteBuilderVariant && (v.validationIssues?.some((i) => i.severity === 'error') ?? false));
        const bErr = b.variants.some((v) => v.isQuoteBuilderVariant && (v.validationIssues?.some((i) => i.severity === 'error') ?? false));
        if (aErr !== bErr) return aErr ? -1 : 1;
        return 0;
      });
  }, [masters, searchTerm, severityFilter, statusFilter]);

  // --- Summary ---
  const overallSummary = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let upToDate = 0;
    let outdated = 0;
    let noVersion = 0;
    for (const m of masters) {
      for (const v of m.variants) {
        if (v.status === 'up-to-date') upToDate++;
        else if (v.status === 'outdated') outdated++;
        else if (v.status === 'no-version') noVersion++;
        for (const i of v.validationIssues ?? []) {
          if (i.severity === 'error' && v.isQuoteBuilderVariant) errors++;
          else if (i.severity === 'warning') warnings++;
        }
      }
    }
    const totalVariants = masters.reduce((s, m) => s + m.summary.totalVariants, 0);
    return { totalMasters: masters.length, totalVariants, upToDate, outdated, noVersion, errors, warnings };
  }, [masters]);

  const selectedMaster = useMemo(
    () => filteredMasters.find((m) => m.masterId === selectedMasterId) ?? null,
    [filteredMasters, selectedMasterId]
  );

  // --- Loading / Error states ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Cargando datos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Error al cargar datos</p>
            <p className="text-red-600 mt-1">{error}</p>
            <Button onClick={loadData} variant="outline" className="mt-4" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Main render ---
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
          {overallSummary.totalMasters} maestros · {overallSummary.totalVariants} variantes
        </span>
        <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />{overallSummary.upToDate} actualizadas
        </span>
        <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{overallSummary.outdated} desactualizadas
        </span>
        {overallSummary.noVersion > 0 && (
          <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-medium flex items-center gap-1">
            <XCircle className="w-3 h-3" />{overallSummary.noVersion} sin versión
          </span>
        )}
        {overallSummary.errors > 0 && (
          <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />{overallSummary.errors} errores QB
          </span>
        )}
        {overallSummary.warnings > 0 && (
          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />{overallSummary.warnings} advertencias
          </span>
        )}
        <Button onClick={loadData} variant="ghost" size="sm" className="h-6 px-2 ml-auto">
          <RefreshCw className="w-3 h-3 mr-1" />Actualizar
        </Button>
      </div>

      {/* Master / Detail layout */}
      <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden flex-1 min-h-0">
        {/* Left rail */}
        <div className={cn(
          'w-52 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50',
          selectedMasterId ? 'hidden sm:flex' : 'flex'
        )}>
          {/* Search + filters */}
          <div className="p-2 space-y-1.5 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Buscar código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpiar"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="up-to-date">Actualizados</SelectItem>
                <SelectItem value="outdated">Desactualizados</SelectItem>
                <SelectItem value="no-version">Sin versión</SelectItem>
                <SelectItem value="inconsistent">Inconsistentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda severidad</SelectItem>
                <SelectItem value="error">Solo errores</SelectItem>
                <SelectItem value="warning">Solo advertencias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Master list */}
          <div className="flex-1 overflow-y-auto">
            {filteredMasters.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 px-2">Sin resultados</p>
            ) : (
              filteredMasters.map((master) => {
                const hasErrors = master.variants.some(
                  (v) => v.isQuoteBuilderVariant && (v.validationIssues?.some((i) => i.severity === 'error') ?? false)
                );
                const hasWarnings = !hasErrors && master.variants.some(
                  (v) => v.validationIssues?.some((i) => i.severity === 'warning') ?? false
                );
                const isSelected = master.masterId === selectedMasterId;
                const firstVariant = master.variants[0];
                const { Icon: StatusIcon, iconClass } = firstVariant
                  ? getStatusMeta(firstVariant.status)
                  : { Icon: MinusCircle, iconClass: 'text-gray-400' };

                return (
                  <button
                    id={`rail-master-${master.masterId}`}
                    key={master.masterId}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2 border-b border-gray-100 transition-colors hover:bg-white',
                      isSelected ? 'bg-white border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent',
                      hasErrors && 'border-l-red-500',
                      !hasErrors && hasWarnings && 'border-l-yellow-400'
                    )}
                    onClick={() => {
                      setSelectedMasterId(master.masterId);
                      setActiveTab('variants');
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StatusIcon className={cn('h-3 w-3 shrink-0', iconClass)} />
                      <span className="font-mono text-xs font-semibold text-gray-900 truncate">
                        {master.masterCode}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {master.strengthFc} kg/cm² · {master.variants.length}v
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane */}
        <div className={cn(
          'flex-1 min-w-0 flex flex-col overflow-hidden',
          !selectedMasterId ? 'hidden sm:flex' : 'flex'
        )}>
          {!selectedMasterId || !selectedMaster ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 py-12">
              Selecciona un maestro
            </div>
          ) : (
            <>
              {/* Right pane header */}
              <div className="p-3 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="sm:hidden text-gray-500 hover:text-gray-800"
                    onClick={() => setSelectedMasterId(null)}
                    aria-label="Volver"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900">{selectedMaster.masterCode}</span>
                      <Badge variant="outline" className="text-xs">
                        f&apos;c {selectedMaster.strengthFc} kg/cm²
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedMaster.placementType === 'D' ? 'Directa' : 'Bombeado'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Slump {selectedMaster.slump} cm
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selectedMaster.variants.length} variante{selectedMaster.variants.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'variants' | 'validaciones')} className="flex-1 flex flex-col min-h-0">
                <TabsList className="shrink-0 rounded-none border-b border-gray-200 bg-transparent h-9 px-3 justify-start gap-1">
                  <TabsTrigger value="variants" className="text-xs h-7">
                    Variantes ({selectedMaster.variants.length})
                  </TabsTrigger>
                  <TabsTrigger value="validaciones" className="text-xs h-7">
                    Validaciones
                    {selectedMaster.variants.some((v) => v.validationIssues?.length) && (
                      <span className="ml-1.5 h-4 w-4 rounded-full bg-red-100 text-red-700 text-xs flex items-center justify-center font-semibold">
                        {selectedMaster.variants.reduce((s, v) => s + (v.validationIssues?.length ?? 0), 0)}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Variantes tab */}
                <TabsContent value="variants" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
                  {selectedMaster.variants.map((variant) => {
                    const isExpanded = expandedVariants.has(variant.variantId);
                    const isLoadingMats = loadingMaterialsFor.has(variant.variantId);
                    const { Icon: SIcon, badgeClass, iconClass, label: sLabel } = getStatusMeta(variant.status);
                    const errCount = variant.validationIssues?.filter((i) => i.severity === 'error').length ?? 0;
                    const warnCount = variant.validationIssues?.filter((i) => i.severity === 'warning').length ?? 0;
                    const matCount = variant.materials.length || variant.materialCount || 0;

                    return (
                      <div
                        key={variant.variantId}
                        className={cn(
                          'border rounded-xl bg-white overflow-hidden',
                          errCount > 0 && variant.isQuoteBuilderVariant
                            ? 'border-l-4 border-l-red-500'
                            : warnCount > 0
                              ? 'border-l-4 border-l-yellow-400'
                              : variant.isQuoteBuilderVariant
                                ? 'border-l-4 border-l-blue-400'
                                : 'border-gray-200'
                        )}
                      >
                        <div className="p-3">
                          {/* Variant header row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-sm text-gray-900">
                                  {variant.recipeCode}
                                </span>
                                <Badge className={cn('text-xs', badgeClass)}>
                                  <SIcon className="w-3 h-3 mr-1" />{sLabel}
                                </Badge>
                                {variant.isQuoteBuilderVariant && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200 cursor-help">
                                          <CheckCircle2 className="w-3 h-3 mr-1" />QB
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs text-xs">Variante activa en QuoteBuilder</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {errCount > 0 && (
                                  <Badge className="text-xs bg-red-100 text-red-800 border-red-200">
                                    <XCircle className="w-3 h-3 mr-1" />{errCount} error{errCount !== 1 ? 'es' : ''}
                                  </Badge>
                                )}
                                {warnCount > 0 && (
                                  <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                                    <AlertTriangle className="w-3 h-3 mr-1" />{warnCount} advertencia{warnCount !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                              {variant.latestVersion && (
                                <div className="text-xs text-gray-500 mt-1">
                                  v{variant.latestVersion.versionNumber} ·{' '}
                                  {format(new Date(variant.latestVersion.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                  {matCount > 0 && ` · ${matCount} material${matCount !== 1 ? 'es' : ''}`}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => setEditingVariant(variant)}
                              >
                                <Edit2 className="w-3 h-3" />Editar
                              </Button>
                              {matCount > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => toggleVariantExpansion(variant)}
                                  aria-label={isExpanded ? 'Ocultar materiales' : 'Ver materiales'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Materials (expanded) */}
                          {isExpanded && (
                            <div className="mt-2 border-t pt-2">
                              {isLoadingMats ? (
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />Cargando materiales…
                                </p>
                              ) : variant.materials.length === 0 ? (
                                <p className="text-xs text-gray-400">Sin materiales definidos.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b text-gray-500">
                                      <th className="text-left py-1 font-medium">Material</th>
                                      <th className="text-left py-1 font-medium">Código</th>
                                      <th className="text-right py-1 font-medium">Cant.</th>
                                      <th className="text-left py-1 font-medium pl-2">Ud.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {variant.materials.map((mat, idx) => (
                                      <tr key={mat.id ?? idx} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="py-1">{mat.material?.material_name ?? mat.material_type}</td>
                                        <td className="py-1 text-gray-500">{mat.material?.material_code ?? '—'}</td>
                                        <td className="py-1 text-right font-mono">{mat.quantity.toFixed(2)}</td>
                                        <td className="py-1 text-gray-500 pl-2">{mat.unit}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                {/* Validaciones tab */}
                <TabsContent value="validaciones" className="flex-1 overflow-y-auto p-3 space-y-3 mt-0">
                  {selectedMaster.variants.every((v) => !(v.validationIssues?.length)) ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl p-4 border border-green-200">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Sin problemas de validación en este maestro.
                    </div>
                  ) : (
                    selectedMaster.variants
                      .filter((v) => v.validationIssues?.length)
                      .map((variant) => (
                        <div key={variant.variantId} className="border rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-gray-50 border-b flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-gray-800">{variant.recipeCode}</span>
                            {variant.isQuoteBuilderVariant && (
                              <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">QB</Badge>
                            )}
                          </div>
                          <div className="p-3 space-y-2">
                            {variant.validationIssues!.map((issue, idx) => {
                              const meta = ISSUE_TYPE_META[issue.type];
                              const IssueIcon = meta?.Icon ?? AlertCircle;
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    'flex items-start gap-2 p-2 rounded-lg text-xs',
                                    issue.severity === 'error'
                                      ? 'bg-red-50 text-red-800'
                                      : 'bg-yellow-50 text-yellow-800'
                                  )}
                                >
                                  <IssueIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-medium">{meta?.label ?? issue.type}</span>
                                    <span className="mx-1">—</span>
                                    <span>{issue.message}</span>
                                    {issue.details && (
                                      <div className="opacity-80 mt-0.5">{issue.details}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* MaterialQuantityEditor — top-level Dialog (not nested in collapsible) */}
      <Dialog open={editingVariant !== null} onOpenChange={(open) => { if (!open) setEditingVariant(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar materiales — {editingVariant?.recipeCode}</DialogTitle>
          </DialogHeader>
          {editingVariant && (
            <MaterialQuantityEditor
              variantId={editingVariant.variantId}
              materials={editingVariant.materials}
              availableMaterials={availableMaterials}
              latestVersionId={editingVariant.latestVersion?.id ?? ''}
              onSave={(mats) => handleMaterialSave(editingVariant.variantId, mats)}
              onCancel={() => setEditingVariant(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
