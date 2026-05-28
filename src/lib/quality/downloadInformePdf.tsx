'use client';

import { registerEmaPdfFonts } from '@/lib/reports/registerEmaPdfFonts';
import type { InformeSnapshot } from '@/types/informe-ensayo';

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 48);
}

export function buildInformePdfFilename(
  snapshot: InformeSnapshot,
  options?: { numeroMuestreo?: number | null; muestreoId?: string; borrador?: boolean },
): string {
  const loteRef = snapshot.estudio_laboratorio?.lote_number;
  const base =
    snapshot.documento.numero ??
    (loteRef
      ? `${sanitizeFilenamePart(loteRef)}-M${options?.numeroMuestreo ?? 0}`
      : `muestreo-${options?.numeroMuestreo ?? options?.muestreoId?.slice(0, 8) ?? 'draft'}`);
  return options?.borrador ? `${base}-borrador.pdf` : `${base}.pdf`;
}

export async function downloadInformePdf(
  snapshot: InformeSnapshot,
  options?: { filename?: string; borrador?: boolean; numeroMuestreo?: number | null; muestreoId?: string },
): Promise<void> {
  registerEmaPdfFonts();

  const [{ pdf }, { InformeResultadosPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/quality/informes/InformeResultadosPDF'),
  ]);

  const blob = await pdf(<InformeResultadosPDF snapshot={snapshot} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    options?.filename ??
    buildInformePdfFilename(snapshot, {
      borrador: options?.borrador,
      numeroMuestreo: options?.numeroMuestreo,
      muestreoId: options?.muestreoId,
    });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
