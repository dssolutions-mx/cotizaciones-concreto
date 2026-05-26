/**
 * FC_CUBO replica f'c — L1×L2 in cm (catalog unit).
 * Run: npx tsx src/lib/ema/uncertaintyMeasurand.fcCubo.test.ts
 */

import assert from 'node:assert/strict';
import { computeReplicaMeasurand } from './uncertaintyMeasurand';
import type { UncertaintyMeasurand } from '@/types/ema-uncertainty';

const cuboMeasurand: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'> = {
  codigo: 'FC_CUBO',
  formula_expr: 'Carga/(L1*L2)',
  inputs: [
    { simbolo: 'Carga', kind: 'measured', orden: 1, unidad: 'kg' } as UncertaintyMeasurand['inputs'][0],
    { simbolo: 'L1', kind: 'measured', orden: 2, unidad: 'cm' } as UncertaintyMeasurand['inputs'][0],
    { simbolo: 'L2', kind: 'measured', orden: 3, unidad: 'cm' } as UncertaintyMeasurand['inputs'][0],
  ],
};

// 15×15 cm cube, Carga for f'c ≈ 250 kg/cm² → 250 × 225 = 56 250 kg
const fc = computeReplicaMeasurand(cuboMeasurand, {
  Carga: 56250,
  L1: 15,
  L2: 15,
});
assert.ok(fc !== null && Math.abs(fc - 250) < 2, `FC_CUBO f'c ≈ 250; got ${fc?.toFixed(2)}`);

// Must NOT treat cm readings as mm (15 cm → 1.5 cm would give ~25 000 kg/cm²)
const wrongIfMm = computeReplicaMeasurand(
  { ...cuboMeasurand, inputs: cuboMeasurand.inputs!.map((i) => ({ ...i, unidad: 'mm' })) },
  { Carga: 56250, L1: 15, L2: 15 },
);
assert.ok(
  wrongIfMm !== null && wrongIfMm > 1000,
  'if L sides were wrongly converted from mm, f\'c would be far too high',
);

assert.equal(
  computeReplicaMeasurand(cuboMeasurand, { Carga: 1000, L1: 15 }),
  null,
  'missing L2 → null',
);

console.log('  ✓ uncertaintyMeasurand FC_CUBO tests passed');
