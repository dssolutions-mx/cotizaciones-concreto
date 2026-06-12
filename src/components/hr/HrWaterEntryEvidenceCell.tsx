'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Download, Eye, FileText, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { InventoryDocument } from '@/types/inventory';
import { cn } from '@/lib/utils';

function guessKind(doc: InventoryDocument): 'image' | 'pdf' | 'csv' | 'other' {
  const mime = doc.mime_type?.toLowerCase() || '';
  const name = (doc.original_name || doc.file_name || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime === 'text/csv' || name.endsWith('.csv')) return 'csv';
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
  return 'other';
}

type HrWaterEntryEvidenceCellProps = {
  entryId: string;
  documentCount: number;
  className?: string;
};

export function HrWaterEntryEvidenceCell({
  entryId,
  documentCount,
  className,
}: HrWaterEntryEvidenceCellProps) {
  const [documents, setDocuments] = useState<InventoryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<InventoryDocument | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!entryId || documentCount === 0) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/hr/water-entry-documents?entry_id=${encodeURIComponent(entryId)}`,
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'No se pudo cargar evidencia');
      }
      const data = await res.json();
      setDocuments(data.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar evidencia');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [entryId, documentCount]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const previewKind = useMemo(
    () => (previewDoc ? guessKind(previewDoc) : 'other'),
    [previewDoc],
  );

  if (documentCount === 0) {
    return (
      <Badge
        variant="outline"
        className={cn('border-amber-300 bg-amber-50 text-amber-900 gap-1', className)}
      >
        <AlertTriangle className="h-3 w-3" />
        Sin archivos
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-gray-500', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando…
      </div>
    );
  }

  if (error) {
    return (
      <span className={cn('text-xs text-red-600', className)} role="alert">
        {error}
      </span>
    );
  }

  if (documents.length === 0) {
    return (
      <span className={cn('text-xs text-gray-500', className)}>Sin archivos visibles</span>
    );
  }

  return (
    <>
      <ul
        className={cn('space-y-1.5 min-w-[140px] max-w-[220px]', className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs"
          >
            <div className="font-medium text-stone-900 truncate" title={doc.original_name || doc.file_name}>
              {doc.original_name || doc.file_name || 'Archivo'}
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">
              {format(new Date(doc.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
            </div>
            {doc.url ? (
              <div className="flex flex-wrap gap-1 mt-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setPreviewDoc(doc)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ver
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" asChild>
                  <a
                    href={doc.url}
                    download={doc.original_name || doc.file_name || 'documento'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Descargar
                  </a>
                </Button>
              </div>
            ) : (
              <span className="text-[10px] text-stone-400">Sin enlace</span>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-[min(100vw-1rem,56rem)] w-[95vw] p-0 gap-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-semibold line-clamp-2 pr-4">
              {previewDoc?.original_name || previewDoc?.file_name || 'Evidencia'}
            </DialogTitle>
            <DialogDescription className="sr-only">Vista previa de evidencia adjunta</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-stone-100 min-h-[200px]">
            {previewDoc?.url && previewKind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewDoc.url}
                alt={previewDoc.original_name || 'Evidencia'}
                className="max-h-[min(70vh,560px)] mx-auto rounded-md border border-stone-200 bg-white object-contain"
              />
            )}
            {previewDoc?.url && previewKind === 'pdf' && (
              <iframe
                src={previewDoc.url}
                title={previewDoc.original_name || 'PDF'}
                className="w-full h-[min(70vh,560px)] rounded-md border border-stone-200 bg-white"
              />
            )}
            {previewDoc?.url && previewKind !== 'image' && previewKind !== 'pdf' && (
              <div className="text-center py-12 text-sm text-stone-600">
                <FileText className="h-10 w-10 mx-auto mb-2 text-stone-400" />
                Vista previa no disponible. Use Descargar.
              </div>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t shrink-0">
            {previewDoc?.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer">
                  Abrir en pestaña nueva
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
