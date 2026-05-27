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
});
