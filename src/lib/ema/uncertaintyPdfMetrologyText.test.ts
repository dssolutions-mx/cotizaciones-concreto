/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { pdfSanitizeMetrologyText } from './uncertaintyPdfMetrologyText';

describe('uncertaintyPdfMetrologyText', () => {
  it('replaces Greek nu in nu_eff', () => {
    expect(pdfSanitizeMetrologyText('νeff = 9.0')).toBe('nu_eff = 9.0');
  });

  it('replaces subscripts in budget footers', () => {
    expect(pdfSanitizeMetrologyText('Σ uᵢ²(y)')).toBe('Sum u_i^2(y)');
  });

  it('replaces sqrt so PDF does not drop the radical', () => {
    expect(pdfSanitizeMetrologyText('u_A = s / √n = 3.6510e+1 / √10 = 1.1546e+1')).toBe(
      'u_A = s / sqrt(n) = 3.6510e+1 / sqrt(10) = 1.1546e+1',
    );
    expect(pdfSanitizeMetrologyText('u_res = (0.1/2) / √3 = 2.8868e-2')).toBe(
      'u_res = (0.1/2) / sqrt(3) = 2.8868e-2',
    );
  });
});
