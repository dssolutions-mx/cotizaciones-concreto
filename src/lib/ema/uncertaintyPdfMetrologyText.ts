/**
 * GUM / metrology strings for EMA uncertainty PDFs.
 * Requires DejaVu Sans (see registerEmaPdfFonts) — do not strip √, ν, subscripts, etc.
 */

export const PDF_X_MEDIA = 'x̄';
export const PDF_NU_EFF = 'ν_eff';

export function pdfFormatNuEffValue(nu_eff: number): string {
  return Number.isFinite(nu_eff) ? nu_eff.toFixed(1) : '∞';
}

/** Light normalization only; preserves ISO/GUM typography. */
export function pdfMetrologyPdfText(text: string): string {
  return text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
}

/** @deprecated Use pdfMetrologyPdfText — name kept for existing imports. */
export const pdfSanitizeMetrologyText = pdfMetrologyPdfText;

/** Presupuesto “Fórmula” column — trim length without ASCII transliteration. */
export function pdfFormulaDisplay(text: string, maxLen = 80): string {
  const t = pdfMetrologyPdfText(text);
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
