/**
 * Pure helpers: informe DTO → PDF table rows/columns.
 * Mirrors EmaUncertaintyBudgetTable layout for ISO expediente parity.
 */

import type { UncertaintyComponent } from '@/lib/ema/uncertaintyBudget';
import { pdfFormulaDisplay, pdfSanitizeMetrologyText } from './uncertaintyPdfMetrologyText';

/** A4 portrait usable width (595.28 − 64 pt padding). */
export const PDF_PORTRAIT_TABLE_WIDTH = 531;
/** A4 landscape usable width (841.89 − 48 pt padding). */
export const PDF_LANDSCAPE_TABLE_WIDTH = 794;
/** PdfCard body horizontal padding (8pt × 2) — tables inside cards must subtract this. */
export const PDF_CARD_BODY_H_PADDING = 16;

/** Max width for a table rendered inside a PdfCard (page padding + card body already accounted). */
export function pdfTableWidthInsideCard(landscape: boolean): number {
  const base = landscape ? PDF_LANDSCAPE_TABLE_WIDTH : PDF_PORTRAIT_TABLE_WIDTH;
  return base - PDF_CARD_BODY_H_PADDING;
}

export type PdfTableColumn = {
  key: string;
  label: string;
  widthPt: number;
  align?: 'left' | 'center' | 'right';
  mono?: boolean;
};

export function widthsFromWeights(weights: number[], totalPt: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => totalPt / Math.max(weights.length, 1));
  const raw = weights.map((w) => (w / sum) * totalPt);
  const rounded = raw.map((w) => Math.floor(w));
  let drift = totalPt - rounded.reduce((a, b) => a + b, 0);
  for (let i = 0; drift > 0 && i < rounded.length; i++, drift--) {
    rounded[i] += 1;
  }
  return rounded;
}
import type {
  UncertaintyMeasurand,
  UncertaintyStudy,
  UncertaintyInstrumentTraceabilityRow,
} from '@/types/ema-uncertainty';

export function fmtPdfExp(n: number, digits = 4): string {
  if (n === 0) return '0';
  return n.toExponential(digits);
}

export function fmtPdfFixed(n: number, digits = 4): string {
  return n.toFixed(digits);
}

const CATEGORIA_LABELS: Record<NonNullable<UncertaintyComponent['categoria']>, string> = {
  repeatability: 'Repetibilidad',
  reproducibility: 'Reproducibilidad',
  resolution: 'Resolución',
  calibration: 'Calibración',
  environmental: 'Ambiental',
  method: 'Método',
  systematic: 'Sistemático',
  custom: 'Personalizada',
};

export function categoriaLabel(categoria: UncertaintyComponent['categoria']): string {
  if (!categoria) return '—';
  return CATEGORIA_LABELS[categoria] ?? categoria;
}

export function componentValorDisplay(c: UncertaintyComponent): string {
  const isRectangularB = c.tipo === 'B' && c.distribucion === 'rectangular';
  if (isRectangularB) {
    return `±${fmtPdfFixed(c.u_xi * Math.sqrt(3))}`;
  }
  return fmtPdfFixed(c.valor_xi);
}

export type BudgetPdfRowKind = 'header_a' | 'header_b' | 'component' | 'footer_sum' | 'footer_uc';

export type BudgetPdfRow =
  | { kind: 'header_a' | 'header_b' }
  | { kind: 'component'; cells: string[] }
  | { kind: 'footer_sum' | 'footer_uc'; cells: string[] };

export function buildBudgetPdfColumns(): PdfTableColumn[] {
  const labels = [
    'Fuente',
    'Cat.',
    pdfSanitizeMetrologyText('Xᵢ'),
    pdfSanitizeMetrologyText('xᵢ'),
    pdfSanitizeMetrologyText('u(xᵢ)'),
    'T',
    'Dist.',
    pdfSanitizeMetrologyText('cᵢ'),
    pdfSanitizeMetrologyText('uᵢ(y)'),
    pdfSanitizeMetrologyText('uᵢ²(y)'),
    '%',
    'Fórmula',
    'Norma',
  ];
  const weights = [3.5, 1.4, 1.2, 1.2, 1.3, 0.6, 1.1, 0.9, 1.3, 1.3, 0.9, 2.8, 1.5];
  const widths = widthsFromWeights(weights, PDF_LANDSCAPE_TABLE_WIDTH);
  const aligns: Array<'left' | 'center' | 'right'> = [
    'left',
    'center',
    'left',
    'right',
    'right',
    'center',
    'center',
    'right',
    'right',
    'right',
    'right',
    'left',
    'center',
  ];
  return labels.map((label, i) => ({
    key: `b${i}`,
    label,
    widthPt: widths[i],
    align: aligns[i],
    mono: i >= 2 && i <= 10,
  }));
}

export function buildBudgetPdfRows(
  components: UncertaintyComponent[],
  unit: string,
): BudgetPdfRow[] {
  const sumUi2 = components.reduce((s, c) => s + c.ui2_y, 0) || 1;
  const u_c = Math.sqrt(sumUi2);
  const rows: BudgetPdfRow[] = [];

  const typeA = components.filter((c) => c.tipo === 'A');
  const typeB = components.filter((c) => c.tipo === 'B');

  if (typeA.length > 0) {
    rows.push({ kind: 'header_a' });
    for (const c of typeA) {
      rows.push({ kind: 'component', cells: componentToCells(c, sumUi2) });
    }
  }
  if (typeB.length > 0) {
    rows.push({ kind: 'header_b' });
    for (const c of typeB) {
      rows.push({ kind: 'component', cells: componentToCells(c, sumUi2) });
    }
  }

  const unitPdf = pdfSanitizeMetrologyText(unit);
  rows.push({
    kind: 'footer_sum',
    cells: ['', '', '', '', '', '', '', '', 'Sum u_i^2(y)', fmtPdfExp(sumUi2), '', '', `(${unitPdf})^2`],
  });
  rows.push({
    kind: 'footer_uc',
    cells: ['', '', '', '', '', '', '', '', 'u_c', fmtPdfExp(u_c), '', '', unitPdf],
  });

  return rows;
}

function componentToCells(c: UncertaintyComponent, sumUi2: number): string[] {
  const contribPct = (100 * c.ui2_y) / sumUi2;
  const formula = pdfFormulaDisplay(c.formula_display ?? '');
  return [
    pdfSanitizeMetrologyText(c.fuente),
    categoriaLabel(c.categoria),
    pdfSanitizeMetrologyText(c.magnitud_xi),
    componentValorDisplay(c),
    fmtPdfExp(c.u_xi),
    c.tipo,
    c.distribucion,
    fmtPdfFixed(c.ci),
    fmtPdfExp(c.ui_y),
    fmtPdfExp(c.ui2_y),
    contribPct.toFixed(1),
    formula || '—',
    c.ref_norma || '—',
  ];
}

export function buildTraceabilityPdfColumns(): PdfTableColumn[] {
  const labels = ['Código', 'Denominación', 'Rol', 'Fuente', 'Cert. / registro', 'U', 'k', 'Unidad', 'Vigencia'];
  const weights = [2, 4, 1.5, 2.5, 2.5, 1.2, 0.8, 1.2, 2];
  const widths = widthsFromWeights(weights, PDF_PORTRAIT_TABLE_WIDTH);
  return labels.map((label, i) => ({
    key: `t${i}`,
    label,
    widthPt: widths[i],
    align: i === 5 || i === 6 ? 'right' : 'left',
    mono: i === 0 || i === 4 || i === 5 || i === 6 || i === 8,
  }));
}

export function buildTraceabilityPdfRows(
  rows: UncertaintyInstrumentTraceabilityRow[],
): string[][] {
  return rows.map((r) => [
    r.codigo,
    r.nombre,
    r.rol ?? '—',
    r.fuente,
    r.numero_certificado ?? '—',
    r.u_expandida,
    r.k_factor,
    r.unidad,
    r.vigencia,
  ]);
}

export function studyShortId(studyId: string): string {
  return `UNC-${studyId.slice(0, 8).toUpperCase()}`;
}

export function formatStudyEstado(estado: UncertaintyStudy['estado']): string {
  const map: Record<UncertaintyStudy['estado'], string> = {
    borrador: 'Borrador',
    publicado: 'Publicado',
    reemplazado: 'Reemplazado',
  };
  return map[estado] ?? estado;
}

export function formatExcludedInputs(
  measurand: UncertaintyMeasurand,
  excluded: string[] | null | undefined,
): string {
  if (!excluded?.length) return 'Ninguna';
  const names = excluded
    .map((sym) => measurand.inputs?.find((i) => i.simbolo === sym)?.nombre_display ?? sym)
    .join('; ');
  return names;
}

export function formatEnvOverridesSummary(
  overrides: Record<string, number> | null | undefined,
): string {
  if (!overrides || Object.keys(overrides).length === 0) return 'Valores por defecto del catálogo';
  return Object.entries(overrides)
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ');
}

export function uniqueNormRefsFromComponents(components: UncertaintyComponent[]): string[] {
  const refs = new Set<string>();
  for (const c of components) {
    if (c.ref_norma?.trim()) refs.add(c.ref_norma.trim());
  }
  return [...refs].sort((a, b) => a.localeCompare(b, 'es'));
}

export function assertInformeExportAllowed(estado: UncertaintyStudy['estado']): boolean {
  return estado === 'publicado';
}
