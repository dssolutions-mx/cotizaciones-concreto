import assert from 'node:assert';
import { arkikQuantityToKg } from '@/lib/inventory/arkikUnitConversion';
import { extractArkikUnitFromHeaderRow } from '@/lib/inventory/arkikMaterialMovementsParser';

const t12 = arkikQuantityToKg(12, 'T', null);
assert.strictEqual(t12.cantidad_kg, 12000);
assert.strictEqual(t12.unit_canonical, 't');

const kg5 = arkikQuantityToKg(500, 'kg', null);
assert.strictEqual(kg5.cantidad_kg, 500);

assert.strictEqual(extractArkikUnitFromHeaderRow(['Unidad de medida', '', '', '', '', '', 'T']), 'T');

console.log('arkikUnitConversion.test.ts: ok');
