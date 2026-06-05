import { describe, expect, it } from 'vitest';
import {
  applyMoldeDimensionsToPlannedSample,
  inferCubeSideCmFromInstrumentName,
  requireSpecimenDimensionsForInsert,
  resolvePersistedCubeSideCm,
} from './moldeInstrumentoSpec';

describe('moldeInstrumentoSpec', () => {
  it('parses 15x15 from molde name', () => {
    expect(inferCubeSideCmFromInstrumentName('Molde Cúbico 15x15')).toBe(15);
    expect(inferCubeSideCmFromInstrumentName('Molde 10 x 10')).toBe(10);
  });

  it('applies cube side when molde is selected', () => {
    const sample = applyMoldeDimensionsToPlannedSample(
      {
        id: '1',
        tipo_muestra: 'CUBO',
        fecha_programada_ensayo: new Date(),
      },
      'Molde Cúbico 15x15',
    );
    expect(sample.cube_side_cm).toBe(15);
  });

  it('defaults null cube side to 15 for persistence', () => {
    expect(resolvePersistedCubeSideCm(null)).toBe(15);
    expect(resolvePersistedCubeSideCm(undefined)).toBe(15);
  });

  describe('requireSpecimenDimensionsForInsert (strict capture)', () => {
    it('returns the registered cube side and nulls diameter', () => {
      expect(
        requireSpecimenDimensionsForInsert({ tipo_muestra: 'CUBO', cube_side_cm: 10 }),
      ).toEqual({ cube_side_cm: 10, diameter_cm: null });
    });

    it('returns the registered diameter and nulls cube side', () => {
      expect(
        requireSpecimenDimensionsForInsert({ tipo_muestra: 'CILINDRO', diameter_cm: 10 }),
      ).toEqual({ diameter_cm: 10, cube_side_cm: null });
    });

    it('throws when a cube has no registered side (no silent default)', () => {
      expect(() =>
        requireSpecimenDimensionsForInsert({ tipo_muestra: 'CUBO', cube_side_cm: null }),
      ).toThrow(/lado del cubo/i);
    });

    it('throws when a cylinder has no registered diameter (no silent default)', () => {
      expect(() =>
        requireSpecimenDimensionsForInsert({ tipo_muestra: 'CILINDRO' }),
      ).toThrow(/diámetro del cilindro/i);
    });

    it('does not require a dimension for VIGA', () => {
      expect(requireSpecimenDimensionsForInsert({ tipo_muestra: 'VIGA' })).toEqual({
        diameter_cm: null,
        cube_side_cm: null,
      });
    });
  });
});
