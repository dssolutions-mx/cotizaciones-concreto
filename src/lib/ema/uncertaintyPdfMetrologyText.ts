/**
 * ASCII-safe GUM / metrology strings for @react-pdf/renderer (Helvetica).
 * Unicode ν, subscripts, and x̄ often overlap or fail to render in PDF output.
 */

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '\u2080': '0',
  '\u2081': '1',
  '\u2082': '2',
  '\u2083': '3',
  '\u2084': '4',
  '\u2085': '5',
  '\u2086': '6',
  '\u2087': '7',
  '\u2088': '8',
  '\u2089': '9',
};

export const PDF_X_MEDIA = 'x_media';
export const PDF_NU_EFF = 'nu_eff';

export function pdfFormatNuEffValue(nu_eff: number): string {
  return Number.isFinite(nu_eff) ? nu_eff.toFixed(1) : 'inf';
}

/** Normalize GUM notation for PDF body text, formulas, and table cells. */
export function pdfSanitizeMetrologyText(text: string): string {
  let out = text;
  // Helvetica in react-pdf often omits √, which makes "s/√n" read as "s/n".
  out = out.replace(/√\(/g, 'sqrt(');
  out = out.replace(/√(\d+)/g, 'sqrt($1)');
  out = out.replace(/√([a-zA-Z_]+)/g, 'sqrt($1)');
  out = out.replace(/√/g, 'sqrt');
  out = out.replace(/νeff/gi, 'nu_eff');
  out = out.replace(/ν/g, 'nu');
  out = out.replace(/∞/g, 'inf');
  out = out.replace(/x̄/g, 'x_media');
  out = out.replace(/xᵢ/g, 'x_i');
  out = out.replace(/uᵢ/g, 'u_i');
  out = out.replace(/cᵢ/g, 'c_i');
  out = out.replace(/Σ/g, 'Sum');
  out = out.replace(/²/g, '^2');
  out = out.replace(/⁴/g, '^4');
  out = out.replace(/·/g, ' * ');
  out = out.replace(/≈/g, '~');
  out = out.replace(/[\u2080-\u2089]/g, (ch) => SUBSCRIPT_DIGITS[ch] ?? ch);
  return out;
}

/** Presupuesto formula column — sanitize then cap length after sqrt() expansion. */
export function pdfFormulaDisplay(text: string, maxLen = 72): string {
  const sanitized = pdfSanitizeMetrologyText(text);
  if (sanitized.length <= maxLen) return sanitized;
  return `${sanitized.slice(0, maxLen - 1)}…`;
}
