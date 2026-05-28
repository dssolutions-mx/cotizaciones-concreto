import { describe, expect, it } from 'vitest';
import {
  applyMoldeDimensionsToPlannedSample,
  inferCubeSideCmFromInstrumentName,
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
});
