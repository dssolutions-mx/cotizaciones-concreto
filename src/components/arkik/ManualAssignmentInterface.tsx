'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle, Clock, MapPin, Calendar, Package, DollarSign, Search, Filter, RefreshCw, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StagingRemision } from '@/types/arkik';
import { ArkikManualAssignmentService, type ManualAssignmentCandidate, type CompatibleOrder, type RemisionSearchFilters, type RemisionSearchResult } from '@/services/arkikManualAssignment';

interface ManualAssignmentInterfaceProps {
  unmatchedRemisiones: StagingRemision[];
  plantId: string;
  onAssignmentsComplete: (assignments: Map<string, string>) => void;
  onCancel: () => void;
  allowReassignment?: boolean; // Allow reassignment of already assigned remisiones
}

export default function ManualAssignmentInterface({
  unmatchedRemisiones,
  plantId,
  onAssignmentsComplete,
  onCancel,
  allowReassignment = false
}: ManualAssignmentInterfaceProps) {
  // Enhanced state for flexible reassignment
  const [candidates, setCandidates] = useState<ManualAssignmentCandidate[]>([]);
  const [searchResults, setSearchResults] = useState<RemisionSearchResult[]>([]);
  const [selectedRemisionIds, setSelectedRemisionIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [includeAssigned, setIncludeAssigned] = useState(allowReassignment);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // View mode: 'unmatched' | 'search'
  const [viewMode, setViewMode] = useState<'unmatched' | 'search'>('unmatched');

  useEffect(() => {
    if (viewMode === 'unmatched') {
      loadCompatibleOrders();
    }
  }, [unmatchedRemisiones, plantId, viewMode]);

  // Computed values for pagination
  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return candidates.slice(startIndex, endIndex);
  }, [candidates, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(candidates.length / itemsPerPage);

  const loadCompatibleOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const service = new ArkikManualAssignmentService(plantId);
      const candidatesData = await service.findCompatibleOrdersForRemisiones(unmatchedRemisiones);

      setCandidates(candidatesData);

      // Auto-assign if there's only one compatible order with high score
      const autoAssignments = new Map<string, string>();
      candidatesData.forEach(candidate => {
        if (candidate.compatibleOrders.length === 1 && candidate.compatibleOrders[0].compatibility_score >= 8) {
          autoAssignments.set(candidate.remision.remision_number, candidate.compatibleOrders[0].id);
        }
      });

      if (autoAssignments.size > 0) {
        setAssignments(autoAssignments);
      }

    } catch (err) {
      console.error('Error loading compatible orders:', err);
      setError('Error al cargar órdenes compatibles');
    } finally {
      setLoading(false);
    }
  };

  const searchRemisiones = async () => {
    try {
      setSearching(true);
      setError(null);
      setCurrentPage(1);

      const filters: RemisionSearchFilters = {
        searchTerm: searchTerm.trim() || undefined,
        plantId,
        includeAssigned,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      };

      const service = new ArkikManualAssignmentService(plantId);
      const results = await service.searchRemisiones(filters);

      setSearchResults(results);
      setSelectedRemisionIds(new Set());

    } catch (err) {
      console.error('Error searching remisiones:', err);
      setError('Error al buscar remisiones');
    } finally {
      setSearching(false);
    }
  };

  const loadSelectedRemisiones = async () => {
    if (selectedRemisionIds.size === 0) {
      setError('Selecciona al menos una remisión');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const service = new ArkikManualAssignmentService(plantId);
      const selectedRemisionIdsArray = Array.from(selectedRemisionIds);
      const candidatesData = await service.findReassignmentCandidates(selectedRemisionIdsArray, includeAssigned);

      setCandidates(candidatesData);
      setViewMode('unmatched'); // Switch to assignment view

    } catch (err) {
      console.error('Error loading selected remisiones:', err);
      setError('Error al cargar remisiones seleccionadas');
    } finally {
      setLoading(false);
    }
  };

  const handleRemisionSelection = (remisionId: string, selected: boolean) => {
    const newSelection = new Set(selectedRemisionIds);
    if (selected) {
      newSelection.add(remisionId);
    } else {
      newSelection.delete(remisionId);
    }
    setSelectedRemisionIds(newSelection);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const allIds = searchResults.map(r => r.remision.id);
      setSelectedRemisionIds(new Set(allIds));
    } else {
      setSelectedRemisionIds(new Set());
    }
  };

  const handleAssignment = (remisionNumber: string, orderId: string | null) => {
    const newAssignments = new Map(assignments);
    if (orderId) {
      newAssignments.set(remisionNumber, orderId);
    } else {
      newAssignments.delete(remisionNumber);
    }
    setAssignments(newAssignments);
  };

  const handleComplete = () => {
    onAssignmentsComplete(assignments);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    // If we receive a date-only string, return as-is to avoid TZ conversion
    if (typeof date === 'string') {
      const ymd = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
      if (ymd.test(date)) return date;
      // If it looks like an ISO string, take the date part only
      const isoDatePart = date.split('T')[0];
      if (ymd.test(isoDatePart)) return isoDatePart;
      // Fallback to native parsing (rare)
      const tmp = new Date(date);
      const y = tmp.getFullYear();
      const m = String(tmp.getMonth() + 1).padStart(2, '0');
      const d = String(tmp.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Date object: format using local components (no toISOString)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-100 text-blue-800';
      case 'validated': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const assignedCount = assignments.size;
  const totalCount = unmatchedRemisiones.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">
          {viewMode === 'search' ? 'Cargando remisiones seleccionadas...' : 'Cargando órdenes compatibles...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={viewMode === 'search' ? searchRemisiones : loadCompatibleOrders}
            variant="outline"
          >
            Reintentar
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Asignación Manual de Remisiones
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                {viewMode === 'search'
                  ? 'Busca y selecciona remisiones para reasignar. Puedes incluir remisiones ya asignadas.'
                  : `Se encontraron ${totalCount} remisiones que no pudieron asignarse automáticamente.`
                }
              </p>
              {viewMode === 'unmatched' && (
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="text-blue-600">
                    <CheckCircle className="inline h-4 w-4 mr-1" />
                    Asignadas: {assignedCount}/{totalCount}
                  </span>
                  {assignedCount === totalCount && (
                    <span className="text-green-600 font-medium">
                      ¡Todas las remisiones asignadas!
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* View Mode Toggle and Actions */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'unmatched' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('unmatched')}
            >
              Remisiones sin asignar
            </Button>
            {allowReassignment && (
              <Button
                variant={viewMode === 'search' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('search')}
              >
                <Search className="h-4 w-4 mr-1" />
                Buscar remisiones
              </Button>
            )}
            {viewMode === 'unmatched' && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadCompatibleOrders}
                disabled={loading}
                title="Actualizar órdenes compatibles"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search Interface */}
      {viewMode === 'search' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buscar Remisiones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por número de remisión, cliente u obra..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
              </Button>
              <Button
                onClick={searchRemisiones}
                disabled={searching}
              >
                {searching ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                Buscar
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha desde
                  </label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha hasta
                  </label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-assigned"
                    checked={includeAssigned}
                    onCheckedChange={(checked) => setIncludeAssigned(checked === true)}
                  />
                  <label htmlFor="include-assigned" className="text-sm font-medium text-gray-700">
                    Incluir remisiones ya asignadas
                  </label>
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedRemisionIds.size === searchResults.length}
                      onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    />
                    <span className="text-sm font-medium">
                      Seleccionar todo ({searchResults.length} resultados)
                    </span>
                  </div>
                  <Button
                    onClick={loadSelectedRemisiones}
                    disabled={selectedRemisionIds.size === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Cargar seleccionadas ({selectedRemisionIds.size})
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={result.remision.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg ${
                        selectedRemisionIds.has(result.remision.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedRemisionIds.has(result.remision.id)}
                        onCheckedChange={(checked) =>
                          handleRemisionSelection(result.remision.id, checked === true)
                        }
                      />
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="font-medium">{result.remision.remision_number}</span>
                        </div>
                        <div className="text-gray-600">{result.remision.cliente_name}</div>
                        <div className="text-gray-600">{result.remision.obra_name}</div>
                        <div className="text-gray-600">
                          {formatDate(result.remision.fecha as any)}
                        </div>
                      </div>
                      {result.isAssigned && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Asignada
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.length === 0 && searchTerm && !searching && (
              <div className="text-center py-8 text-gray-500">
                No se encontraron remisiones que coincidan con la búsqueda.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assignment Cards */}
      {viewMode === 'unmatched' && candidates.length > 0 && (
        <>
          {/* Bulk Actions */}
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">
              Mostrando {paginatedCandidates.length} de {candidates.length} remisiones
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCompatibleOrders}
                disabled={loading}
                title="Actualizar órdenes compatibles"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newAssignments = new Map(assignments);
                  candidates.forEach(candidate => {
                    if (candidate.compatibleOrders.length === 1) {
                      newAssignments.set(candidate.remision.remision_number, candidate.compatibleOrders[0].id);
                    }
                  });
                  setAssignments(newAssignments);
                }}
              >
                Auto-asignar simples
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newAssignments = new Map();
                  setAssignments(newAssignments);
                }}
              >
                Limpiar todas
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {paginatedCandidates.map((candidate) => {
              const remision = candidate.remision;
              const assignedOrderId = assignments.get(remision.remision_number);
              const assignedOrder = candidate.compatibleOrders.find(o => o.id === assignedOrderId);

              return (
                <Card key={remision.remision_number} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">
                          Remisión {remision.remision_number}
                        </CardTitle>
                        {candidate.isCurrentlyAssigned && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Ya asignada
                          </Badge>
                        )}
                      </div>
                      {assignedOrder && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Asignada
                        </Badge>
                      )}
                    </div>

                  {/* Remision Details */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>{remision.cliente_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{remision.obra_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(remision.fecha as any)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>{formatCurrency((remision.unit_price || 0) * remision.volumen_fabricado)}</span>
                    </div>
                  </div>

                  {/* Current Assignment Info */}
                  {candidate.currentAssignment && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                      <div className="flex items-center gap-2 text-orange-800">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Asignación actual:</span>
                        <span>{candidate.currentAssignment.orderNumber}</span>
                        <Badge variant="outline" className="text-xs">
                          Se reasignará
                        </Badge>
                      </div>
                    </div>
                  )}
              </CardHeader>

              <CardContent>
                {candidate.compatibleOrders.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-yellow-700">
                        No se encontraron órdenes compatibles. Esta remisión creará una nueva orden.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Assignment Selector */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 min-w-[120px]">
                        Asignar a orden:
                      </label>
                      <Select 
                        value={assignedOrderId || "__no_assignment__"} 
                        onValueChange={(value) => handleAssignment(remision.remision_number, value === "__no_assignment__" ? null : value)}
                      >
                        <SelectTrigger className="max-w-md">
                          <SelectValue placeholder="Seleccionar orden..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__no_assignment__">
                            <span className="text-gray-500">No asignar (crear nueva orden)</span>
                          </SelectItem>
                          {candidate.compatibleOrders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{order.order_number}</span>
                                <span className="text-sm text-gray-500">
                                  ({formatDate(order.delivery_date)})
                                </span>
                                <span className={`text-sm font-medium ${getScoreColor(order.compatibility_score)}`}>
                                  {(order.compatibility_score * 10).toFixed(0)}%
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Compatible Orders List */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">
                        Órdenes compatibles ({candidate.compatibleOrders.length}):
                      </h4>
                      <div className="grid gap-2">
                        {candidate.compatibleOrders.slice(0, 3).map((order) => (
                          <div 
                            key={order.id} 
                            className={`p-3 border rounded-lg text-sm ${
                              assignedOrderId === order.id 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{order.order_number}</span>
                                <Badge className={getStatusColor(order.order_status)}>
                                  {order.order_status}
                                </Badge>
                                <span className={`font-bold ${getScoreColor(order.compatibility_score)}`}>
                                  {(order.compatibility_score * 10).toFixed(0)}% compatible
                                </span>
                              </div>
                              <span className="text-gray-600">{formatCurrency(order.total_amount)}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                              <span>📍 {order.construction_site}</span>
                              <span>📅 {formatDate(order.delivery_date)}</span>
                              <span>📦 {order.order_items.length} productos</span>
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {order.compatibility_reasons.map((reason, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        {candidate.compatibleOrders.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-2">
                            ... y {candidate.compatibleOrders.length - 3} órdenes más
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                Total: {candidates.length} remisiones
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">
              {assignedCount === candidates.length ? (
                <span className="text-green-600 font-medium">
                  ✅ Todas las remisiones han sido procesadas
                </span>
              ) : (
                <span>
                  {candidates.length - assignedCount} remisiones sin asignar crearán nuevas órdenes
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={onCancel} variant="outline">
                Cancelar
              </Button>
              <Button
                onClick={handleComplete}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={assignedCount === 0}
              >
                Continuar con Asignaciones ({assignedCount})
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
