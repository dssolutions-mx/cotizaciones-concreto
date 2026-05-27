import type {
  MuestreoFieldMeasurandCodigo,
  MuestreoMedicionCampo,
  MuestreoMedicionCampoInput,
} from '@/types/muestreoFieldMeasurement';

export type MeasurandMeta = {
  codigo: MuestreoFieldMeasurandCodigo;
  label: string;
  unidad: string;
  muestreoColumn:
    | 'revenimiento_sitio'
    | 'temperatura_concreto'
    | 'masa_unitaria'
    | 'contenido_aire'
    | 'temperatura_ambiente';
  decimals: number;
};

export const MEASURAND_META: Record<MuestreoFieldMeasurandCodigo, MeasurandMeta> = {
  REV: {
    codigo: 'REV',
    label: 'Revenimiento',
    unidad: 'mm',
    muestreoColumn: 'revenimiento_sitio',
    decimals: 1,
  },
  TEMP: {
    codigo: 'TEMP',
    label: 'Temperatura del concreto',
    unidad: '°C',
    muestreoColumn: 'temperatura_concreto',
    decimals: 1,
  },
  MU: {
    codigo: 'MU',
    label: 'Masa unitaria',
    unidad: 'kg/m³',
    muestreoColumn: 'masa_unitaria',
    decimals: 0,
  },
  AIRE: {
    codigo: 'AIRE',
    label: 'Contenido de aire',
    unidad: '%',
    muestreoColumn: 'contenido_aire',
    decimals: 1,
  },
  TEMP_AMB: {
    codigo: 'TEMP_AMB',
    label: 'Temperatura ambiente',
    unidad: '°C',
    muestreoColumn: 'temperatura_ambiente',
    decimals: 1,
  },
};

export const FIELD_MEASURAND_ORDER: MuestreoFieldMeasurandCodigo[] = [
  'REV',
  'TEMP',
  'MU',
  'AIRE',
  'TEMP_AMB',
];

export function isValidMeasurandCodigo(c: string): c is MuestreoFieldMeasurandCodigo {
  return c in MEASURAND_META;
}

export function roundMeasurandAverage(
  codigo: MuestreoFieldMeasurandCodigo,
  values: number[]
): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const decimals = MEASURAND_META[codigo].decimals;
  const factor = 10 ** decimals;
  return Math.round(avg * factor) / factor;
}

export function computeScalarPatchFromMediciones(
  rows: Pick<MuestreoMedicionCampoInput, 'measurand_codigo' | 'valor'>[]
): Partial<Record<MeasurandMeta['muestreoColumn'], number | null>> {
  const byCodigo = new Map<MuestreoFieldMeasurandCodigo, number[]>();
  for (const row of rows) {
    if (!isValidMeasurandCodigo(row.measurand_codigo)) continue;
    const v = Number(row.valor);
    if (!Number.isFinite(v)) continue;
    const list = byCodigo.get(row.measurand_codigo) ?? [];
    list.push(v);
    byCodigo.set(row.measurand_codigo, list);
  }

  const patch: Partial<Record<MeasurandMeta['muestreoColumn'], number | null>> = {
    revenimiento_sitio: null,
    temperatura_concreto: null,
    masa_unitaria: null,
    contenido_aire: null,
    temperatura_ambiente: null,
  };

  for (const codigo of FIELD_MEASURAND_ORDER) {
    const meta = MEASURAND_META[codigo];
    const values = byCodigo.get(codigo);
    patch[meta.muestreoColumn] =
      values && values.length > 0 ? roundMeasurandAverage(codigo, values) : null;
  }

  return patch;
}

export function normalizeMedicionInputs(
  rows: MuestreoMedicionCampoInput[]
): MuestreoMedicionCampoInput[] {
  const counters = new Map<MuestreoFieldMeasurandCodigo, number>();
  return rows
    .filter((r) => isValidMeasurandCodigo(r.measurand_codigo) && Number.isFinite(Number(r.valor)))
    .map((r) => {
      const codigo = r.measurand_codigo;
      const next = (counters.get(codigo) ?? 0) + 1;
      counters.set(codigo, next);
      const meta = MEASURAND_META[codigo];
      return {
        measurand_codigo: codigo,
        secuencia: r.secuencia > 0 ? r.secuencia : next,
        motivo: r.motivo?.trim() || null,
        valor: Number(r.valor),
        unidad: r.unidad?.trim() || meta.unidad,
        notas: r.notas?.trim() || null,
      };
    });
}

export function groupMedicionesByMeasurand(
  rows: MuestreoMedicionCampo[]
): Map<MuestreoFieldMeasurandCodigo, MuestreoMedicionCampo[]> {
  const map = new Map<MuestreoFieldMeasurandCodigo, MuestreoMedicionCampo[]>();
  for (const row of [...rows].sort((a, b) => {
    const ai = FIELD_MEASURAND_ORDER.indexOf(a.measurand_codigo);
    const bi = FIELD_MEASURAND_ORDER.indexOf(b.measurand_codigo);
    if (ai !== bi) return ai - bi;
    return a.secuencia - b.secuencia;
  })) {
    const list = map.get(row.measurand_codigo) ?? [];
    list.push(row);
    map.set(row.measurand_codigo, list);
  }
  return map;
}

export function scalarsToMedicionInputs(scalars: {
  revenimiento_sitio?: number | null;
  temperatura_concreto?: number | null;
  masa_unitaria?: number | null;
  contenido_aire?: number | null;
  temperatura_ambiente?: number | null;
}): MuestreoMedicionCampoInput[] {
  const out: MuestreoMedicionCampoInput[] = [];
  for (const codigo of FIELD_MEASURAND_ORDER) {
    const meta = MEASURAND_META[codigo];
    const v = scalars[meta.muestreoColumn];
    if (v != null && Number.isFinite(Number(v))) {
      out.push({
        measurand_codigo: codigo,
        secuencia: 1,
        valor: Number(v),
        unidad: meta.unidad,
      });
    }
  }
  return out;
}
