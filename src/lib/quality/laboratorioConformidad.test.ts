import { describe, expect, it } from 'vitest';
import { resolveTargetFc, summarizeLoteConformidad } from './laboratorioConformidad';
import type { LaboratorioLoteMuestreo } from '@/types/laboratorioLote';

function muestreoWithEnsayos(
  rows: Array<{ fc: number; pct?: number }>
): LaboratorioLoteMuestreo[] {
  return [
    {
      id: 'm1',
      muestras: [
        {
          id: 'mu1',
          identificacion: 'C1',
          ensayos: rows.map((r, i) => ({
            id: `e${i}`,
            resistencia_calculada: r.fc,
            porcentaje_cumplimiento: r.pct ?? null,
          })),
        },
      ],
    } as LaboratorioLoteMuestreo,
  ];
}

describe('resolveTargetFc', () => {
  it('prefers recipe_snapshot over joined recipe', () => {
    expect(
      resolveTargetFc({
        recipe_snapshot: { strength_fc: 300 },
        concrete_specs: null,
        recipe: { strength_fc: 250 },
      })
    ).toBe(300);
  });
});

describe('summarizeLoteConformidad', () => {
  it('returns sin_ensayos when no tests', () => {
    expect(summarizeLoteConformidad(250, []).status).toBe('sin_ensayos');
  });

  it('marks cumple when all pct >= 100', () => {
    const summary = summarizeLoteConformidad(
      250,
      muestreoWithEnsayos([
        { fc: 260, pct: 104 },
        { fc: 255, pct: 102 },
      ])
    );
    expect(summary.status).toBe('cumple');
  });

  it('marks no_cumple when all pct below 100', () => {
    const summary = summarizeLoteConformidad(
      250,
      muestreoWithEnsayos([{ fc: 200, pct: 80 }])
    );
    expect(summary.status).toBe('no_cumple');
  });

  it('uses fc vs target when pct missing', () => {
    expect(
      summarizeLoteConformidad(250, muestreoWithEnsayos([{ fc: 260 }])).status
    ).toBe('cumple');
    expect(
      summarizeLoteConformidad(250, muestreoWithEnsayos([{ fc: 240 }])).status
    ).toBe('parcial');
  });
});
