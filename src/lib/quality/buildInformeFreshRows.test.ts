import { describe, expect, it } from 'vitest';
import { buildInformeFreshRows } from './buildInformeFreshRows';
import type { MuestreoMedicionCampo } from '../../types/muestreoFieldMeasurement';

function revRow(secuencia: number, valor: number, motivo?: string): MuestreoMedicionCampo {
  return {
    id: `r-${secuencia}`,
    muestreo_id: 'm1',
    measurand_codigo: 'REV',
    secuencia,
    motivo: motivo ?? null,
    valor,
    unidad: 'cm',
    notas: null,
    created_by: null,
    created_at: '',
  };
}

describe('buildInformeFreshRows', () => {
  const baseScalars = {
    revenimiento_sitio: 78,
    temperatura_concreto: null,
    masa_unitaria: null,
    contenido_aire: null,
    temperatura_ambiente: null,
  };

  it('emits one row per REV reading without a promedio row (commercial C/NC on last)', () => {
    const rows = buildInformeFreshRows({
      mediciones: [revRow(1, 76), revRow(2, 78), revRow(3, 80)],
      scalars: baseScalars,
      slump: 75,
      tolerancias: { revenimiento_mm: 10 },
      isLabExperiment: false,
      freshUncertainty: () => undefined,
    });
    expect(rows).toHaveLength(3);
    expect(rows.some((r) => r.resultado_es_promedio)).toBe(false);
    expect(rows.some((r) => r.ensayo.toLowerCase().includes('promedio'))).toBe(false);
    expect(rows.slice(0, 2).every((r) => r.conformidad === 'N/A')).toBe(true);
    expect(rows[2].conformidad).toMatch(/^[CN]/);
  });

  it('lab experiment: all REV rows N/A, no promedio row', () => {
    const rows = buildInformeFreshRows({
      mediciones: [revRow(1, 76), revRow(2, 80)],
      scalars: { ...baseScalars, revenimiento_sitio: 78 },
      slump: 75,
      tolerancias: { revenimiento_mm: 10 },
      isLabExperiment: true,
      freshUncertainty: () => undefined,
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.conformidad === 'N/A')).toBe(true);
    expect(rows.some((r) => r.ensayo.toLowerCase().includes('promedio'))).toBe(false);
  });

  it('falls back to scalar when no appendix rows', () => {
    const rows = buildInformeFreshRows({
      mediciones: [],
      scalars: { ...baseScalars, revenimiento_sitio: 12 },
      slump: 10,
      tolerancias: { revenimiento_mm: 10 },
      isLabExperiment: false,
      freshUncertainty: () => undefined,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].ensayo).toBe('Revenimiento');
    expect(rows[0].resultado).toContain('12');
  });
});
