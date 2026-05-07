'use client';

import React, { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { labelPortalRemisionDocumentCategory } from '@/lib/client-portal/portalOrderEvidence';

export type PortalConcreteEvidenceItem = {
  id: string;
  file_path: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  notes: string | null;
  created_at: string;
};

export type PortalRemisionDocumentItem = {
  id: string;
  file_path: string;
  original_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string | null;
  document_category: string | null;
  created_at: string;
};

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizes = ['B', 'KB', 'MB', 'GB'];
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatEvidenceDate(iso: string): string {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm', { locale: es });
  } catch {
    return iso;
  }
}

export function PortalConcreteEvidencePanel({ items }: { items: PortalConcreteEvidenceItem[] }) {
  const { getSignedUrl, isLoading } = useSignedUrls('remision-documents', 3600);
  const [openErrorId, setOpenErrorId] = useState<string | null>(null);

  const openFile = useCallback(
    async (row: PortalConcreteEvidenceItem) => {
      setOpenErrorId(null);
      const url = await getSignedUrl(row.file_path);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setOpenErrorId(row.id);
      }
    },
    [getSignedUrl]
  );

  if (!items.length) {
    return (
      <p className="text-caption text-label-secondary py-2">
        No hay archivos de evidencia de concreto registrados para este pedido.
      </p>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Evidencia de concreto del pedido">
      {items.map((row) => {
        const loading = isLoading(row.file_path);
        const sizeLabel = formatFileSize(row.file_size);
        return (
          <li
            key={row.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
          >
            <div className="min-w-0 flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <p
                  className="text-body font-medium text-label-primary truncate"
                  title={row.original_name}
                >
                  {row.original_name}
                </p>
                <p className="text-caption text-label-tertiary">
                  {formatEvidenceDate(row.created_at)}
                  {sizeLabel ? ` · ${sizeLabel}` : ''}
                </p>
                {row.notes?.trim() ? (
                  <p className="text-caption text-label-secondary mt-1 whitespace-pre-wrap">{row.notes}</p>
                ) : null}
                {openErrorId === row.id ? (
                  <p className="text-caption text-red-500 mt-1" role="alert">
                    No se pudo abrir el archivo. Intente de nuevo.
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-white/20"
              disabled={loading}
              onClick={() => openFile(row)}
              aria-label={`Abrir ${row.original_name}`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <>
                  Abrir
                  <ExternalLink className="w-4 h-4 ml-1.5" aria-hidden />
                </>
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function PortalRemisionDocumentsList({ documents }: { documents: PortalRemisionDocumentItem[] }) {
  const { getSignedUrl, isLoading } = useSignedUrls('remision-documents', 3600);
  const [openErrorId, setOpenErrorId] = useState<string | null>(null);

  const openFile = useCallback(
    async (row: PortalRemisionDocumentItem) => {
      setOpenErrorId(null);
      const url = await getSignedUrl(row.file_path);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setOpenErrorId(row.id);
      }
    },
    [getSignedUrl]
  );

  if (!documents.length) return null;

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <p className="text-caption font-semibold text-label-primary mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" aria-hidden />
        Documentos ({documents.length})
      </p>
      <ul className="space-y-2" aria-label="Documentos de la remisión">
        {documents.map((doc) => {
          const loading = isLoading(doc.file_path);
          const catLabel = labelPortalRemisionDocumentCategory(doc.document_category);
          const sizeLabel = formatFileSize(doc.file_size);
          return (
            <li
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-caption text-label-tertiary">{catLabel}</p>
                <p className="text-footnote font-medium text-label-primary truncate" title={doc.original_name}>
                  {doc.original_name}
                </p>
                <p className="text-caption text-label-tertiary">
                  {formatEvidenceDate(doc.created_at)}
                  {sizeLabel ? ` · ${sizeLabel}` : ''}
                </p>
                {openErrorId === doc.id ? (
                  <p className="text-caption text-red-500 mt-1" role="alert">
                    No se pudo abrir el archivo.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-primary"
                disabled={loading}
                onClick={() => openFile(doc)}
                aria-label={`Abrir ${doc.original_name}`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : 'Abrir'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
