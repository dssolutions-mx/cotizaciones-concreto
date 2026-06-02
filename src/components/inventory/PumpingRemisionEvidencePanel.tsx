'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { REMISION_DOCUMENT_MAX_MB } from '@/lib/constants/remisionDocumentsUpload';
import { uploadRemisionDocumentFromClient } from '@/lib/remisiones/uploadRemisionDocumentFromClient';
import type { RemisionDocument } from '@/types/remisiones';
import { toast } from 'sonner';

export type PumpingRemisionEvidenceItem = {
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
};

type Props = {
  remisionId: string;
  plantId: string | number;
  remisionNumber?: string;
  initialEvidence?: PumpingRemisionEvidenceItem[];
  onEvidenceChange?: (evidence: PumpingRemisionEvidenceItem[]) => void;
};

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('text/')) return '📝';
  return '📎';
}

export default function PumpingRemisionEvidencePanel({
  remisionId,
  plantId,
  remisionNumber,
  initialEvidence = [],
  onEvidenceChange,
}: Props) {
  const [evidence, setEvidence] = useState<PumpingRemisionEvidenceItem[]>(initialEvidence);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600);

  useEffect(() => {
    setEvidence(initialEvidence);
  }, [initialEvidence, remisionId]);

  const notifyChange = useCallback(
    (next: PumpingRemisionEvidenceItem[]) => {
      setEvidence(next);
      onEvidenceChange?.(next);
    },
    [onEvidenceChange]
  );

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/remisiones/documents?remision_id=${remisionId}&document_category=pumping_remision`
      );
      if (!response.ok) {
        throw new Error('Error al obtener evidencia');
      }
      const result = await response.json();
      const docs = (result.data || []) as RemisionDocument[];
      const mapped: PumpingRemisionEvidenceItem[] = docs.map((doc) => ({
        id: doc.id,
        file_name: doc.file_name,
        original_name: doc.original_name,
        file_path: doc.file_path,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        document_type: doc.document_type,
        document_category: doc.document_category,
        uploaded_by: doc.uploaded_by,
        created_at: doc.created_at,
      }));
      notifyChange(mapped);
    } catch (err) {
      console.error('Error fetching pumping evidence:', err);
      toast.error('No se pudo cargar la evidencia de bombeo');
    } finally {
      setLoading(false);
    }
  }, [remisionId, notifyChange]);

  const handleFileSelect = async (files: FileList) => {
    if (files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        await uploadRemisionDocumentFromClient({
          remisionId,
          plantId: String(plantId),
          file,
          documentType: 'remision_proof',
          documentCategory: 'pumping_remision',
        });
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al subir archivo';
        errors.push(`${file.name}: ${message}`);
      }
    }

    await fetchEvidence();

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? 'Evidencia de bombeo guardada'
          : `${successCount} archivos de evidencia guardados`
      );
    }
    if (errors.length > 0) {
      toast.error(errors[0], {
        description: errors.length > 1 ? `${errors.length} archivo(s) con error` : undefined,
      });
    }

    setUploading(false);
  };

  const handleViewEvidence = async (item: PumpingRemisionEvidenceItem) => {
    try {
      const signedUrl = await getSignedUrl(item.file_path);
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

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/remisiones/documents?id=${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Error al eliminar documento');
      }
      const next = evidence.filter((e) => e.id !== documentId);
      notifyChange(next);
      toast.success('Documento eliminado');
    } catch (error) {
      console.error('Error deleting evidence:', error);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar documento');
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Evidencia de bombeo
          {remisionNumber ? (
            <span className="font-normal text-gray-500">#{remisionNumber}</span>
          ) : null}
        </h5>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          {evidence.length} {evidence.length === 1 ? 'documento' : 'documentos'}
        </Badge>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        Puede agregar evidencia después del registro. Imágenes o PDF, hasta {REMISION_DOCUMENT_MAX_MB}MB por
        archivo.
      </p>

      <SimpleFileUpload
        onFileSelect={handleFileSelect}
        acceptedTypes={['image/*', 'application/pdf']}
        multiple
        maxSize={REMISION_DOCUMENT_MAX_MB}
        uploading={uploading}
        disabled={uploading || loading}
        hideInternalList
        className="mb-3"
      />

      {loading && evidence.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando documentos…
        </div>
      ) : evidence.length > 0 ? (
        <div className="space-y-2">
          {evidence.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border bg-white p-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-lg shrink-0">{getFileIcon(item.mime_type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{item.original_name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(item.file_size)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewEvidence(item)}
                  disabled={urlLoading(item.file_path)}
                  className="h-8 px-2"
                >
                  {urlLoading(item.file_path) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Eliminar documento"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
          <Upload className="h-4 w-4 text-gray-400" />
          Sin documentos — use el área de arriba para subir evidencia
        </div>
      )}
    </div>
  );
}
