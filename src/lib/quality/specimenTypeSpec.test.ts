import { describe, expect, it } from 'vitest';
import { ensayoSpecMismatchesMuestra, expectedDimensionKeyFromMuestra } from './specimenTypeSpec';

describe('specimenTypeSpec', () => {
  it('expects cube side 15 from muestra', () => {
    expect(
      expectedDimensionKeyFromMuestra({ tipo_muestra: 'CUBO', cube_side_cm: 15 }),
    ).toBe('15');
  });

  it('detects stale 10x10 spec on 15 cm cube', () => {
    expect(
      ensayoSpecMismatchesMuestra(
        { tipo_muestra: 'CUBO', cube_side_cm: 15 },
        { tipo_muestra: 'CUBO', dimension_key: '10' },
      ),
    ).toBe(true);
  });
});
