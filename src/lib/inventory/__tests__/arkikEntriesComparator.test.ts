import assert from 'node:assert';
import {
  compareArkikEntries,
  normalizeRemision,
} from '@/lib/inventory/arkikEntriesComparator';
import type { ArkikExcelEntry } from '@/lib/inventory/arkikMaterialMovementsParser';

assert.strictEqual(normalizeRemision('085191'), '85191');
assert.strictEqual(normalizeRemision('85191'), '85191');
assert.strictEqual(normalizeRemision('000'), '0');
assert.strictEqual(normalizeRemision(''), '0');
assert.strictEqual(normalizeRemision(null), null);

const excel: ArkikExcelEntry[] = [
  {
    material: 'CEM001',
    proveedor: 'Proveedor A',
    remision: '085191',
    cantidad: 100,
    fecha: '2026-05-10',
  },
  {
    material: 'ARE002',
    proveedor: 'Proveedor B',
    remision: '99999',
    cantidad: 50,
    fecha: '2026-05-11',
  },
];

const partial = compareArkikEntries(excel, [
  {
    entry_number: 'ENT-1',
    material_code: 'CEM001',
    supplier_name: 'Prov',
    supplier_invoice: '85191',
    entry_date: '2026-05-10',
    quantity_received: 100,
  },
]);

assert.strictEqual(partial.matched.length, 1);
assert.strictEqual(partial.matched[0].remision, '85191');
assert.strictEqual(partial.only_excel.length, 1);
assert.strictEqual(partial.only_excel[0].material, 'ARE002');
assert.strictEqual(partial.only_db.length, 0);
assert.strictEqual(partial.summary.CEM001.matched, 1);
assert.strictEqual(partial.summary.ARE002.only_excel, 1);

const dbOnly = compareArkikEntries([], [
  {
    entry_number: 'ENT-9',
    material_code: 'CEM001',
    supplier_name: 'X',
    supplier_invoice: '111',
    entry_date: '2026-05-01',
    quantity_received: 1,
  },
]);
assert.strictEqual(dbOnly.only_db.length, 1);
assert.strictEqual(dbOnly.only_db[0].entry_number, 'ENT-9');

console.log('arkikEntriesComparator.test.ts: ok');
