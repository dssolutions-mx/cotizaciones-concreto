'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Icons
import { 
  Search, 
  ChevronDown, 
  ChevronRight,
  X,
  Filter,
  Users,
  FileText,
  Building2,
  Package,
  BarChart3,
  RefreshCw,
  Calendar,
  MapPin,
  CheckCircle2,
  Circle,
  Minus
} from 'lucide-react';

// Services and Types
import { ReportDataService } from '@/services/reportDataService';
import type { 
  HierarchicalReportData,
  SelectableClient,
  SelectableOrder,
  SelectableRemision,
  SelectionSummary,
  ReportFilter
} from '@/types/pdf-reports';

interface EnhancedReportFiltersProps {
  onDataChange: (data: HierarchicalReportData, filters: ReportFilter) => void;
  onSelectionChange: (summary: SelectionSummary) => void;
  loading?: boolean;
}

export default function EnhancedReportFilters({ 
  onDataChange, 
  onSelectionChange, 
  loading = false 
}: EnhancedReportFiltersProps) {
  // State for date range
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [singleDateMode, setSingleDateMode] = useState<boolean>(false);

  // State for hierarchical data
  const [hierarchicalData, setHierarchicalData] = useState<HierarchicalReportData | null>(null);
  const [selectionSummary, setSelectionSummary] = useState<SelectionSummary>({
    totalClients: 0,
    totalOrders: 0,
    totalRemisiones: 0,
    totalVolume: 0,
    totalAmount: 0,
    selectedClients: [],
    selectedOrders: [],
    selectedRemisiones: []
  });

  // State for UI controls
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Enhanced Filters
  const [plantFilter, setPlantFilter] = useState<string[]>([]);
  const [recipeFilter, setRecipeFilter] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [siteFilter, setSiteFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load hierarchical data when date range changes
  const loadHierarchicalData = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoadingData(true);
    try {
      const data = await ReportDataService.fetchHierarchicalData(dateRange);
      setHierarchicalData(data);
      setSelectionSummary(data.selectionSummary);
      onDataChange(data, {
        dateRange,
        singleDateMode,
        clientIds: [],
        orderIds: [],
        remisionIds: []
      });
    } catch (error) {
      console.error('Error loading hierarchical data:', error);
      setHierarchicalData(null);
    } finally {
      setLoadingData(false);
    }
  }, [dateRange, singleDateMode, onDataChange]);

  // Effects
  useEffect(() => {
    loadHierarchicalData();
  }, [loadHierarchicalData]);

  // Get available options for filters
  const availableRecipes = useMemo(() => {
    if (!hierarchicalData) return [];
    const recipes = new Set<string>();
    hierarchicalData.clients.forEach(client => {
      client.orders.forEach(order => {
        order.remisiones.forEach(remision => {
          if (remision.recipe_code) {
            recipes.add(remision.recipe_code);
          }
        });
      });
    });
    return Array.from(recipes).sort();
  }, [hierarchicalData]);

  const availableSites = useMemo(() => {
    if (!hierarchicalData) return [];
    const sites = new Set<string>();
    hierarchicalData.clients.forEach(client => {
      client.orders.forEach(order => {
        sites.add(order.construction_site);
      });
    });
    return Array.from(sites).sort();
  }, [hierarchicalData]);

  const availableClients = useMemo(() => {
    if (!hierarchicalData) return [] as { id: string; name: string }[];
    return hierarchicalData.clients.map(c => ({ id: c.id, name: c.business_name }));
  }, [hierarchicalData]);

  const availablePlants = useMemo(() => {
    if (!hierarchicalData) return [] as { id: string; name: string; code: string }[];
    const plants = new Set<string>();
    const plantMap = new Map<string, { id: string; name: string; code: string }>();
    
    hierarchicalData.clients.forEach(client => {
      client.orders.forEach(order => {
        order.remisiones.forEach(remision => {
          if (remision.plant_info) {
            const plantKey = remision.plant_info.plant_id;
            if (!plants.has(plantKey)) {
              plants.add(plantKey);
              plantMap.set(plantKey, {
                id: remision.plant_info.plant_id,
                name: remision.plant_info.plant_name,
                code: remision.plant_info.plant_code
              });
            }
          }
        });
      });
    });
    
    return Array.from(plantMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [hierarchicalData]);

  // Check if remision matches current filters
  const remisionMatchesFilters = useCallback((remision: SelectableRemision) => {
    if (recipeFilter.length > 0 && (!remision.recipe_code || !recipeFilter.includes(remision.recipe_code))) {
      return false;
    }
    if (plantFilter.length > 0 && (!remision.plant_info || !plantFilter.includes(remision.plant_info.plant_id))) {
      return false;
    }
    return true;
  }, [recipeFilter, plantFilter]);

  // Check if order matches current filters
  const orderMatchesFilters = useCallback((order: SelectableOrder) => {
    if (siteFilter.length > 0 && !siteFilter.includes(order.construction_site)) {
      return false;
    }
    return order.remisiones.some(remision => remisionMatchesFilters(remision));
  }, [siteFilter, remisionMatchesFilters]);

  // Enhanced filtered data
  const filteredData = useMemo(() => {
    if (!hierarchicalData) return null;

    let filteredClients = hierarchicalData.clients.map(client => ({ ...client }));

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredClients = filteredClients.filter(client => 
        client.business_name.toLowerCase().includes(search) ||
        client.client_code?.toLowerCase().includes(search) ||
        client.orders.some(order => 
          order.order_number.toLowerCase().includes(search) ||
          order.construction_site.toLowerCase().includes(search) ||
          order.remisiones.some(remision =>
            remision.remision_number.toLowerCase().includes(search) ||
            remision.recipe_code?.toLowerCase().includes(search) ||
            remision.conductor?.toLowerCase().includes(search)
          )
        )
      );
    }

    // Apply client filter at top level
    if (clientFilter.length > 0) {
      filteredClients = filteredClients
        .filter(client => clientFilter.includes(client.id))
        .map(client => ({
          ...client,
          // Auto-select clients that are in the filter
          selected: true,
          orders: client.orders.map(order => ({
            ...order,
            selected: true,
            remisiones: order.remisiones.map(remision => ({
              ...remision,
              selected: true
            }))
          }))
        }));
    }

    // Apply other filters - always run this to ensure proper filtering
    filteredClients = filteredClients.map(client => ({
      ...client,
      orders: client.orders.map(order => ({
        ...order,
        remisiones: order.remisiones.filter(remision => remisionMatchesFilters(remision))
      })).filter(order => orderMatchesFilters(order) && order.remisiones.length > 0)
    })).filter(client => client.orders.length > 0);

    return {
      ...hierarchicalData,
      clients: filteredClients
    };
  }, [hierarchicalData, searchTerm, remisionMatchesFilters, orderMatchesFilters, recipeFilter, siteFilter, clientFilter, plantFilter]);

  // Update selection summary when filtered data changes
  useEffect(() => {
    if (filteredData) {
      updateSelectionSummary(filteredData);
      onDataChange(filteredData, {
        dateRange: dateRange,
        clientIds: clientFilter,
        recipeCodes: recipeFilter,
        constructionSites: siteFilter,
        plantIds: plantFilter
      });
    }
  }, [filteredData, updateSelectionSummary, onDataChange, dateRange, clientFilter, recipeFilter, siteFilter, plantFilter, hierarchicalData]);

  // Update selection summary
  const updateSelectionSummary = useCallback((updatedData: HierarchicalReportData) => {
    const selectedClients = updatedData.clients.filter(c => c.selected).map(c => c.id);
    const selectedOrders = updatedData.clients.flatMap(c => 
      c.orders.filter(o => o.selected).map(o => o.id)
    );
    const selectedRemisiones = updatedData.clients.flatMap(c => 
      c.orders.flatMap(o => o.remisiones.filter(r => r.selected).map(r => r.id))
    );

    const selectedRemisionObjects = updatedData.clients.flatMap(c => 
      c.orders.flatMap(o => o.remisiones.filter(r => r.selected))
    );

    const totalVolume = selectedRemisionObjects.reduce((sum, r) => sum + r.volumen_fabricado, 0);
    const totalAmount = selectedRemisionObjects.reduce((sum, r) => sum + (r.line_total || 0), 0);

    const summary: SelectionSummary = {
      totalClients: selectedClients.length,
      totalOrders: selectedOrders.length,
      totalRemisiones: selectedRemisiones.length,
      totalVolume,
      totalAmount,
      selectedClients,
      selectedOrders,
      selectedRemisiones
    };

    setSelectionSummary(summary);
    onSelectionChange(summary);

    const filters: ReportFilter = {
      dateRange,
      singleDateMode,
      clientIds: selectedClients,
      orderIds: selectedOrders,
      remisionIds: selectedRemisiones,
      recipeCodes: recipeFilter.length > 0 ? recipeFilter : undefined,
      constructionSites: siteFilter.length > 0 ? siteFilter : undefined,
      plantIds: plantFilter.length > 0 ? plantFilter : undefined
    };

    onDataChange(updatedData, filters);
  }, [dateRange, singleDateMode, recipeFilter, siteFilter, plantFilter, onDataChange, onSelectionChange]);

  // Selection functions - Fixed to avoid nested buttons
  const toggleClientSelection = (clientId: string) => {
    if (!hierarchicalData) return;

    const updatedData = { ...hierarchicalData };
    const clientIndex = updatedData.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;

    const client = { ...updatedData.clients[clientIndex] };
    client.selected = !client.selected;
    
    // Select/deselect all orders and remisiones
    client.orders = client.orders.map(order => ({
      ...order,
      selected: client.selected,
      remisiones: order.remisiones.map(remision => ({
        ...remision,
        selected: client.selected
      }))
    }));

    updatedData.clients[clientIndex] = client;
    setHierarchicalData(updatedData);
    updateSelectionSummary(updatedData);
  };

  const toggleOrderSelection = (clientId: string, orderId: string) => {
    if (!hierarchicalData) return;

    const updatedData = { ...hierarchicalData };
    const clientIndex = updatedData.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;

    const client = { ...updatedData.clients[clientIndex] };
    const orderIndex = client.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = { ...client.orders[orderIndex] };
    order.selected = !order.selected;

    // Select/deselect all remisiones
    order.remisiones = order.remisiones.map(remision => ({
      ...remision,
      selected: order.selected
    }));

    client.orders[orderIndex] = order;
    
    // Update client selection
    const selectedOrders = client.orders.filter(o => o.selected).length;
    const totalOrders = client.orders.length;
    client.selected = selectedOrders === totalOrders && totalOrders > 0;

    updatedData.clients[clientIndex] = client;
    setHierarchicalData(updatedData);
    updateSelectionSummary(updatedData);
  };

  const toggleRemisionSelection = (clientId: string, orderId: string, remisionId: string) => {
    if (!hierarchicalData) return;

    const updatedData = { ...hierarchicalData };
    const clientIndex = updatedData.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;

    const client = { ...updatedData.clients[clientIndex] };
    const orderIndex = client.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = { ...client.orders[orderIndex] };
    const remisionIndex = order.remisiones.findIndex(r => r.id === remisionId);
    if (remisionIndex === -1) return;

    const remision = { ...order.remisiones[remisionIndex] };
    remision.selected = !remision.selected;
    order.remisiones[remisionIndex] = remision;

    // Update order selection
    const selectedRemisiones = order.remisiones.filter(r => r.selected).length;
    const totalRemisiones = order.remisiones.length;
    order.selected = selectedRemisiones === totalRemisiones && totalRemisiones > 0;

    client.orders[orderIndex] = order;

    // Update client selection
    const selectedOrders = client.orders.filter(o => o.selected).length;
    const totalOrders = client.orders.length;
    client.selected = selectedOrders === totalOrders && totalOrders > 0;

    updatedData.clients[clientIndex] = client;
    setHierarchicalData(updatedData);
    updateSelectionSummary(updatedData);
  };

  // Bulk selection functions
  const selectAll = () => {
    if (!filteredData) return;

    const updatedData = {
      ...filteredData,
      clients: filteredData.clients.map(client => ({
        ...client,
        selected: true,
        orders: client.orders.map(order => ({
          ...order,
          selected: true,
          remisiones: order.remisiones.map(remision => ({
            ...remision,
            selected: true
          }))
        }))
      }))
    };
    
    setHierarchicalData(updatedData);
    updateSelectionSummary(updatedData);
  };

  const clearAll = () => {
    if (!hierarchicalData) return;

    const updatedData = {
      ...hierarchicalData,
      clients: hierarchicalData.clients.map(client => ({
        ...client,
        selected: false,
        orders: client.orders.map(order => ({
          ...order,
          selected: false,
          remisiones: order.remisiones.map(remision => ({
            ...remision,
            selected: false
          }))
        }))
      }))
    };
    
    setHierarchicalData(updatedData);
    updateSelectionSummary(updatedData);
  };

  // Get selection state for visual indicators
  const getSelectionState = (selected: boolean, hasSelected: boolean, total: number): 'checked' | 'unchecked' | 'indeterminate' => {
    if (selected) return 'checked';
    if (hasSelected && total > 0) return 'indeterminate';
    return 'unchecked';
  };

  const SelectionIcon = ({ state }: { state: 'checked' | 'unchecked' | 'indeterminate' }) => {
    if (state === 'checked') return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    if (state === 'indeterminate') return <Minus className="h-4 w-4 text-orange-500" />;
    return <Circle className="h-4 w-4 text-gray-400" />;
  };

  // Toggle expansion
  const toggleClientExpansion = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Clean Header with Date Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Selección de Datos para Reporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período</Label>
              <DateRangePickerWithPresets 
                dateRange={dateRange} 
                onDateRangeChange={(range) => range && setDateRange(range)}
                singleDateMode={singleDateMode}
                onSingleDateModeChange={setSingleDateMode}
              />
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cliente, orden, remisión..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Simple Filters Toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros Adicionales
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            
            <Button
              variant="outline"
              onClick={loadHierarchicalData}
              disabled={loadingData}
              className="flex items-center gap-2"
            >
              {loadingData ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Actualizar
            </Button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              {/* Plant Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Plantas</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availablePlants.map((plant) => (
                    <div key={plant.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={plantFilter.includes(plant.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPlantFilter(prev => [...prev, plant.id]);
                          } else {
                            setPlantFilter(prev => prev.filter(id => id !== plant.id));
                          }
                        }}
                      />
                      <Label className="text-sm cursor-pointer">{plant.name} ({plant.code})</Label>
                    </div>
                  ))}
                </div>
                {plantFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlantFilter([])}
                    className="text-xs h-auto p-1"
                  >
                    Limpiar ({plantFilter.length})
                  </Button>
                )}
              </div>

              {/* Recipe Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Recetas</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableRecipes.map((recipe) => (
                    <div key={recipe} className="flex items-center space-x-2">
                      <Checkbox
                        checked={recipeFilter.includes(recipe)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setRecipeFilter(prev => [...prev, recipe]);
                          } else {
                            setRecipeFilter(prev => prev.filter(r => r !== recipe));
                          }
                        }}
                      />
                      <Label className="text-sm cursor-pointer">{recipe}</Label>
                    </div>
                  ))}
                </div>
                {recipeFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecipeFilter([])}
                    className="text-xs h-auto p-1"
                  >
                    Limpiar ({recipeFilter.length})
                  </Button>
                )}
              </div>

              {/* Client Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Clientes</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableClients.map((client) => (
                    <div key={client.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={clientFilter.includes(client.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setClientFilter(prev => [...prev, client.id]);
                          } else {
                            setClientFilter(prev => prev.filter(id => id !== client.id));
                            // Also deselect the client when removed from filter
                            if (hierarchicalData) {
                              const updatedData = { ...hierarchicalData };
                              const clientIndex = updatedData.clients.findIndex(c => c.id === client.id);
                              if (clientIndex !== -1) {
                                updatedData.clients[clientIndex] = {
                                  ...updatedData.clients[clientIndex],
                                  selected: false,
                                  orders: updatedData.clients[clientIndex].orders.map(order => ({
                                    ...order,
                                    selected: false,
                                    remisiones: order.remisiones.map(remision => ({
                                      ...remision,
                                      selected: false
                                    }))
                                  }))
                                };
                                setHierarchicalData(updatedData);
                              }
                            }
                          }
                        }}
                      />
                      <Label className="text-sm cursor-pointer">{client.name}</Label>
                    </div>
                  ))}
                </div>
                {clientFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setClientFilter([])}
                    className="text-xs h-auto p-1"
                  >
                    Limpiar ({clientFilter.length})
                  </Button>
                )}
              </div>

              {/* Site Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Obras</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableSites.map((site) => (
                    <div key={site} className="flex items-center space-x-2">
                      <Checkbox
                        checked={siteFilter.includes(site)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSiteFilter(prev => [...prev, site]);
                          } else {
                            setSiteFilter(prev => prev.filter(s => s !== site));
                          }
                        }}
                      />
                      <Label className="text-sm cursor-pointer truncate">{site}</Label>
                    </div>
                  ))}
                </div>
                {siteFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSiteFilter([])}
                    className="text-xs h-auto p-1"
                  >
                    Limpiar ({siteFilter.length})
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clean Selection Summary */}
      {selectionSummary.selectedRemisiones.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{selectionSummary.selectedClients.length}</div>
                <div className="text-sm text-gray-600">Clientes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{selectionSummary.selectedOrders.length}</div>
                <div className="text-sm text-gray-600">Órdenes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{selectionSummary.selectedRemisiones.length}</div>
                <div className="text-sm text-gray-600">Remisiones</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{selectionSummary.totalVolume.toFixed(2)}</div>
                <div className="text-sm text-gray-600">m³</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  ${selectionSummary.totalAmount.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clean Selection Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Datos Disponibles</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Seleccionar Todo
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredData || filteredData.clients.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos disponibles</h3>
              <p className="text-gray-500">Ajusta las fechas o filtros para ver datos disponibles</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredData.clients.map((client) => {
                  const selectedOrders = client.orders.filter(o => o.selected).length;
                  const clientState = getSelectionState(client.selected, selectedOrders > 0, client.orders.length);
                  
                  return (
                    <div key={client.id} className="border rounded-lg">
                      {/* Clean Client Header */}
                      <div 
                        className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleClientExpansion(client.id)}
                      >
                        <div onClick={(e) => { e.stopPropagation(); toggleClientSelection(client.id); }}>
                          <SelectionIcon state={clientState} />
                        </div>
                        
                        <Users className="h-4 w-4 text-blue-500" />
                        
                        <div className="flex-1">
                          <div className="font-medium">{client.business_name}</div>
                          <div className="text-sm text-gray-500">
                            {client.orders.length} órdenes • {client.orders.reduce((sum, o) => sum + o.remisiones.length, 0)} remisiones
                          </div>
                        </div>

                        {expandedClients.has(client.id) ? 
                          <ChevronDown className="h-4 w-4 text-gray-400" /> : 
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        }
                      </div>

                      {/* Orders */}
                      {expandedClients.has(client.id) && (
                        <div className="border-t bg-gray-50">
                          {client.orders.map((order) => {
                            const selectedRemisiones = order.remisiones.filter(r => r.selected).length;
                            const orderState = getSelectionState(order.selected, selectedRemisiones > 0, order.remisiones.length);
                            
                            return (
                              <div key={order.id} className="border-b last:border-b-0">
                                {/* Clean Order Header */}
                                <div 
                                  className="p-3 pl-8 flex items-center gap-3 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => toggleOrderExpansion(order.id)}
                                >
                                  <div onClick={(e) => { e.stopPropagation(); toggleOrderSelection(client.id, order.id); }}>
                                    <SelectionIcon state={orderState} />
                                  </div>
                                  
                                  <FileText className="h-4 w-4 text-green-600" />
                                  
                                  <div className="flex-1">
                                    <div className="font-medium">{order.order_number}</div>
                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                      <MapPin className="h-3 w-3" />
                                      {order.construction_site}
                                      {order.elemento && <span>• {order.elemento}</span>}
                                    </div>
                                  </div>
                                  
                                  <div className="text-right text-sm">
                                    <div>{order.remisiones.length} remisiones</div>
                                    <div className="text-gray-500">{order.total_volume.toFixed(2)} m³</div>
                                  </div>

                                  {expandedOrders.has(order.id) ? 
                                    <ChevronDown className="h-4 w-4 text-gray-400" /> : 
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                  }
                                </div>

                                {/* Remisiones */}
                                {expandedOrders.has(order.id) && (
                                  <div className="bg-white">
                                    {order.remisiones.map((remision) => (
                                      <div key={remision.id} className="p-3 pl-12 flex items-center gap-3 hover:bg-gray-50 border-b last:border-b-0">
                                        <Checkbox
                                          checked={remision.selected}
                                          onCheckedChange={() => toggleRemisionSelection(client.id, order.id, remision.id)}
                                        />
                                        
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                          <div className="font-medium">{remision.remision_number}</div>
                                          <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-gray-400" />
                                            {format(new Date(remision.fecha), 'dd/MM/yyyy', { locale: es })}
                                          </div>
                                          <div>{remision.volumen_fabricado.toFixed(2)} m³</div>
                                          <div className="text-gray-600">{remision.recipe_code || '-'}</div>
                                        </div>
                                        
                                        {remision.line_total && (
                                          <div className="text-sm font-medium">
                                            ${remision.line_total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                          </div>
                                        )}
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}