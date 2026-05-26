/**
 * FC replica MR / f'c computation (d1+d2 mm → dprom).
 * Run: npx tsx src/lib/ema/uncertaintyMeasurand.fc.test.ts
 */

import assert from 'node:assert/strict';
import { computeReplicaMeasurand } from './uncertaintyMeasurand';
import type { UncertaintyMeasurand } from '@/types/ema-uncertainty';

const fcMeasurand: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'> = {
  codigo: 'FC',
  formula_expr: 'Carga/(PI()*dprom^2/4)',
  inputs: [
    { simbolo: 'Carga', kind: 'measured', orden: 1 } as UncertaintyMeasurand['inputs'][0],
    { simbolo: 'd1', kind: 'measured', orden: 2 } as UncertaintyMeasurand['inputs'][0],
    { simbolo: 'd2', kind: 'measured', orden: 3 } as UncertaintyMeasurand['inputs'][0],
  ],
};

const mr = computeReplicaMeasurand(fcMeasurand, {
  Carga: 44177,
  d1: 150,
  d2: 150,
});
assert.ok(mr !== null && mr > 0, `FC f'c from d1+d2; got ${mr}`);

const onlyDprom = computeReplicaMeasurand(fcMeasurand, { Carga: 44177, dprom: 150 });
assert.ok(onlyDprom !== null && Math.abs(onlyDprom! - mr!) < 1e-6, 'dprom-only matches d1+d2 avg');

const incomplete = computeReplicaMeasurand(fcMeasurand, { Carga: 100, d1: 150 });
assert.equal(incomplete, null, 'missing d2 → null');

console.log('  ✓ uncertaintyMeasurand FC tests passed');
