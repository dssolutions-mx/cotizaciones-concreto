/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  pdfFormulaDisplay,
  pdfMetrologyPdfText,
  PDF_NU_EFF,
} from './uncertaintyPdfMetrologyText';

describe('uncertaintyPdfMetrologyText', () => {
  it('preserves GUM symbols for DejaVu PDF output', () => {
    expect(pdfMetrologyPdfText('νeff = 9.0')).toBe('νeff = 9.0');
    expect(pdfMetrologyPdfText('Σ uᵢ²(y)')).toBe('Σ uᵢ²(y)');
    expect(pdfMetrologyPdfText('u_A = s / √n = 3.6510e+1 / √10 = 1.1546e+1')).toBe(
      'u_A = s / √n = 3.6510e+1 / √10 = 1.1546e+1',
    );
  });

  it('uses Unicode nu_eff label', () => {
    expect(PDF_NU_EFF).toBe('ν_eff');
  });

  it('pdfFormulaDisplay truncates without transliterating', () => {
    const long = `u_A = s / √n = ${'1'.repeat(100)}`;
    const out = pdfFormulaDisplay(long, 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toContain('√n');
  });
});
