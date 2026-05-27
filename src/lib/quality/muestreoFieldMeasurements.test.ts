import { describe, expect, it } from 'vitest';
import {
  buildMedicionesPayload,
  computeScalarPatchFromMediciones,
  filterMeaningfulMedicionRows,
  normalizeMedicionInputs,
  roundMeasurandAverage,
  scalarsToMedicionInputs,
} from './muestreoFieldMeasurements';

describe('muestreoFieldMeasurements', () => {
  it('averages REV to 1 decimal', () => {
    expect(roundMeasurandAverage('REV', [76, 78, 80])).toBe(78);
    expect(roundMeasurandAverage('REV', [76.15, 76.25])).toBe(76.2);
  });

  it('averages MU to 2 decimals', () => {
    expect(roundMeasurandAverage('MU', [2401.25, 2398.75])).toBe(2400);
    expect(roundMeasurandAverage('MU', [2401.234, 2398.766])).toBe(2400);
  });

  it('buildMedicionesPayload includes all multi rows and single scalars', () => {
    const payload = buildMedicionesPayload(
      { revenimiento_sitio: 12.5, temperatura_concreto: 28 },
      {
        mediciones: [
          { measurand_codigo: 'REV', secuencia: 1, motivo: 'A', valor: 10, unidad: 'cm' },
          { measurand_codigo: 'REV', secuencia: 2, motivo: 'B', valor: 14, unidad: 'cm' },
          { measurand_codigo: 'REV', secuencia: 3, motivo: null, valor: 0, unidad: 'cm' },
        ],
        expandedCodigos: ['REV'],
        muExpanded: false,
      },
    );
    expect(payload.filter((r) => r.measurand_codigo === 'REV')).toHaveLength(2);
    expect(payload.find((r) => r.measurand_codigo === 'TEMP')?.valor).toBe(28);
  });

  it('filterMeaningfulMedicionRows drops empty placeholders', () => {
    const kept = filterMeaningfulMedicionRows([
      { measurand_codigo: 'REV', secuencia: 1, valor: 0, unidad: 'cm' },
      { measurand_codigo: 'REV', secuencia: 2, motivo: 'Réplica', valor: 0, unidad: 'cm' },
      { measurand_codigo: 'REV', secuencia: 3, valor: 12.5, unidad: 'cm' },
    ]);
    expect(kept).toHaveLength(2);
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
