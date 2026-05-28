import type { InformeFirmaRol } from '@/types/informe-ensayo';

export const INFORME_FIRMA_LABELS: Record<InformeFirmaRol, { title: string; subtitle: string }> = {
  elaboro: { title: 'Elaboró', subtitle: 'Responsable de la emisión' },
  reviso: { title: 'Revisó', subtitle: 'Revisión técnica' },
  autorizo: { title: 'Autorizó', subtitle: 'Autorización del informe' },
};

export const INFORME_DOCX_LEGAL = [
  'Este informe de resultados de ensayo se emite conforme a la NMX-EC-17025-IMNC-2018 §7.8 y al procedimiento interno del laboratorio acreditado.',
  'Los resultados se refieren exclusivamente a las muestras y ensayos identificados en este documento. La incertidumbre de medición declarada proviene de estudios publicados en el sistema de gestión metrológica del laboratorio.',
  'Documento controlado generado por el sistema de gestión de calidad del laboratorio. Reproducciones no controladas pueden no reflejar el estado vigente del registro.',
];

export function formatInformeIssuedAt(issuedAt: string | null): string {
  if (!issuedAt) return 'Borrador — sin emitir';
  try {
    return new Date(issuedAt).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return issuedAt;
  }
}

export function formatInformeSignedAt(signedAt: string | null): string {
  if (!signedAt) return '';
  try {
    return new Date(signedAt).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return signedAt;
  }
}

export function buildMuestreoCondicionesText(snapshot: {
  muestreo: {
    temperatura_ambiente: number | null;
    humedad_relativa_obra: number | null;
    condiciones_climaticas: string | null;
  };
  isLab: boolean;
}): string {
  const parts = [
    snapshot.muestreo.temperatura_ambiente != null
      ? `T amb. ${snapshot.muestreo.temperatura_ambiente} °C`
      : null,
    snapshot.muestreo.humedad_relativa_obra != null
      ? `HR ${snapshot.muestreo.humedad_relativa_obra} %`
      : null,
    snapshot.muestreo.condiciones_climaticas,
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(' · ');
  return snapshot.isLab ? 'Instalaciones del laboratorio' : '—';
}
