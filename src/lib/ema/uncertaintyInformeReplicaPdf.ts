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
  fmtPdfFixed,
  pdfTableWidthInsideCard,
} from '@/lib/ema/uncertaintyInformePdfModel';
import type { ReplicaInformeColumn } from '@/lib/ema/uncertaintyMeasurand';
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

export function replicaPdfTableWidth(ctx: ReplicaPdfInformeContext): number {
  return pdfTableWidthInsideCard(replicaSectionUsesLandscape(ctx));
}

/** Short PDF headers (wrap on two lines); full names remain in §3 equipo. */
const PDF_INSTRUMENT_HEADER: Record<string, string> = {
  carga: 'Prensa',
  diametro: 'Vernier',
  flexion: 'Mód. flex.',
};

const PDF_INPUT_HEADER_SHORT: Record<string, string> = {
  Carga: 'Carga máx.',
  carga: 'Carga máx.',
  d1: 'Ø₁',
  d2: 'Ø₂',
  dprom: 'Ø prom.',
  d: 'Ø prom.',
  A: 'Área',
  a: 'Área',
  L1: 'L₁',
  L2: 'L₂',
  L: 'Luz',
  P: 'Carga máx.',
};

function pdfInstrumentHeader(roleKey: string, fallback: string): string {
  return PDF_INSTRUMENT_HEADER[roleKey] ?? fallback.split('—')[0]?.trim() ?? fallback;
}

function pdfInputHeader(col: ReplicaInformeColumn): string {
  const short = PDF_INPUT_HEADER_SHORT[col.simbolo] ?? col.label;
  return `${short}\n(${col.unidad})`;
}

function pdfResultHeader(measurand: UncertaintyMeasurand): string {
  if (measurand.codigo === 'FC' || measurand.codigo === 'FC_CUBO') {
    return `f'c\n(${measurand.unidad})`;
  }
  if (measurand.codigo === 'VIGAS') {
    return `MR\n(${measurand.unidad})`;
  }
  const name =
    measurand.nombre.length > 14 ? measurand.codigo : measurand.nombre;
  return `${name}\n(${measurand.unidad})`;
}

/**
 * Fixed narrow columns for IDs; remaining width split across numeric readings.
 */
function allocateReplicaColumnWidths(
  tableWidth: number,
  instrumentCount: number,
  numericCount: number,
): { hash: number; operator: number; instrument: number; numeric: number } {
  const hash = 18;
  const operator = 62;
  const instrument = instrumentCount > 0 ? 48 : 0;
  const fixed = hash + operator + instrumentCount * instrument;
  const numericEach = Math.max(
    44,
    Math.floor((tableWidth - fixed) / Math.max(numericCount, 1)),
  );
  let total = fixed + numericEach * numericCount;
  if (total > tableWidth) {
    const shrink = total - tableWidth;
    const perInstr = Math.min(
      instrument,
      Math.floor(shrink / Math.max(instrumentCount, 1)),
    );
    return {
      hash,
      operator,
      instrument: instrument - perInstr,
      numeric: numericEach,
    };
  }
  if (total < tableWidth) {
    return {
      hash,
      operator,
      instrument,
      numeric: numericEach + Math.floor((tableWidth - total) / numericCount),
    };
  }
  return { hash, operator, instrument, numeric: numericEach };
}

export function buildReplicaPdfColumns(ctx: ReplicaPdfInformeContext): PdfTableColumn[] {
  const { measurand, study } = ctx;
  const roles = measurandRoles(measurand);
  const showRoles = usesRoleInstrumentColumns(measurand);
  const inputCols = replicaInformeColumns(measurand, study.excluded_input_simbolos);
  const instrumentCount = showRoles ? (roles?.length ?? 0) : 1;
  const numericCount = inputCols.length + 1;
  const tableWidth = replicaPdfTableWidth(ctx);
  const widths = allocateReplicaColumnWidths(
    tableWidth,
    instrumentCount,
    numericCount,
  );

  const headerLabels: string[] = [
    '#',
    'Operador',
    ...(showRoles
      ? (roles ?? []).map((r) => pdfInstrumentHeader(r.key, r.label))
      : ['Instrumento']),
    ...inputCols.map(pdfInputHeader),
    pdfResultHeader(measurand),
  ];

  const widthPts: number[] = [
    widths.hash,
    widths.operator,
    ...Array.from({ length: instrumentCount }, () => widths.instrument),
    ...Array.from({ length: numericCount }, () => widths.numeric),
  ];

  const firstNumericIdx = 2 + instrumentCount;

  return headerLabels.map((label, i) => ({
    key: `r${i}`,
    label,
    widthPt: widthPts[i] ?? widths.numeric,
    align: i === 0 ? 'center' : i >= firstNumericIdx ? 'right' : 'left',
    mono: i >= firstNumericIdx,
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
