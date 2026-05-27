import { conformidadRevenimiento, parseTolerancias, type InformeTolerancias } from './informeConformidad';
import {
  FIELD_MEASURAND_ORDER,
  groupMedicionesByMeasurand,
  MEASURAND_META,
  roundMeasurandAverage,
} from './muestreoFieldMeasurements';
import type { InformeUncertaintyEntry, InformeFreshResultRow } from '../../types/informe-ensayo';
import type { MuestreoFieldMeasurandCodigo, MuestreoMedicionCampo } from '../../types/muestreoFieldMeasurement';

const METODO_CAMPO = 'NMX-C-161-ONNCCE-2013';

const UNCERTAINTY_CODIGO: Partial<Record<MuestreoFieldMeasurandCodigo, string>> = {
  REV: 'REV',
  TEMP: 'TEMP',
  MU: 'MU',
  AIRE: 'AIRE',
};

type BuildFreshOpts = {
  mediciones: MuestreoMedicionCampo[];
  scalars: {
    revenimiento_sitio: number | null;
    temperatura_concreto: number | null;
    masa_unitaria: number | null;
    contenido_aire: number | null;
    temperatura_ambiente: number | null;
  };
  slump: number | null;
  tolerancias?: InformeTolerancias;
  isLabExperiment: boolean;
  freshUncertainty: (codigo: string) => InformeUncertaintyEntry | undefined;
};

function formatValor(valor: number, unidad: string): string {
  return `${valor} ${unidad}`.trim();
}

function lecturaLabel(m: MuestreoMedicionCampo): string {
  return m.motivo?.trim() || `Lectura ${m.secuencia}`;
}

function especificadoFor(codigo: MuestreoFieldMeasurandCodigo, slump: number | null): string {
  if (codigo === 'REV' && slump != null) return `${slump} mm`;
  return 'N/A';
}

function conformidadRevPromedio(
  isLabExperiment: boolean,
  valor: number,
  slump: number | null,
  tolerancias: InformeTolerancias
): 'C' | 'NC' | 'N/A' {
  if (isLabExperiment) return 'N/A';
  return conformidadRevenimiento(valor, slump, tolerancias);
}

export function buildInformeFreshRows(opts: BuildFreshOpts): InformeFreshResultRow[] {
  const tolerancias = opts.tolerancias ?? parseTolerancias(null);
  const grouped = groupMedicionesByMeasurand(opts.mediciones);
  const freshRows: InformeFreshResultRow[] = [];

  for (const codigo of FIELD_MEASURAND_ORDER) {
    const meta = MEASURAND_META[codigo];
    const rows = grouped.get(codigo) ?? [];
    const scalarVal = opts.scalars[meta.muestreoColumn];
    const uKey = UNCERTAINTY_CODIGO[codigo];

    if (rows.length > 1) {
      const values = rows.map((r) => Number(r.valor));
      const valorParaConformidad =
        scalarVal ?? roundMeasurandAverage(codigo, values);
      const revConformidadUltima =
        codigo === 'REV' && valorParaConformidad != null
          ? conformidadRevPromedio(
              opts.isLabExperiment,
              valorParaConformidad,
              opts.slump,
              tolerancias,
            )
          : 'N/A';

      rows.forEach((m, index) => {
        const isLast = index === rows.length - 1;
        freshRows.push({
          ensayo: meta.label,
          metodo: METODO_CAMPO,
          resultado: formatValor(Number(m.valor), m.unidad),
          especificado: especificadoFor(codigo, opts.slump),
          conformidad:
            codigo === 'REV' && isLast && !opts.isLabExperiment ? revConformidadUltima : 'N/A',
          lectura: lecturaLabel(m),
          uncertainty: isLast && uKey ? opts.freshUncertainty(uKey) : undefined,
        });
      });
      continue;
    }

    if (rows.length === 1) {
      const m = rows[0];
      const v = Number(m.valor);
      freshRows.push({
        ensayo: meta.label,
        metodo: METODO_CAMPO,
        resultado: formatValor(v, m.unidad),
        especificado: especificadoFor(codigo, opts.slump),
        conformidad:
          codigo === 'REV'
            ? conformidadRevPromedio(opts.isLabExperiment, v, opts.slump, tolerancias)
            : 'N/A',
        lectura: lecturaLabel(m),
        uncertainty: uKey ? opts.freshUncertainty(uKey) : undefined,
      });
      continue;
    }

    if (scalarVal != null) {
      freshRows.push({
        ensayo: meta.label,
        metodo: METODO_CAMPO,
        resultado: formatValor(scalarVal, meta.unidad),
        especificado: especificadoFor(codigo, opts.slump),
        conformidad:
          codigo === 'REV'
            ? conformidadRevPromedio(opts.isLabExperiment, scalarVal, opts.slump, tolerancias)
            : 'N/A',
        uncertainty: uKey ? opts.freshUncertainty(uKey) : undefined,
      });
    }
  }

  return freshRows;
}
