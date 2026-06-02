import assert from 'node:assert';
import { compareArkikConsumosSinRemision } from '@/lib/inventory/arkikConsumoComparator';

const matched = compareArkikConsumosSinRemision(
  [
    {
      material: 'ARE001',
      proveedor: 'P',
      movement_type: 'Consumo',
      notas: '',
      cantidad: 0.5,
      unit_arkik: 'T',
      cantidad_kg: 500,
      fecha: '2026-05-15',
    },
  ],
  [
    {
      adjustment_number: 'ADJ-9',
      material_code: 'ARE001',
      adjustment_date: '2026-05-15',
      quantity_adjusted: 500,
      adjustment_type: 'consumption',
      reference_type: null,
      reference_notes: 'Consumo planta',
    },
  ]
);

assert.strictEqual(matched.matched.length, 1);
assert.strictEqual(matched.only_excel.length, 0);

console.log('arkikConsumoComparator.test.ts: ok');
