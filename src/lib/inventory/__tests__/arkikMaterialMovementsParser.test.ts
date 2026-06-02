import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  extractArkikCommentAfterDate,
  isArkikEntradaMovementType,
  parseArkikMaterialMovementsWorkbook,
} from '@/lib/inventory/arkikMaterialMovementsParser';

assert.strictEqual(isArkikEntradaMovementType('Entrada'), true);
assert.strictEqual(isArkikEntradaMovementType('ENTRADA'), true);

const wb = XLSX.utils.book_new();
const rows: unknown[][] = [
  ['Material|Proveedor', '', '', '', '', '', 'CEM001|Prov A|T'],
  ['Unidad de medida', '', '', '', '', '', 'T'],
  ['', '2026-05-10', 'Entrega matutina', '', '', 'Entrada', 'CEM001|Prov A|T', '', '', 10, '', '', '', '', '85191'],
  ['', '2026-05-11', 'Ajuste sin remisión', '', '', 'Entrada', 'CEM001|Prov A|T', '', '', 1, '', '', '', '', ''],
  ['', '2026-05-12', '', '', '', 'Consumo', 'CEM001|Prov A|T', '', '', 0.5, '', '', '', '', ''],
  ['', '2026-05-13', '', '', '', 'Regreso a proveedor', 'CEM001|Prov A|T', '', '', 1, '', '', '', '', '999'],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Mov');
const parsed = parseArkikMaterialMovementsWorkbook(wb);

assert.strictEqual(parsed.entradas.length, 1);
assert.strictEqual(parsed.entradas[0].remision, '85191');
assert.strictEqual(parsed.entradas[0].notas, 'Entrega matutina');
assert.strictEqual(parsed.entradas_sin_remision.length, 1);
assert.strictEqual(parsed.entradas_sin_remision[0].notas, 'Ajuste sin remisión');
assert.strictEqual(parsed.consumos_sin_remision.length, 1);
assert.strictEqual(parsed.regresos_proveedor.length, 1);

assert.strictEqual(
  extractArkikCommentAfterDate(['', '2026-05-10', 'Comentario de prueba']),
  'Comentario de prueba'
);

console.log('arkikMaterialMovementsParser.test.ts: ok');
