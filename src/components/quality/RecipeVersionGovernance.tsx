'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Search, CheckCircle2, AlertCircle, XCircle, AlertTriangle, Edit2, Save, X, Plus, Trash2, Loader2, Info, ShieldAlert, Filter, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { recipeGovernanceService, type MasterGovernanceData, type VariantVersionStatus, type AvailableMaterial, type MaterialQuantityWithDetails, type MaterialValidationIssue } from '@/lib/services/recipeGovernanceService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MaterialQuantityEditor from './MaterialQuantityEditor';

interface RecipeVersionGovernanceProps {
  plantId: string;
}

export default function RecipeVersionGovernance({ plantId }: RecipeVersionGovernanceProps) {
  const [masters, setMasters] = useState<MasterGovernanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
  const [availableMaterials, setAvailableMaterials] = useState<AvailableMaterial[]>([]);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const hasAutoExpandedRef = useRef(false);
  
  // Filter state
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [issueTypeFilters, setIssueTypeFilters] = useState<Set<MaterialValidationIssue['type']>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<VariantVersionStatus['status']>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    hasAutoExpandedRef.current = false; // Reset auto-expand flag
    try {
      const [governanceData, materials] = await Promise.all([
        recipeGovernanceService.getMasterGovernanceData(plantId),
        recipeGovernanceService.getAvailableMaterials(plantId),
      ]);
      setMasters(governanceData);
      setAvailableMaterials(materials);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [plantId]);

  // Auto-expand QuoteBuilder variants with errors/warnings and masters with critical issues
  useEffect(() => {
    if (masters.length > 0 && !hasAutoExpandedRef.current) {
      const newExpandedVariants = new Set<string>();
      const newExpandedMasters = new Set<string>();
      
      masters.forEach(master => {
        // Expand masters with critical issues
        const hasCriticalIssues = master.variants.some(v => 
          v.isQuoteBuilderVariant && (v.validationIssues?.filter(i => i.severity === 'error').length || 0) > 0
        );
        
        if (hasCriticalIssues) {
          newExpandedMasters.add(master.masterId);
        }
        
        // Expand QuoteBuilder variants with errors or warnings
        master.variants.forEach(variant => {
          if (variant.isQuoteBuilderVariant) {
            const hasErrors = (variant.validationIssues?.filter(i => i.severity === 'error').length || 0) > 0;
            const hasWarnings = (variant.validationIssues?.filter(i => i.severity === 'warning').length || 0) > 0;
            
            if (hasErrors || hasWarnings) {
              newExpandedVariants.add(variant.variantId);
            }
          }
        });
      });
      
      if (newExpandedMasters.size > 0) {
        setExpandedMasters(newExpandedMasters);
      }
      if (newExpandedVariants.size > 0) {
        setExpandedVariants(newExpandedVariants);
      }
      hasAutoExpandedRef.current = true;
    }
  }, [masters]);

  const toggleMasterExpansion = (masterId: string) => {
    const newExpanded = new Set(expandedMasters);
    if (newExpanded.has(masterId)) {
      newExpanded.delete(masterId);
    } else {
      newExpanded.add(masterId);
    }
    setExpandedMasters(newExpanded);
  };

  const toggleVariantExpansion = (variantId: string) => {
    const newExpanded = new Set(expandedVariants);
    if (newExpanded.has(variantId)) {
      newExpanded.delete(variantId);
    } else {
      newExpanded.add(variantId);
    }
    setExpandedVariants(newExpanded);
  };

  const handleMaterialSave = async (variantId: string, materials: MaterialQuantityWithDetails[]) => {
    try {
      // Convert to MaterialQuantity format for the service
      const materialQuantities = materials.map(m => ({
        recipe_version_id: m.recipe_version_id,
        material_type: m.material_type,
        material_id: m.material_id,
        quantity: m.quantity,
        unit: m.unit,
      }));

      await recipeGovernanceService.updateVariantMaterials(
        variantId,
        materialQuantities,
        'Actualización desde Gobernanza de Versiones'
      );

      toast.success('Materiales actualizados correctamente. Nueva versión creada.');
      setEditingVariantId(null);
      await loadData(); // Refresh data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar materiales';
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleMaterialCancel = () => {
    setEditingVariantId(null);
  };

  // Filter and sort masters/variants by priority (errors first, then warnings)
  const filteredMasters = useMemo(() => {
    let filtered = masters;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered
        .map(master => {
          const filteredVariants = master.variants.filter(variant =>
            variant.recipeCode.toLowerCase().includes(searchLower) ||
            master.masterCode.toLowerCase().includes(searchLower)
          );

          if (filteredVariants.length === 0 && !master.masterCode.toLowerCase().includes(searchLower)) {
            return null;
          }

          return {
            ...master,
            variants: filteredVariants,
          };
        })
        .filter((m): m is MasterGovernanceData => m !== null);
    }

    // Apply validation filters
    const hasActiveFilters = severityFilter !== 'all' || issueTypeFilters.size > 0 || statusFilter.size > 0;
    
    if (hasActiveFilters) {
      filtered = filtered
        .map(master => {
          const filteredVariants = master.variants.filter(variant => {
            // Status filter
            if (statusFilter.size > 0 && !statusFilter.has(variant.status)) {
              return false;
            }

            // Validation issues filter
            if (variant.validationIssues && variant.validationIssues.length > 0) {
              // Severity filter
              if (severityFilter !== 'all') {
                const hasMatchingSeverity = variant.validationIssues.some(
                  issue => issue.severity === severityFilter
                );
                if (!hasMatchingSeverity) {
                  return false;
                }
              }

              // Issue type filter
              if (issueTypeFilters.size > 0) {
                const hasMatchingType = variant.validationIssues.some(
                  issue => issueTypeFilters.has(issue.type)
                );
                if (!hasMatchingType) {
                  return false;
                }
              }
            } else {
              // If no validation issues but filters require them, exclude
              if (severityFilter !== 'all' || issueTypeFilters.size > 0) {
                return false;
              }
            }

            return true;
          });

          if (filteredVariants.length === 0) {
            return null;
          }

          return {
            ...master,
            variants: filteredVariants,
          };
        })
        .filter((m): m is MasterGovernanceData => m !== null);
    }

    // Sort by priority: masters with errors first, then warnings, then healthy
    filtered = filtered
      .map(master => ({
        ...master,
        variants: [...master.variants].sort((a, b) => {
          // Priority: QuoteBuilder variants with errors > QuoteBuilder variants with warnings > Other variants with errors > Other variants with warnings > Healthy
          const aErrors = a.validationIssues?.filter(i => i.severity === 'error').length || 0;
          const bErrors = b.validationIssues?.filter(i => i.severity === 'error').length || 0;
          const aWarnings = a.validationIssues?.filter(i => i.severity === 'warning').length || 0;
          const bWarnings = b.validationIssues?.filter(i => i.severity === 'warning').length || 0;
          
          // QuoteBuilder variants with errors get highest priority
          if (a.isQuoteBuilderVariant && aErrors > 0 && !(b.isQuoteBuilderVariant && bErrors > 0)) return -1;
          if (b.isQuoteBuilderVariant && bErrors > 0 && !(a.isQuoteBuilderVariant && aErrors > 0)) return 1;
          
          // Then errors
          if (aErrors !== bErrors) return bErrors - aErrors;
          
          // Then QuoteBuilder variants with warnings
          if (a.isQuoteBuilderVariant && aWarnings > 0 && !(b.isQuoteBuilderVariant && bWarnings > 0)) return -1;
          if (b.isQuoteBuilderVariant && bWarnings > 0 && !(a.isQuoteBuilderVariant && aWarnings > 0)) return 1;
          
          // Then warnings
          if (aWarnings !== bWarnings) return bWarnings - aWarnings;
          
          // Then QuoteBuilder variants
          if (a.isQuoteBuilderVariant !== b.isQuoteBuilderVariant) return a.isQuoteBuilderVariant ? -1 : 1;
          
          return 0;
        }),
      }))
      .sort((a, b) => {
        // Sort masters by their highest priority variant
        const aMaxErrors = Math.max(...a.variants.map(v => v.validationIssues?.filter(i => i.severity === 'error').length || 0));
        const bMaxErrors = Math.max(...b.variants.map(v => v.validationIssues?.filter(i => i.severity === 'error').length || 0));
        const aMaxWarnings = Math.max(...a.variants.map(v => v.validationIssues?.filter(i => i.severity === 'warning').length || 0));
        const bMaxWarnings = Math.max(...b.variants.map(v => v.validationIssues?.filter(i => i.severity === 'warning').length || 0));
        const aHasQBError = a.variants.some(v => v.isQuoteBuilderVariant && (v.validationIssues?.filter(i => i.severity === 'error').length || 0) > 0);
        const bHasQBError = b.variants.some(v => v.isQuoteBuilderVariant && (v.validationIssues?.filter(i => i.severity === 'error').length || 0) > 0);
        
        if (aHasQBError !== bHasQBError) return aHasQBError ? -1 : 1;
        if (aMaxErrors !== bMaxErrors) return bMaxErrors - aMaxErrors;
        if (aMaxWarnings !== bMaxWarnings) return bMaxWarnings - aMaxWarnings;
        return 0;
      });

    return filtered;
  }, [masters, searchTerm, severityFilter, issueTypeFilters, statusFilter]);

  // Calculate overall summary statistics
  const overallSummary = useMemo(() => {
    let totalValidationErrors = 0;
    let totalValidationWarnings = 0;
    
    masters.forEach(master => {
      master.variants.forEach(variant => {
        if (variant.validationIssues) {
          variant.validationIssues.forEach(issue => {
            // Only count errors from QuoteBuilder variants (since errors only exist for QB variants)
            if (issue.severity === 'error') {
              // Errors should only exist for QuoteBuilder variants, but double-check
              if (variant.isQuoteBuilderVariant) {
                totalValidationErrors++;
              }
            } else if (issue.severity === 'warning') {
              totalValidationWarnings++;
            }
          });
        }
      });
    });

    return {
      ...masters.reduce(
        (acc, master) => ({
          totalMasters: acc.totalMasters + 1,
          totalVariants: acc.totalVariants + master.summary.totalVariants,
          upToDateCount: acc.upToDateCount + master.summary.upToDateCount,
          outdatedCount: acc.outdatedCount + master.summary.outdatedCount,
          noVersionCount: acc.noVersionCount + master.summary.noVersionCount,
        }),
        {
          totalMasters: 0,
          totalVariants: 0,
          upToDateCount: 0,
          outdatedCount: 0,
          noVersionCount: 0,
        }
      ),
      validationErrors: totalValidationErrors,
      validationWarnings: totalValidationWarnings,
    };
  }, [masters]);

  // Get critical issues for quick access dashboard
  const criticalIssues = useMemo(() => {
    const issues: Array<{
      masterId: string;
      masterCode: string;
      variantId: string;
      variantCode: string;
      isQuoteBuilderVariant: boolean;
      errors: MaterialValidationIssue[];
      warnings: MaterialValidationIssue[];
    }> = [];
    
    masters.forEach(master => {
      master.variants.forEach(variant => {
        if (variant.validationIssues && variant.validationIssues.length > 0) {
          const errors = variant.validationIssues.filter(i => i.severity === 'error');
          const warnings = variant.validationIssues.filter(i => i.severity === 'warning');
          
          // Only show critical issues (errors in QB variants, or any issues in QB variants)
          if (variant.isQuoteBuilderVariant && (errors.length > 0 || warnings.length > 0)) {
            issues.push({
              masterId: master.masterId,
              masterCode: master.masterCode,
              variantId: variant.variantId,
              variantCode: variant.recipeCode,
              isQuoteBuilderVariant: variant.isQuoteBuilderVariant,
              errors,
              warnings,
            });
          }
        }
      });
    });
    
    // Sort by errors first, then warnings
    return issues.sort((a, b) => {
      if (a.errors.length !== b.errors.length) return b.errors.length - a.errors.length;
      return b.warnings.length - a.warnings.length;
    });
  }, [masters]);

  const getStatusBadge = (status: VariantVersionStatus['status']) => {
    switch (status) {
      case 'up-to-date':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Actualizado
          </Badge>
        );
      case 'outdated':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Desactualizado
          </Badge>
        );
      case 'no-version':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Sin Versión
          </Badge>
        );
      case 'inconsistent':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Inconsistente
          </Badge>
        );
      default:
        return null;
    }
  };

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
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-800">Error al cargar datos</h3>
              <p className="text-red-600 mt-1">{error}</p>
              <Button onClick={loadData} variant="outline" className="mt-4" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Critical Issues Dashboard */}
      {criticalIssues.length > 0 && (
        <Card className="border-red-300 bg-gradient-to-r from-red-50 to-orange-50 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-600" />
                <CardTitle className="text-xl text-red-900">Problemas Críticos Requieren Atención</CardTitle>
              </div>
              <Badge className="bg-red-600 text-white text-lg px-3 py-1">
                {criticalIssues.length} {criticalIssues.length === 1 ? 'variante' : 'variantes'}
              </Badge>
            </div>
            <p className="text-sm text-red-700 mt-2">
              Estas variantes se usan en QuoteBuilder y tienen problemas que afectan las cotizaciones
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {criticalIssues.slice(0, 6).map((issue) => (
                <Card 
                  key={issue.variantId} 
                  className="border-red-200 bg-white hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setExpandedMasters(new Set([issue.masterId]));
                    setExpandedVariants(new Set([issue.variantId]));
                    // Scroll to the master after a brief delay
                    setTimeout(() => {
                      const element = document.getElementById(`master-${issue.masterId}`);
                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{issue.masterCode}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{issue.variantCode}</div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">QB</Badge>
                    </div>
                    <div className="space-y-1 mt-2">
                      {issue.errors.length > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <XCircle className="w-3 h-3 text-red-600" />
                          <span className="text-red-700 font-medium">{issue.errors.length} error{issue.errors.length !== 1 ? 'es' : ''}</span>
                        </div>
                      )}
                      {issue.warnings.length > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <AlertTriangle className="w-3 h-3 text-yellow-600" />
                          <span className="text-yellow-700">{issue.warnings.length} advertencia{issue.warnings.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {criticalIssues.length > 6 && (
              <div className="mt-4 text-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSeverityFilter('error');
                    setFiltersExpanded(true);
                  }}
                >
                  Ver todos los {criticalIssues.length} problemas críticos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Maestros</div>
            <div className="text-2xl font-bold text-gray-900">{overallSummary.totalMasters}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Variantes</div>
            <div className="text-2xl font-bold text-gray-900">{overallSummary.totalVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-green-600">Actualizadas</div>
            <div className="text-2xl font-bold text-green-700">{overallSummary.upToDateCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-yellow-600">Desactualizadas</div>
            <div className="text-2xl font-bold text-yellow-700">{overallSummary.outdatedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-red-600">Sin Versión</div>
            <div className="text-2xl font-bold text-red-700">{overallSummary.noVersionCount}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-sm text-red-600 flex items-center gap-1 cursor-help">
                    <ShieldAlert className="w-4 h-4" />
                    Errores Validación
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Errores críticos en variantes usadas por QuoteBuilder. 
                    Solo las variantes activas en QuoteBuilder pueden tener errores.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="text-2xl font-bold text-red-700">{overallSummary.validationErrors}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-sm text-yellow-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Advertencias
            </div>
            <div className="text-2xl font-bold text-yellow-700">{overallSummary.validationWarnings}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por código de maestro o variante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>

            {/* Filters Section */}
            <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full sm:w-auto justify-start">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros de Validación
                  <ChevronRight className={`w-4 h-4 ml-2 transition-transform ${filtersExpanded ? 'rotate-90' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                  {/* Severity Filter */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Severidad</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Los errores solo se aplican a variantes usadas por QuoteBuilder
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="severity-all"
                          checked={severityFilter === 'all'}
                          onCheckedChange={(checked) => checked && setSeverityFilter('all')}
                        />
                        <label htmlFor="severity-all" className="text-sm cursor-pointer">
                          Todas
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="severity-error"
                          checked={severityFilter === 'error'}
                          onCheckedChange={(checked) => checked && setSeverityFilter('error')}
                        />
                        <label htmlFor="severity-error" className="text-sm cursor-pointer flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-600" />
                          Solo Errores
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="severity-warning"
                          checked={severityFilter === 'warning'}
                          onCheckedChange={(checked) => checked && setSeverityFilter('warning')}
                        />
                        <label htmlFor="severity-warning" className="text-sm cursor-pointer flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-yellow-600" />
                          Solo Advertencias
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Issue Type Filter */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Tipo de Problema</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {[
                        { type: 'missing_cement' as const, label: 'Falta Cemento', icon: '🚫' },
                        { type: 'missing_water' as const, label: 'Falta Agua', icon: '🚫' },
                        { type: 'low_cement' as const, label: 'Cemento Bajo', icon: '⚠️' },
                        { type: 'too_few_materials' as const, label: 'Pocos Materiales', icon: '⚠️' },
                        { type: 'low_quantities' as const, label: 'Cantidades Bajas', icon: '⚠️' },
                        { type: 'invalid_quantities' as const, label: 'Cantidades Inválidas', icon: '❌' },
                      ].map(({ type, label, icon }) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`issue-${type}`}
                            checked={issueTypeFilters.has(type)}
                            onCheckedChange={(checked) => {
                              const newFilters = new Set(issueTypeFilters);
                              if (checked) {
                                newFilters.add(type);
                              } else {
                                newFilters.delete(type);
                              }
                              setIssueTypeFilters(newFilters);
                            }}
                          />
                          <label htmlFor={`issue-${type}`} className="text-sm cursor-pointer flex items-center gap-1">
                            <span>{icon}</span>
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Estado de Versión</h4>
                    <div className="space-y-2">
                      {[
                        { status: 'up-to-date' as const, label: 'Actualizadas', color: 'green' },
                        { status: 'outdated' as const, label: 'Desactualizadas', color: 'yellow' },
                        { status: 'no-version' as const, label: 'Sin Versión', color: 'red' },
                        { status: 'inconsistent' as const, label: 'Inconsistentes', color: 'orange' },
                      ].map(({ status, label, color }) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={statusFilter.has(status)}
                            onCheckedChange={(checked) => {
                              const newFilters = new Set(statusFilter);
                              if (checked) {
                                newFilters.add(status);
                              } else {
                                newFilters.delete(status);
                              }
                              setStatusFilter(newFilters);
                            }}
                          />
                          <label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {(severityFilter !== 'all' || issueTypeFilters.size > 0 || statusFilter.size > 0) && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                    <span className="text-xs text-gray-500">Filtros activos:</span>
                    {severityFilter !== 'all' && (
                      <Badge variant="outline" className="text-xs">
                        Severidad: {severityFilter === 'error' ? 'Errores' : 'Advertencias'}
                        <X
                          className="w-3 h-3 ml-1 cursor-pointer"
                          onClick={() => setSeverityFilter('all')}
                        />
                      </Badge>
                    )}
                    {Array.from(issueTypeFilters).map(type => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type === 'missing_cement' ? 'Falta Cemento' :
                         type === 'missing_water' ? 'Falta Agua' :
                         type === 'low_cement' ? 'Cemento Bajo' :
                         type === 'too_few_materials' ? 'Pocos Materiales' :
                         type === 'low_quantities' ? 'Cantidades Bajas' :
                         'Cantidades Inválidas'}
                        <X
                          className="w-3 h-3 ml-1 cursor-pointer"
                          onClick={() => {
                            const newFilters = new Set(issueTypeFilters);
                            newFilters.delete(type);
                            setIssueTypeFilters(newFilters);
                          }}
                        />
                      </Badge>
                    ))}
                    {Array.from(statusFilter).map(status => (
                      <Badge key={status} variant="outline" className="text-xs">
                        {status === 'up-to-date' ? 'Actualizadas' :
                         status === 'outdated' ? 'Desactualizadas' :
                         status === 'no-version' ? 'Sin Versión' :
                         'Inconsistentes'}
                        <X
                          className="w-3 h-3 ml-1 cursor-pointer"
                          onClick={() => {
                            const newFilters = new Set(statusFilter);
                            newFilters.delete(status);
                            setStatusFilter(newFilters);
                          }}
                        />
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        setSeverityFilter('all');
                        setIssueTypeFilters(new Set());
                        setStatusFilter(new Set());
                      }}
                    >
                      Limpiar todo
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {(searchTerm || severityFilter !== 'all' || issueTypeFilters.size > 0 || statusFilter.size > 0) && filteredMasters.length > 0 && (
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <span>
            Mostrando {filteredMasters.length} maestro{filteredMasters.length !== 1 ? 's' : ''} 
            {' '}con {filteredMasters.reduce((sum, m) => sum + m.variants.length, 0)} variante{filteredMasters.reduce((sum, m) => sum + m.variants.length, 0) !== 1 ? 's' : ''}
          </span>
          {(severityFilter !== 'all' || issueTypeFilters.size > 0 || statusFilter.size > 0) && (
            <Badge variant="outline" className="text-xs">
              Filtrado activo
            </Badge>
          )}
        </div>
      )}

      {/* Masters List */}
      {filteredMasters.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">
              {searchTerm || severityFilter !== 'all' || issueTypeFilters.size > 0 || statusFilter.size > 0
                ? 'No se encontraron resultados que coincidan con los filtros aplicados.'
                : 'No hay maestros disponibles.'}
            </p>
            {(searchTerm || severityFilter !== 'all' || issueTypeFilters.size > 0 || statusFilter.size > 0) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchTerm('');
                  setSeverityFilter('all');
                  setIssueTypeFilters(new Set());
                  setStatusFilter(new Set());
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMasters.map((master) => {
            const isExpanded = expandedMasters.has(master.masterId);
            const hasCriticalIssues = master.variants.some(v => 
              v.isQuoteBuilderVariant && (v.validationIssues?.filter(i => i.severity === 'error').length || 0) > 0
            );
            return (
              <Card 
                key={master.masterId} 
                id={`master-${master.masterId}`}
                className={`overflow-hidden transition-all ${
                  hasCriticalIssues 
                    ? 'border-l-4 border-l-red-500 shadow-md' 
                    : 'border-l-4 border-l-gray-200'
                }`}
              >
                <button
                  onClick={() => toggleMasterExpansion(master.masterId)}
                  className="w-full"
                >
                  <CardHeader className="hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                          <span className="font-bold text-lg">{master.strengthFc}</span>
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">{master.masterCode}</CardTitle>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {master.placementType === 'D' ? 'Directa' : 'Bombeado'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Revenimiento: {master.slump} cm
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              TMA: {master.maxAggregateSize} mm
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm text-gray-600">
                          <div>
                            {master.variants.length} variante{master.variants.length !== 1 ? 's' : ''}
                            {master.variants.length !== master.summary.totalVariants && (
                              <span className="text-gray-400 ml-1" title={`${master.summary.totalVariants} variantes totales, ${master.summary.totalVariants - master.variants.length} ocultas por filtros`}>
                                (de {master.summary.totalVariants})
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap justify-end">
                            <span className="text-green-600">{master.summary.upToDateCount} ✓</span>
                            <span className="text-yellow-600">{master.summary.outdatedCount} ⚠</span>
                            <span className="text-red-600">{master.summary.noVersionCount} ✗</span>
                            {master.summary.validationErrors > 0 && (
                              <span className="text-red-600 font-semibold" title="Errores de validación">
                                {master.summary.validationErrors} 🚫
                              </span>
                            )}
                            {master.summary.validationWarnings > 0 && (
                              <span className="text-yellow-600 font-semibold" title="Advertencias de validación">
                                {master.summary.validationWarnings} ⚠️
                              </span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-3 mt-4">
                      {master.variants.length === 0 ? (
                        <div className="text-sm text-center py-4">
                          <p className="text-gray-500">
                            {master.summary.totalVariants > 0 
                              ? `${master.summary.totalVariants} variante${master.summary.totalVariants !== 1 ? 's' : ''} oculta${master.summary.totalVariants !== 1 ? 's' : ''} por los filtros activos.`
                              : 'No hay variantes para este maestro.'
                            }
                          </p>
                          {master.summary.totalVariants > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSeverityFilter('all');
                                setIssueTypeFilters(new Set());
                                setStatusFilter(new Set());
                              }}
                            >
                              Limpiar filtros
                            </Button>
                          )}
                        </div>
                      ) : (
                        master.variants.map((variant) => {
                          const isVariantExpanded = expandedVariants.has(variant.variantId);
                          const isEditing = editingVariantId === variant.variantId;

                          const hasValidationErrors = variant.validationIssues?.some(i => i.severity === 'error') || false;
                          const hasValidationWarnings = variant.validationIssues?.some(i => i.severity === 'warning') || false;
                          
                          return (
                            <Card 
                              key={variant.variantId} 
                              className={`border-l-4 ${
                                hasValidationErrors 
                                  ? 'border-l-red-500 bg-red-50/30' 
                                  : hasValidationWarnings 
                                    ? 'border-l-yellow-500 bg-yellow-50/30'
                                    : variant.isQuoteBuilderVariant
                                      ? 'border-l-blue-500'
                                      : 'border-l-gray-300'
                              }`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                      <h4 className="font-semibold text-gray-900">{variant.recipeCode}</h4>
                                      {getStatusBadge(variant.status)}
                                      {variant.validationIssues && variant.validationIssues.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {variant.validationIssues.filter(i => i.severity === 'error').length > 0 && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Badge className="bg-red-100 text-red-800 border-red-200 cursor-help">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    {variant.validationIssues.filter(i => i.severity === 'error').length} error{variant.validationIssues.filter(i => i.severity === 'error').length !== 1 ? 'es' : ''}
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className="max-w-xs">
                                                    {variant.isQuoteBuilderVariant
                                                      ? 'Errores críticos que afectan las cotizaciones. Esta variante se usa en QuoteBuilder.'
                                                      : 'Estos problemas se muestran como errores porque afectarían las cotizaciones si esta variante fuera usada por QuoteBuilder.'}
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                          {variant.validationIssues.filter(i => i.severity === 'warning').length > 0 && (
                                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                              <AlertTriangle className="w-3 h-3 mr-1" />
                                              {variant.validationIssues.filter(i => i.severity === 'warning').length} advertencia{variant.validationIssues.filter(i => i.severity === 'warning').length !== 1 ? 's' : ''}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {variant.latestVersion && (
                                      <div className="text-sm text-gray-600 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>Versión {variant.latestVersion.versionNumber}</span>
                                          <span className="mx-1">•</span>
                                          <span>
                                            {format(new Date(variant.latestVersion.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                          </span>
                                          {variant.materials.length > 0 && (
                                            <>
                                              <span className="mx-1">•</span>
                                              <span className="text-blue-600 font-medium">
                                                {variant.materials.length} material{variant.materials.length !== 1 ? 'es' : ''}
                                              </span>
                                            </>
                                          )}
                                          {variant.validationIssues && variant.validationIssues.length > 0 && (
                                            <>
                                              <span className="mx-1">•</span>
                                              {variant.validationIssues.some(i => i.severity === 'error') ? (
                                                <span className="text-red-600 font-semibold flex items-center gap-1">
                                                  <XCircle className="w-3 h-3" />
                                                  {variant.validationIssues.filter(i => i.severity === 'error').length} error{variant.validationIssues.filter(i => i.severity === 'error').length !== 1 ? 'es' : ''}
                                                </span>
                                              ) : (
                                                <span className="text-yellow-600 font-semibold flex items-center gap-1">
                                                  <AlertTriangle className="w-3 h-3" />
                                                  {variant.validationIssues.filter(i => i.severity === 'warning').length} advertencia{variant.validationIssues.filter(i => i.severity === 'warning').length !== 1 ? 's' : ''}
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {variant.isQuoteBuilderVariant && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs cursor-help">
                                                    ✓ Usado por QuoteBuilder
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className="max-w-xs">
                                                    Esta variante tiene la versión más reciente de todas las variantes del maestro. 
                                                    El QuoteBuilder usa los materiales de esta variante para calcular precios.
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                          {!variant.isQuoteBuilderVariant && variant.latestVersion && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs cursor-help">
                                                    No usado por QuoteBuilder
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className="max-w-xs">
                                                    El QuoteBuilder usa otra variante de este maestro con versión más reciente.
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                          {!variant.latestVersion.isCurrent && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs cursor-help">
                                                    ⚠ No marcado como actual
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className="max-w-xs">
                                                    Esta versión es la más reciente pero no está marcada como actual. 
                                                    El flag is_current está desactualizado.
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!isEditing && (
                                      <Button
                                        onClick={() => setEditingVariantId(variant.variantId)}
                                        variant="outline"
                                        size="sm"
                                      >
                                        <Edit2 className="w-4 h-4 mr-1" />
                                        Editar Materiales
                                      </Button>
                                    )}
                                    <Button
                                      onClick={() => toggleVariantExpansion(variant.variantId)}
                                      variant="ghost"
                                      size="sm"
                                    >
                                      {isVariantExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {/* Validation Issues Display */}
                                {variant.validationIssues && variant.validationIssues.length > 0 && (
                                  <div className={`mt-3 p-3 rounded-lg border ${
                                    variant.validationIssues.some(i => i.severity === 'error')
                                      ? 'bg-red-50 border-red-200'
                                      : 'bg-yellow-50 border-yellow-200'
                                  }`}>
                                    <div className="flex items-start gap-2 mb-2">
                                      {variant.validationIssues.some(i => i.severity === 'error') ? (
                                        <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
                                      ) : (
                                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                      )}
                                      <div className="flex-1">
                                        <h5 className={`font-semibold text-sm ${
                                          variant.validationIssues.some(i => i.severity === 'error')
                                            ? 'text-red-900'
                                            : 'text-yellow-900'
                                        }`}>
                                          Problemas de Validación
                                        </h5>
                                        <div className="mt-2 space-y-1.5">
                                          {variant.validationIssues.map((issue, idx) => (
                                            <div key={idx} className="text-sm">
                                              <div className={`flex items-start gap-2 ${
                                                issue.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
                                              }`}>
                                                <span className="mt-0.5">
                                                  {issue.severity === 'error' ? '❌' : '⚠️'}
                                                </span>
                                                <div className="flex-1">
                                                  <span className="font-medium">{issue.message}</span>
                                                  {issue.details && (
                                                    <div className="text-xs mt-0.5 opacity-80">
                                                      {issue.details}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Always show materials count and QuoteBuilder variant materials */}
                                {variant.isQuoteBuilderVariant && variant.materials.length > 0 && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-semibold text-blue-900">
                                        Materiales usados por QuoteBuilder ({variant.materials.length})
                                      </span>
                                      {!isEditing && (
                                        <Button
                                          onClick={() => toggleVariantExpansion(variant.variantId)}
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs"
                                        >
                                          {isVariantExpanded ? 'Ocultar' : 'Ver'} detalles
                                        </Button>
                                      )}
                                    </div>
                                    {isVariantExpanded && (
                                      <div className="mt-2 overflow-x-auto">
                                        <table className="w-full text-sm bg-white rounded border">
                                          <thead>
                                            <tr className="border-b bg-gray-50">
                                              <th className="text-left p-2 font-medium text-gray-700">Material</th>
                                              <th className="text-left p-2 font-medium text-gray-700">Código</th>
                                              <th className="text-right p-2 font-medium text-gray-700">Cantidad</th>
                                              <th className="text-left p-2 font-medium text-gray-700">Unidad</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {variant.materials.map((material, idx) => (
                                              <tr key={material.id || idx} className="border-b hover:bg-gray-50">
                                                <td className="p-2">
                                                  {material.material?.material_name || material.material_type}
                                                </td>
                                                <td className="p-2 text-gray-600">
                                                  {material.material?.material_code || '-'}
                                                </td>
                                                <td className="p-2 text-right font-mono">
                                                  {material.quantity.toFixed(2)}
                                                </td>
                                                <td className="p-2 text-gray-600">{material.unit}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isEditing ? (
                                  <MaterialQuantityEditor
                                    variantId={variant.variantId}
                                    materials={variant.materials}
                                    availableMaterials={availableMaterials}
                                    latestVersionId={variant.latestVersion?.id || ''}
                                    onSave={(materials) => handleMaterialSave(variant.variantId, materials)}
                                    onCancel={handleMaterialCancel}
                                  />
                                ) : isVariantExpanded && !variant.isQuoteBuilderVariant && (
                                  <div className="mt-4">
                                    {variant.materials.length === 0 ? (
                                      <p className="text-sm text-gray-500">No hay materiales definidos para esta versión.</p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b">
                                              <th className="text-left p-2 font-medium text-gray-700">Material</th>
                                              <th className="text-left p-2 font-medium text-gray-700">Código</th>
                                              <th className="text-right p-2 font-medium text-gray-700">Cantidad</th>
                                              <th className="text-left p-2 font-medium text-gray-700">Unidad</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {variant.materials.map((material, idx) => (
                                              <tr key={material.id || idx} className="border-b hover:bg-gray-50">
                                                <td className="p-2">
                                                  {material.material?.material_name || material.material_type}
                                                </td>
                                                <td className="p-2 text-gray-600">
                                                  {material.material?.material_code || '-'}
                                                </td>
                                                <td className="p-2 text-right font-mono">
                                                  {material.quantity.toFixed(2)}
                                                </td>
                                                <td className="p-2 text-gray-600">{material.unit}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Show message if QuoteBuilder variant has no materials */}
                                {variant.isQuoteBuilderVariant && variant.materials.length === 0 && variant.latestVersion && (
                                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-sm text-yellow-800">
                                      ⚠ Esta variante es usada por QuoteBuilder pero no tiene materiales definidos.
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
