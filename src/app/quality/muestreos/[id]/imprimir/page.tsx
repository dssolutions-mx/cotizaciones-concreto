'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { EmaVerificacionReportToolbar } from '@/components/ema/EmaVerificacionReportToolbar';
import { InformeEnsayoPdfViewer } from '@/components/quality/informes/InformeEnsayoPdfViewer';
import {
  downloadInformePdf,
  openInformePdfInNewTab,
} from '@/lib/quality/downloadInformePdf';
import type { InformeSnapshot } from '@/types/informe-ensayo';

async function loadInformeForPreview(muestreoId: string): Promise<{
  snapshot: InformeSnapshot;
  emitted: boolean;
}> {
  const informeRes = await fetch(`/api/quality/informes?muestreo_id=${muestreoId}`);
  const informeJson = (await informeRes.json()) as {
    data?: { estado?: string; snapshot_json?: InformeSnapshot };
    error?: string;
  };

  if (informeJson.data?.estado === 'emitido' && informeJson.data.snapshot_json) {
    return { snapshot: informeJson.data.snapshot_json, emitted: true };
  }

  const previewRes = await fetch('/api/quality/informes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'preview', muestreo_id: muestreoId }),
  });
  const previewJson = (await previewRes.json()) as { data?: InformeSnapshot; error?: string };
  if (!previewRes.ok) {
    throw new Error(typeof previewJson.error === 'string' ? previewJson.error : 'No se pudo generar el informe');
  }
  if (!previewJson.data) {
    throw new Error('Sin datos para el informe');
  }
  return { snapshot: previewJson.data, emitted: false };
}

export default function MuestreoInformeImprimirPage() {
  const { id: muestreoId } = useParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<InformeSnapshot | null>(null);
  const [numeroMuestreo, setNumeroMuestreo] = useState<number | null>(null);
  const [emitted, setEmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!muestreoId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { snapshot: snap, emitted: isEmitted } = await loadInformeForPreview(muestreoId);

        if (!cancelled) {
          setSnapshot(snap);
          setEmitted(isEmitted);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error de red');
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [muestreoId]);

  useEffect(() => {
    if (!muestreoId) return;
    let cancelled = false;
    void fetch(`/api/quality/muestreos/${muestreoId}`)
      .then((r) => r.json())
      .then((j: { data?: { numero_muestreo?: number } }) => {
        if (!cancelled && j.data?.numero_muestreo != null) {
          setNumeroMuestreo(j.data.numero_muestreo);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [muestreoId]);

  const backHref = `/quality/muestreos/${muestreoId}`;

  const title = useMemo(() => {
    if (!snapshot) return 'Informe de resultados';
    const doc = snapshot.documento.numero;
    if (doc) return doc;
    const lote = snapshot.estudio_laboratorio?.lote_number;
    if (lote) return `${lote} · M${numeroMuestreo ?? '—'}`;
    return emitted ? 'Informe emitido' : 'Informe de resultados (borrador)';
  }, [snapshot, numeroMuestreo, emitted]);

  const runPdf = useCallback(
    async (mode: 'download' | 'open') => {
      if (!snapshot || !muestreoId) return;
      setPdfBusy(true);
      setPdfError(null);
      try {
        const options = {
          borrador: !emitted,
          numeroMuestreo,
          muestreoId,
        };
        if (mode === 'download') {
          await downloadInformePdf(snapshot, options);
        } else {
          await openInformePdfInNewTab(snapshot, options);
        }
      } catch (e: unknown) {
        setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF');
      } finally {
        setPdfBusy(false);
      }
    },
    [snapshot, muestreoId, emitted, numeroMuestreo],
  );

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-stone-50">
      <EmaVerificacionReportToolbar
        backHref={backHref}
        backLabel="Muestreo"
        title={title}
        downloading={pdfBusy}
        disabled={!snapshot || loading}
        onDownloadPdf={() => runPdf('download')}
        onOpenPdf={() => runPdf('open')}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <p className="text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2">
          Vista previa del PDF del informe de resultados (NMX-EC-17025-IMNC-2018 §7.8 · DC-LC-7.8-01).
          {emitted ? (
            <>
              {' '}
              Documento <strong>emitido</strong> — contenido congelado al momento de la emisión.
            </>
          ) : (
            <>
              {' '}
              <strong>Borrador</strong> — se actualiza con los ensayos y mediciones de campo ya capturados;
              no sustituye el informe oficial con folio y firmas.
            </>
          )}
        </p>

        {pdfError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pdfError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando informe…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-3">
            <p>{error}</p>
            <Link href={backHref} className="text-sm font-medium text-red-900 underline">
              Volver al muestreo
            </Link>
          </div>
        )}

        {snapshot && !loading && !error && <InformeEnsayoPdfViewer snapshot={snapshot} />}
      </div>
    </div>
  );
}
