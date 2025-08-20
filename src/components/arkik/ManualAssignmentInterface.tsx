'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Clock, MapPin, Calendar, Package, DollarSign } from 'lucide-react';
import type { StagingRemision } from '@/types/arkik';
import { ArkikManualAssignmentService, type ManualAssignmentCandidate, type CompatibleOrder } from '@/services/arkikManualAssignment';

interface ManualAssignmentInterfaceProps {
  unmatchedRemisiones: StagingRemision[];
  plantId: string;
  onAssignmentsComplete: (assignments: Map<string, string>) => void;
  onCancel: () => void;
}

export default function ManualAssignmentInterface({
  unmatchedRemisiones,
  plantId,
  onAssignmentsComplete,
  onCancel
}: ManualAssignmentInterfaceProps) {
  const [candidates, setCandidates] = useState<ManualAssignmentCandidate[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompatibleOrders();
  }, [unmatchedRemisiones, plantId]);

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
    const targetDate = date instanceof Date ? date : new Date(date);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        <span className="ml-2">Cargando órdenes compatibles...</span>
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
          <Button onClick={loadCompatibleOrders} variant="outline">
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
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              Asignación Manual de Remisiones
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Se encontraron {totalCount} remisiones que no pudieron asignarse automáticamente. 
              Revisa las órdenes compatibles y asigna manualmente.
            </p>
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
          </div>
        </div>
      </div>

      {/* Assignment Cards */}
      <div className="space-y-4">
        {candidates.map((candidate) => {
          const remision = candidate.remision;
          const assignedOrderId = assignments.get(remision.remision_number);
          const assignedOrder = candidate.compatibleOrders.find(o => o.id === assignedOrderId);

          return (
            <Card key={remision.remision_number} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Remisión {remision.remision_number}
                  </CardTitle>
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
                    <span>{formatDate(remision.fecha.toISOString())}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    <span>{formatCurrency(remision.unit_price * remision.volumen_fabricado)}</span>
                  </div>
                </div>
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
                        value={assignedOrderId || ""} 
                        onValueChange={(value) => handleAssignment(remision.remision_number, value || null)}
                      >
                        <SelectTrigger className="max-w-md">
                          <SelectValue placeholder="Seleccionar orden..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">
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

      {/* Actions */}
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-gray-600">
          {assignedCount === totalCount ? (
            <span className="text-green-600 font-medium">
              ✅ Todas las remisiones han sido procesadas
            </span>
          ) : (
            <span>
              {totalCount - assignedCount} remisiones sin asignar crearán nuevas órdenes
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
          >
            Continuar con Asignaciones
          </Button>
        </div>
      </div>
    </div>
  );
}
