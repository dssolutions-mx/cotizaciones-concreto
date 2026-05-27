/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { buildBudget } from './uncertaintyBudget';
import {
  assertInformeExportAllowed,
  buildBudgetPdfRows,
  categoriaLabel,
  fmtPdfExp,
} from './uncertaintyInformePdfModel';

describe('uncertaintyInformePdfModel', () => {
  it('fmtPdfExp matches UI convention', () => {
    expect(fmtPdfExp(0)).toBe('0');
    expect(fmtPdfExp(0.0012)).toBe('1.2000e-3');
  });

  it('categoriaLabel maps known categories', () => {
    expect(categoriaLabel('calibration')).toBe('Calibración');
    expect(categoriaLabel(undefined)).toBe('—');
  });

  it('budget row contributions sum to ~100%', () => {
    const tempReplicas = [23.5, 23.8, 23.2, 23.1, 22.9, 24.0, 23.6, 23.5, 23.4, 23.8];
    const budget = buildBudget({
      measurandCode: 'TEMP',
      measurandName: 'Temperatura',
      unit: '°C',
      replicaValues: tempReplicas,
      typeBInputs: [
        {
          fuente: 'Resolución',
          magnitud_xi: 'T',
          unidad: '°C',
          valor_xi: 23.5,
          kind: 'resolution',
          divMin: 0.1,
          categoria: 'resolution',
        },
      ],
    });

    const rows = buildBudgetPdfRows(budget.components, '°C');
    const componentRows = rows.filter((r) => r.kind === 'component');
    const pcts = componentRows.map((r) =>
      r.kind === 'component' ? parseFloat(r.cells[10]) : 0,
    );
    const sumPct = pcts.reduce((a, b) => a + b, 0);
    expect(sumPct).toBeGreaterThan(99);
    expect(sumPct).toBeLessThanOrEqual(100.01);
  });

  it('assertInformeExportAllowed only for publicado', () => {
    expect(assertInformeExportAllowed('publicado')).toBe(true);
    expect(assertInformeExportAllowed('borrador')).toBe(false);
    expect(assertInformeExportAllowed('reemplazado')).toBe(false);
  });

});
