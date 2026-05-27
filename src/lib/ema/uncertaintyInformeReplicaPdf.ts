/**
 * Réplica table builders for the uncertainty informe PDF.
 * Resolves derived FC fields (dprom, A) from d1+d2 like the workspace grid.
 */

import {
  replicaInformeColumns,
  resolveReplicaInformeCellValue,
} from '@/lib/ema/uncertaintyMeasurand';
import { parseVigasStudyConfig } from '@/lib/ema/vigasFlexureModel';
import type { PdfTableColumn } from '@/lib/ema/uncertaintyInformePdfModel';
import {
  PDF_PORTRAIT_TABLE_WIDTH,
  fmtPdfFixed,
  widthsFromWeights,
} from '@/lib/ema/uncertaintyInformePdfModel';
import type {
  UncertaintyMeasurand,
  UncertaintyStudy,
  UncertaintyStudyReplica,
} from '@/types/ema-uncertainty';

export type ReplicaPdfStudyContext = Pick<
  UncertaintyStudy,
  'excluded_input_simbolos' | 'env_overrides'
>;

export function buildReplicaPdfColumns(
  measurand: UncertaintyMeasurand,
  study?: ReplicaPdfStudyContext,
): PdfTableColumn[] {
  const inputCols = replicaInformeColumns(measurand, study?.excluded_input_simbolos);
  const labels = [
    '#',
    'Operador',
    'Instrumento',
    ...inputCols.map((c) => `${c.label} (${c.unidad})`),
    measurand.nombre,
  ];
  const weights = [0.6, 2.5, 2.2, ...inputCols.map(() => 1.4), 1.6];
  const widths = widthsFromWeights(weights, PDF_PORTRAIT_TABLE_WIDTH);
  return labels.map((label, i) => ({
    key: `r${i}`,
    label: i === labels.length - 1 ? `${label} (${measurand.unidad})` : label,
    widthPt: widths[i],
    align: i === 0 ? 'center' : i >= 3 ? 'right' : 'left',
    mono: i >= 3,
  }));
}

export function buildReplicaPdfRows(
  replicas: UncertaintyStudyReplica[],
  measurand: UncertaintyMeasurand,
  study?: ReplicaPdfStudyContext,
): string[][] {
  const inputCols = replicaInformeColumns(measurand, study?.excluded_input_simbolos);
  const vigasConfig =
    measurand.codigo === 'VIGAS'
      ? parseVigasStudyConfig((study?.env_overrides as Record<string, number> | null) ?? null)
      : undefined;
  const sorted = [...replicas].sort((a, b) => a.orden - b.orden);

  return sorted.map((r) => {
    const op = r.operator?.full_name ?? r.operator?.email ?? '—';
    const inst = r.instrumento ? `${r.instrumento.codigo}` : '—';
    const raw = r.raw_values_json ?? {};
    const inputCells = inputCols.map((col) =>
      resolveReplicaInformeCellValue(measurand, col.simbolo, raw, { vigasConfig }),
    );
    const yDisplay =
      r.computed_value != null && Number.isFinite(r.computed_value)
        ? fmtPdfFixed(r.computed_value, 4)
        : '—';
    return [String(r.orden), op, inst, ...inputCells, yDisplay];
  });
}
