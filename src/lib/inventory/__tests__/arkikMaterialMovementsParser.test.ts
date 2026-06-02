import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  detectArkikTabularColumnMap,
  extractArkikComentarios,
  isArkikEntradaMovementType,
  parseArkikMaterialMovementsWorkbook,
} from '@/lib/inventory/arkikMaterialMovementsParser';

assert.strictEqual(isArkikEntradaMovementType('Entrada'), true);

const tabularHeaders = [
  'Fecha de movimiento',
  'Tipo de movimiento',
  'Cantidad',
  'Volumétrico',
  'Remisión',
  'Usuario',
  'Fecha de creación',
  'Comentarios',
];
const colMap = detectArkikTabularColumnMap(tabularHeaders);
assert.ok(colMap);
assert.strictEqual(colMap!.fecha_creacion, 6);
assert.strictEqual(colMap!.comentarios, 7);
assert.strictEqual(colMap!.comentarios, colMap!.fecha_creacion + 1);
assert.strictEqual(colMap!.usuario, 5);

const dataRow = [
  '24/04/2026',
  'Entrada',
  '50.00',
  '1450',
  '',
  'DOSIFICADOR',
  '24/04/2026 09:01',
  'ENTRADA FICTICIA',
];

const headersSinLabelComentarios = [
  'Fecha de movimiento',
  'Tipo de movimiento',
  'Cantidad',
  'Volumétrico',
  'Remisión',
  'Usuario',
  'Fecha de creación',
  'Notas internas',
];
const map2 = detectArkikTabularColumnMap(headersSinLabelComentarios);
assert.strictEqual(map2!.comentarios, 7);
assert.strictEqual(extractArkikComentarios(dataRow, map2!), 'ENTRADA FICTICIA');
assert.strictEqual(extractArkikComentarios(dataRow, colMap!), 'ENTRADA FICTICIA');

const wbTabular = XLSX.utils.book_new();
const tabularRows: unknown[][] = [
  ['Material|Proveedor', '', '', '', '', '', 'CEM001|Prov A|T'],
  tabularHeaders,
  dataRow,
];
XLSX.utils.book_append_sheet(wbTabular, XLSX.utils.aoa_to_sheet(tabularRows), 'Mov');
const tabularParsed = parseArkikMaterialMovementsWorkbook(wbTabular);
assert.strictEqual(tabularParsed.entradas_sin_remision.length, 1);
assert.strictEqual(tabularParsed.entradas_sin_remision[0].notas, 'ENTRADA FICTICIA');
assert.notStrictEqual(tabularParsed.entradas_sin_remision[0].notas, 'DOSIFICADOR');

const wbLegacy = XLSX.utils.book_new();
const legacyRows: unknown[][] = [
  ['Material|Proveedor', '', '', '', '', '', 'CEM001|Prov A|T'],
  ['Unidad de medida', '', '', '', '', '', 'T'],
  ['', '2026-05-10', 'Entrega matutina', '', '', 'Entrada', 'CEM001|Prov A|T', '', '', 10, '', '', '', '', '85191'],
];
XLSX.utils.book_append_sheet(wbLegacy, XLSX.utils.aoa_to_sheet(legacyRows), 'Mov');
const legacyParsed = parseArkikMaterialMovementsWorkbook(wbLegacy);
assert.strictEqual(legacyParsed.entradas.length, 1);
assert.strictEqual(legacyParsed.entradas[0].remision, '85191');

console.log('arkikMaterialMovementsParser.test.ts: ok');
