/**
 * Réplica table builders for the uncertainty informe PDF.
 * Mirrors EmaUncertaintyReplicaTable: per-role instrument columns, derived FC fields.
 */

import {
  MEASURAND_INSTRUMENT_ROLES,
  replicaInformeColumns,
  resolveReplicaInformeCellValue,
} from '@/lib/ema/uncertaintyMeasurand';
import { parseVigasStudyConfig } from '@/lib/ema/vigasFlexureModel';
import type { PdfTableColumn } from '@/lib/ema/uncertaintyInformePdfModel';
import {
  PDF_LANDSCAPE_TABLE_WIDTH,
  PDF_PORTRAIT_TABLE_WIDTH,
  fmtPdfFixed,
  widthsFromWeights,
} from '@/lib/ema/uncertaintyInformePdfModel';
import type {
  MeasurandCodigo,
  UncertaintyMeasurand,
  UncertaintyStudy,
  UncertaintyStudyReplica,
} from '@/types/ema-uncertainty';

export type ReplicaPdfInformeContext = {
  study: Pick<UncertaintyStudy, 'excluded_input_simbolos' | 'env_overrides' | 'replicas'>;
  measurand: UncertaintyMeasurand;
  instrument_lookup: Record<string, { codigo: string; nombre: string }>;
};

function measurandRoles(measurand: UncertaintyMeasurand) {
  return MEASURAND_INSTRUMENT_ROLES[measurand.codigo as MeasurandCodigo] ?? null;
}

function usesRoleInstrumentColumns(measurand: UncertaintyMeasurand): boolean {
  const roles = measurandRoles(measurand);
  return !!(roles && roles.length > 1);
}

function formatInstrumentCell(
  id: string | null | undefined,
  lookup: Record<string, { codigo: string; nombre: string }>,
  joined?: { codigo: string; nombre: string } | null,
): string {
  if (!id) return '—';
  const ref = joined ?? lookup[id];
  if (!ref) return id.slice(0, 8);
  return `${ref.codigo}`;
}

function resolveReplicaInstrumentId(
  replica: UncertaintyStudyReplica,
  roleKey: string,
  roleIndex: number,
): string | null {
  if (roleIndex === 0) return replica.instrumento_id;
  const raw = replica.raw_values_json ?? {};
  const v = raw[`_instr_${roleKey}`];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Use landscape when many instrument + input columns (FC, FC_CUBO, VIGAS). */
export function replicaSectionUsesLandscape(ctx: ReplicaPdfInformeContext): boolean {
  if (usesRoleInstrumentColumns(ctx.measurand)) return true;
  const inputCount = replicaInformeColumns(
    ctx.measurand,
    ctx.study.excluded_input_simbolos,
  ).length;
  return inputCount >= 5;
}

export function buildReplicaPdfColumns(ctx: ReplicaPdfInformeContext): PdfTableColumn[] {
  const { measurand, study } = ctx;
  const roles = measurandRoles(measurand);
  const showRoles = usesRoleInstrumentColumns(measurand);
  const inputCols = replicaInformeColumns(measurand, study.excluded_input_simbolos);

  const instrumentLabels = showRoles
    ? (roles ?? []).map((r) => r.label)
    : ['Instrumento'];

  const labels = [
    '#',
    'Operador',
    ...instrumentLabels,
    ...inputCols.map((c) => `${c.label} (${c.unidad})`),
    measurand.nombre,
  ];
  const weights = [
    0.5,
    2.2,
    ...instrumentLabels.map(() => (showRoles ? 2.4 : 2)),
    ...inputCols.map(() => 1.2),
    1.4,
  ];
  const tableWidth = replicaSectionUsesLandscape(ctx)
    ? PDF_LANDSCAPE_TABLE_WIDTH
    : PDF_PORTRAIT_TABLE_WIDTH;
  const widths = widthsFromWeights(weights, tableWidth);

  return labels.map((label, i) => ({
    key: `r${i}`,
    label:
      i === labels.length - 1
        ? `${measurand.nombre} (${measurand.unidad})`
        : label,
    widthPt: widths[i],
    align: i === 0 ? 'center' : i >= 2 + instrumentLabels.length ? 'right' : 'left',
    mono: i >= 2 + instrumentLabels.length,
  }));
}

export function buildReplicaPdfRows(ctx: ReplicaPdfInformeContext): string[][] {
  const { measurand, study, instrument_lookup } = ctx;
  const replicaList = study.replicas ?? [];
  const roles = measurandRoles(measurand);
  const showRoles = usesRoleInstrumentColumns(measurand);
  const inputCols = replicaInformeColumns(measurand, study.excluded_input_simbolos);
  const vigasConfig =
    measurand.codigo === 'VIGAS'
      ? parseVigasStudyConfig((study.env_overrides as Record<string, number> | null) ?? null)
      : undefined;

  const sorted = [...replicaList].sort((a, b) => a.orden - b.orden);

  return sorted.map((r) => {
    const op = r.operator?.full_name ?? r.operator?.email ?? '—';
    const raw = r.raw_values_json ?? {};

    const instrumentCells = showRoles
      ? (roles ?? []).map((role, idx) => {
          const id = resolveReplicaInstrumentId(r, role.key, idx);
          const joined =
            idx === 0 && r.instrumento_id === id ? r.instrumento ?? null : null;
          return formatInstrumentCell(id, instrument_lookup, joined);
        })
      : [formatInstrumentCell(r.instrumento_id, instrument_lookup, r.instrumento ?? null)];

    const inputCells = inputCols.map((col) =>
      resolveReplicaInformeCellValue(measurand, col.simbolo, raw, { vigasConfig }),
    );

    const yDisplay =
      r.computed_value != null && Number.isFinite(r.computed_value)
        ? fmtPdfFixed(r.computed_value, 4)
        : '—';

    return [String(r.orden), op, ...instrumentCells, ...inputCells, yDisplay];
  });
}
