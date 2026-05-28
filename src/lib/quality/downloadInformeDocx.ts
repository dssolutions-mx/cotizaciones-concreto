'use client';

import { buildInformeDocxDocument } from '@/lib/quality/informeDocx/buildInformeDocx';
import { buildInformePdfFilename } from '@/lib/quality/downloadInformePdf';
import type { InformeSnapshot } from '@/types/informe-ensayo';

export function buildInformeDocxFilename(
  snapshot: InformeSnapshot,
  options?: { numeroMuestreo?: number | null; muestreoId?: string; borrador?: boolean },
): string {
  return buildInformePdfFilename(snapshot, options).replace(/\.pdf$/i, '.docx');
}

export async function renderInformeDocxBlob(snapshot: InformeSnapshot): Promise<Blob> {
  const { Packer } = await import('docx');
  const document = await buildInformeDocxDocument(snapshot);
  return Packer.toBlob(document);
}

export async function downloadInformeDocx(
  snapshot: InformeSnapshot,
  options?: { filename?: string; borrador?: boolean; numeroMuestreo?: number | null; muestreoId?: string },
): Promise<void> {
  const blob = await renderInformeDocxBlob(snapshot);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    options?.filename ??
    buildInformeDocxFilename(snapshot, {
      borrador: options?.borrador,
      numeroMuestreo: options?.numeroMuestreo,
      muestreoId: options?.muestreoId,
    });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
