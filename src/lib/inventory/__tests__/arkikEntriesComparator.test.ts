import assert from 'node:assert';
import {
  compareArkikEntries,
  normalizeRemision,
} from '@/lib/inventory/arkikEntriesComparator';
import { extractAdjustmentRemision } from '@/lib/inventory/arkikAdjustmentRemision';

assert.strictEqual(normalizeRemision('085191'), '85191');
assert.strictEqual(extractAdjustmentRemision('085191', ''), '85191');

const excel = [
  {
    material: 'CEM001',
    proveedor: 'Proveedor A',
    remision: '085191',
    cantidad: 10,
    unit_arkik: 'T',
    cantidad_kg: 10000,
    fecha: '2026-05-10',
  },
];

const partial = compareArkikEntries(excel, [
  {
    entry_number: 'ENT-1',
    material_code: 'CEM001',
    supplier_name: 'Prov',
    supplier_invoice: '85191',
    entry_date: '2026-05-10',
    quantity_received: 10000,
  },
]);

assert.strictEqual(partial.matched.length, 1);
assert.strictEqual(partial.matched[0].cantidad_excel_kg, 10000);

console.log('arkikEntriesComparator.test.ts: ok');
