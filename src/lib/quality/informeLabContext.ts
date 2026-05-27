import { PROTOCOL_TYPE_LABELS, type LaboratorioProtocolType } from '../../types/laboratorioLote';
import type { InformeSnapshot } from '../../types/informe-ensayo';

export const INFORME_METODO_COMPRESION = 'NMX-C-155-ONNCCE-2017';

export function isInformeLabExperiment(
  snapshot: Partial<Pick<InformeSnapshot, 'contexto' | 'estudio_laboratorio'>>
): boolean {
  if (snapshot.contexto === 'laboratorio_interno') return true;
  if (snapshot.contexto === 'obra') return false;
  return !!snapshot.estudio_laboratorio?.lote_number;
}

export function protocolTypeLabel(protocolType: string | null | undefined): string | null {
  if (!protocolType) return null;
  return PROTOCOL_TYPE_LABELS[protocolType as LaboratorioProtocolType] ?? protocolType;
}

export function formatEdadEspecificada(
  ageDays: number | null | undefined,
  ageHours: number | null | undefined
): string | null {
  if (ageHours != null && ageHours > 0) return `${ageHours} h`;
  if (ageDays != null && ageDays > 0) return `${ageDays} d`;
  return null;
}

export const INFORME_LEGAL_LAB: string[] = [
  'Ensayo realizado en el marco de un estudio interno de I+D del laboratorio; no constituye certificación de obra ni entrega comercial de concreto.',
  'La muestra fue elaborada y curada conforme al protocolo interno del lote de experimento y a los procedimientos del laboratorio acreditado.',
];

export const INFORME_FRESH_NA_LAB =
  'No aplica — el muestreo corresponde a elaboración en instalaciones del laboratorio (experimento interno). Los ensayos de campo (NMX-C-161) no forman parte del alcance de este informe.';
