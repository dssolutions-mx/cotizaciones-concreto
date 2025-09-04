'use client';

import React, { useState, useEffect } from 'react';
// Removed date-fns imports since we're using simple date strings
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Eye, ExternalLink, Search, Filter, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { usePlantContext } from '@/contexts/PlantContext';
import { toast } from 'sonner';

interface PumpingEvidence {
  id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type: string;
  document_category: string;
  uploaded_by: string;
  created_at: string;
}

interface PumpingRemision {
  id: string;
  remision_number: string;
  fecha: string;
  conductor: string;
  unidad: string;
  volumen_fabricado: number;
  plant_id: number;
  order_id: string;
  plants: {
    name: string;
  };
  orders: {
    id: string;
    order_number: string;
    client_id: string;
    construction_site: string;
    clients: {
      business_name: string;
    };
  };
  evidence: PumpingEvidence[];
  evidenceCount: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PumpingRemisionesAdmin() {
  const [pumpingRemisiones, setPumpingRemisiones] = useState<PumpingRemision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  
  // Filters
  const [filters, setFilters] = useState({
    plant_id: 'all',
    date_from: '',
    date_to: '',
    has_evidence: 'all',
    search: ''
  });

  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600);
  const { availablePlants } = usePlantContext();

  const fetchPumpingRemisiones = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'all'))
      });

      const response = await fetch(`/api/admin/pumping-remisiones?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener remisiones de bombeo');
      }
      
      const result = await response.json();
      setPumpingRemisiones(result.data || []);
      setPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      console.error('Error fetching pumping remisiones:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPumpingRemisiones();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchPumpingRemisiones(1);
  };

  const handleViewEvidence = async (evidence: PumpingEvidence) => {
    try {
      const signedUrl = await getSignedUrl(evidence.file_path);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        toast.error('No se pudo generar el enlace para ver el documento');
      }
    } catch (error) {
      console.error('Error viewing evidence:', error);
      toast.error('Error al abrir el documento');
    }
  };

  const handleViewOrder = (orderId: string) => {
    window.open(`/orders/${orderId}`, '_blank');
  };

  const formatDateSafely = (dateStr: string) => {
    if (!dateStr) return '-';
    // Simply return the date string as-is since dates are already in local time
    return dateStr;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('text/')) return '📝';
    return '📎';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-600">Cargando remisiones de bombeo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Planta</label>
              <Select value={filters.plant_id} onValueChange={(value) => handleFilterChange('plant_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las plantas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {availablePlants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id.toString()}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha Desde</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha Hasta</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Evidencia</label>
              <Select value={filters.has_evidence} onValueChange={(value) => handleFilterChange('has_evidence', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="true">Con evidencia</SelectItem>
                  <SelectItem value="false">Sin evidencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSearch} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Remisiones de Bombeo
            </CardTitle>
            <Badge variant="outline">
              {pagination.total} {pagination.total === 1 ? 'remisión' : 'remisiones'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pumpingRemisiones.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No se encontraron remisiones de bombeo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pumpingRemisiones.map((remision) => (
                <div key={remision.id} className="border border-gray-200 rounded-lg p-4">
                  {/* Remision Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          Remisión #{remision.remision_number}
                        </h4>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {remision.evidenceCount} {remision.evidenceCount === 1 ? 'documento' : 'documentos'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewOrder(remision.order_id)}
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver Orden
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Fecha:</span> {formatDateSafely(remision.fecha)}
                        </div>
                        <div>
                          <span className="font-medium">Planta:</span> {remision.plants.name}
                        </div>
                        <div>
                          <span className="font-medium">Volumen:</span> {remision.volumen_fabricado.toFixed(2)} m³
                        </div>
                        <div>
                          <span className="font-medium">Cliente:</span> {remision.orders.clients.business_name}
                        </div>
                        <div>
                          <span className="font-medium">Obra:</span> {remision.orders.construction_site}
                        </div>
                        <div>
                          <span className="font-medium">Orden:</span> #{remision.orders.order_number}
                        </div>
                        {remision.conductor && (
                          <div>
                            <span className="font-medium">Conductor:</span> {remision.conductor}
                          </div>
                        )}
                        {remision.unidad && (
                          <div>
                            <span className="font-medium">Unidad:</span> {remision.unidad}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Evidence List */}
                  {remision.evidence.length > 0 ? (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Documentos de Evidencia:</h5>
                      <div className="grid gap-2">
                        {remision.evidence.map((evidence) => (
                          <div
                            key={evidence.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg">{getFileIcon(evidence.mime_type)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {evidence.original_name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{formatFileSize(evidence.file_size)}</span>
                                  <span>•</span>
                                  <span>{formatDateSafely(evidence.created_at)}</span>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    {evidence.document_type.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewEvidence(evidence)}
                                disabled={urlLoading(evidence.file_path)}
                                className="flex items-center gap-1"
                              >
                                {urlLoading(evidence.file_path) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                                Ver
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">Sin documentos de evidencia</p>
                    </div>
                  )}


                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPumpingRemisiones(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-600">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPumpingRemisiones(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
