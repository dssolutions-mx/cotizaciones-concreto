/**
 * FC_CUBO preview path: budget must not throw when sensitivity context is partial.
 * Run: npx tsx src/lib/ema/uncertaintyBudget.fcCuboPreview.test.ts
 */

import assert from 'node:assert/strict';
import { buildBudget, resolveSensitivityCi } from './uncertaintyBudget';

const A_CUBO = 15 * 15;
const FC_MEAN = 250;
const CARGA_MEAN = FC_MEAN * A_CUBO;

// Without area_mean, raw sensitivityCoefficient throws; resolveSensitivityCi must not.
assert.equal(
  resolveSensitivityCi('FC_CUBO', 'Carga', {}, undefined),
  1,
  'missing context → ci=1 fallback',
);

const budget = buildBudget({
  measurandCode: 'FC_CUBO',
  measurandName: "f'c cubo",
  unit: 'kg/cm²',
  replicaValues: [248, 252, 250, 249],
  typeBInputs: [
    {
      fuente: 'Resolución prensa',
      magnitud_xi: 'Carga',
      unidad: 'kg',
      valor_xi: CARGA_MEAN,
      kind: 'resolution',
      divMin: 1,
    },
    {
      fuente: 'No planitud (capping)',
      magnitud_xi: 'capping',
      unidad: 'kg/cm²',
      valor_xi: 0,
      kind: 'rectangular',
      halfWidth: 2,
    },
  ],
  sensitivityContext: {},
});

assert.ok(budget.U > 0, 'budget computes with partial sensitivity context');
assert.ok(budget.components.length >= 2, 'Type A + Type B rows present');

console.log('  ✓ FC_CUBO preview budget resilience');
