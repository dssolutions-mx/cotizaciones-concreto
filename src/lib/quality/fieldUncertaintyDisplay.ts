import type { MeasurandCodigo } from '@/types/ema-uncertainty';
import type { MuestreoFieldMeasurandCodigo } from '@/types/muestreoFieldMeasurement';
import { formatUncertaintyDisplay } from '@/lib/quality/informeConformidad';

const FIELD_TO_EMA: Partial<Record<MuestreoFieldMeasurandCodigo, MeasurandCodigo>> = {
  REV: 'REV',
  TEMP: 'TEMP',
  MU: 'MU',
  AIRE: 'AIRE',
};

export type PublishedUncertaintyRow = {
  measurand?: { codigo?: string };
  u_expandida?: number;
  k_factor?: number;
  unidad?: string;
};

export function uncertaintyDisplayByFieldCodigo(
  published: PublishedUncertaintyRow[],
): Map<MuestreoFieldMeasurandCodigo, string> {
  const byCodigo = new Map<string, PublishedUncertaintyRow>();
  for (const row of published) {
    const c = row.measurand?.codigo;
    if (c) byCodigo.set(c, row);
  }

  const out = new Map<MuestreoFieldMeasurandCodigo, string>();
  for (const [field, ema] of Object.entries(FIELD_TO_EMA) as [MuestreoFieldMeasurandCodigo, MeasurandCodigo][]) {
    const row = byCodigo.get(ema);
    if (!row || row.u_expandida == null) continue;
    const k = Number(row.k_factor) || 2;
    out.set(field, formatUncertaintyDisplay(Number(row.u_expandida), row.unidad ?? '', k));
  }
  return out;
}
