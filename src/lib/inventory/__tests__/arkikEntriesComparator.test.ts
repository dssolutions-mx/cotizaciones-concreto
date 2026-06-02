import assert from 'node:assert';
import {
  compareArkikEntries,
  compareEntradasSinRemision,
  normalizeArkikMaterialKey,
  normalizeRemision,
} from '@/lib/inventory/arkikEntriesComparator';
import { extractAdjustmentRemision } from '@/lib/inventory/arkikAdjustmentRemision';

assert.strictEqual(normalizeRemision('085191'), '85191');
assert.strictEqual(normalizeRemision(''), '0');
assert.strictEqual(normalizeArkikMaterialKey(' cem001 '), 'CEM001');
assert.strictEqual(extractAdjustmentRemision('085191', ''), '85191');
assert.strictEqual(extractAdjustmentRemision('material_entry', 'Remisión 85191'), '85191');
assert.strictEqual(extractAdjustmentRemision('consumption', ''), null);

const excel = [
  {
    material: 'CEM001',
    proveedor: 'Proveedor A',
    remision: '085191',
    notas: 'Entrega matutina',
    cantidad: 10,
    unit_arkik: 'T',
    cantidad_kg: 10000,
    fecha: '2026-05-10',
  },
];

const dbEntry = {
  entry_number: 'ENT-1',
  material_code: 'CEM001',
  supplier_name: 'Prov',
  supplier_invoice: '85191',
  notes: null,
  entry_date: '2026-05-10',
  quantity_received: 10000,
};

const partial = compareArkikEntries(excel, [], [dbEntry]);
assert.strictEqual(partial.matched.length, 1);
assert.strictEqual(partial.matched[0].notas_excel, 'Entrega matutina');

const caseInsensitive = compareArkikEntries(
  [{ ...excel[0], material: 'cem001' }],
  [],
  [{ ...dbEntry, material_code: 'CEM001' }]
);
assert.strictEqual(caseInsensitive.matched.length, 1);

const sinRem = compareEntradasSinRemision(
  [
    {
      material: 'CEM001',
      proveedor: 'P',
      notas: 'Sin folio proveedor',
      cantidad: 1,
      unit_arkik: 'T',
      cantidad_kg: 1000,
      fecha: '2026-05-11',
    },
  ],
  [
    {
      ...dbEntry,
      entry_number: 'ENT-2',
      supplier_invoice: null,
      notes: 'Recepción directa',
      entry_date: '2026-05-11',
      quantity_received: 1000,
    },
  ]
);
assert.strictEqual(sinRem.matched.length, 1);

console.log('arkikEntriesComparator.test.ts: ok');
