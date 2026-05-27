import { describe, expect, it } from 'vitest';
import {
  computeScalarPatchFromMediciones,
  normalizeMedicionInputs,
  roundMeasurandAverage,
  scalarsToMedicionInputs,
} from './muestreoFieldMeasurements';

describe('muestreoFieldMeasurements', () => {
  it('averages REV to 1 decimal', () => {
    expect(roundMeasurandAverage('REV', [76, 78, 80])).toBe(78);
    expect(roundMeasurandAverage('REV', [76.15, 76.25])).toBe(76.2);
  });

  it('averages MU to 0 decimals', () => {
    expect(roundMeasurandAverage('MU', [2401.2, 2398.8])).toBe(2400);
  });

  it('syncs scalars from mediciones', () => {
    const patch = computeScalarPatchFromMediciones([
      { measurand_codigo: 'REV', secuencia: 1, valor: 70 },
      { measurand_codigo: 'REV', secuencia: 2, valor: 80 },
      { measurand_codigo: 'TEMP', secuencia: 1, valor: 28 },
    ]);
    expect(patch.revenimiento_sitio).toBe(75);
    expect(patch.temperatura_concreto).toBe(28);
    expect(patch.masa_unitaria).toBeNull();
  });

  it('normalizes secuencia per measurand', () => {
    const rows = normalizeMedicionInputs([
      { measurand_codigo: 'REV', secuencia: 0, valor: 1 },
      { measurand_codigo: 'REV', secuencia: 0, valor: 3 },
    ]);
    expect(rows.map((r) => r.secuencia)).toEqual([1, 2]);
  });

  it('builds inputs from scalars', () => {
    const rows = scalarsToMedicionInputs({ revenimiento_sitio: 10, masa_unitaria: 2400 });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.measurand_codigo === 'REV')?.valor).toBe(10);
  });
});
