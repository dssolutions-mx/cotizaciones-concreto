'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Eye, Download, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useSignedUrls } from '@/hooks/useSignedUrls';
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
  plants: {
    name: string;
  };
  remision_documents: PumpingEvidence[];
}

interface PumpingEvidenceSectionProps {
  orderId: string;
}

export default function PumpingEvidenceSection({ orderId }: PumpingEvidenceSectionProps) {
  const [pumpingRemisiones, setPumpingRemisiones] = useState<PumpingRemision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600);

  useEffect(() => {
    const fetchPumpingEvidence = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/orders/${orderId}/pumping-evidence`);
        
        if (!response.ok) {
          throw new Error('Error al obtener evidencia de bombeo');
        }
        
        const result = await response.json();
        setPumpingRemisiones(result.data || []);
      } catch (err) {
        console.error('Error fetching pumping evidence:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchPumpingEvidence();
  }, [orderId]);

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

  const formatDateSafely = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateStr;
    }
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
            <span className="text-sm text-gray-600">Cargando evidencia de bombeo...</span>
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

  if (pumpingRemisiones.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No hay remisiones de bombeo con evidencia para esta orden</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Evidencia de Remisiones de Bombeo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {pumpingRemisiones.map((remision) => (
            <div key={remision.id} className="border border-gray-200 rounded-lg p-4">
              {/* Remision Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Remisión #{remision.remision_number}
                  </h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span>📅 {formatDateSafely(remision.fecha)}</span>
                    <span>🏭 {remision.plants.name}</span>
                    <span>📦 {remision.volumen_fabricado.toFixed(2)} m³</span>
                    {remision.conductor && <span>👤 {remision.conductor}</span>}
                    {remision.unidad && <span>🚛 {remision.unidad}</span>}
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {remision.remision_documents?.length || 0} {(remision.remision_documents?.length || 0) === 1 ? 'documento' : 'documentos'}
                </Badge>
              </div>

              {/* Evidence List */}
              {remision.remision_documents && remision.remision_documents.length > 0 ? (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Documentos de Evidencia:</h5>
                  <div className="grid gap-2">
                    {remision.remision_documents.map((evidence) => (
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
      </CardContent>
    </Card>
  );
}
