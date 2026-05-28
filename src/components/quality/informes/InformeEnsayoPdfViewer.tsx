'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { renderInformePdfBlob } from '@/lib/quality/downloadInformePdf';
import type { InformeSnapshot } from '@/types/informe-ensayo';

type Props = {
  snapshot: InformeSnapshot;
};

/**
 * Preview via blob URL + iframe. PDFViewer from @react-pdf/renderer is incompatible
 * with React 19 (internal reconciler throws "is not a function").
 */
export function InformeEnsayoPdfViewer({ snapshot }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const renderKey = useMemo(
    () =>
      [
        snapshot.documento.numero,
        snapshot.documento.issued_at,
        snapshot.resultados_compresion
          .map((r) => `${r.identificacion}:${r.fecha_ensayo}:${r.fc_kg_cm2}`)
          .join(','),
        snapshot.resultados_fresco
          .map((r) => `${r.ensayo}:${r.lectura ?? ''}:${r.resultado}`)
          .join(','),
        snapshot.opinion_tecnica ?? '',
        snapshot.firmas.map((f) => `${f.rol}:${f.signed_at}`).join(','),
      ].join('|'),
    [snapshot],
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function renderPreview() {
      setLoading(true);
      setError(null);
      try {
        const blob = await renderInformePdfBlob(snapshotRef.current);
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo generar la vista previa');
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [renderKey]);

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-100 overflow-hidden shadow-sm min-h-[70vh]">
      {loading && (
        <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Generando vista previa PDF…
        </div>
      )}

      {error && !loading && <div className="p-4 text-sm text-red-800 bg-red-50">{error}</div>}

      {previewUrl && !loading && !error && (
        <iframe
          src={previewUrl}
          title="Vista previa del informe de resultados"
          className="w-full min-h-[70vh] border-0 bg-white"
        />
      )}
    </div>
  );
}
