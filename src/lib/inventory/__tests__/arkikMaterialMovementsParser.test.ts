import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  canonicalArkikMovementType,
  detectArkikSectionColumnMap,
  extractArkikComentarios,
  isArkikConsumoMovementType,
  isArkikEntradaMovementType,
  parseArkikMaterialMovementsWorkbook,
} from '@/lib/inventory/arkikMaterialMovementsParser';

assert.strictEqual(canonicalArkikMovementType('Salida por Ajuste'), 'Salida por Ajuste');
assert.strictEqual(canonicalArkikMovementType('ENTRADA POR AJUSTE'), 'Entrada por Ajuste');
assert.ok(isArkikConsumoMovementType('Salida por Ajuste'));
assert.ok(isArkikEntradaMovementType('Entrada por Ajuste'));

const tabularHeaders = [
  '',
  'Fecha de movimiento',
  'Tipo de movimiento',
  'Cantidad',
  'Volumétrico',
  'Remisión',
  'Usuario',
  'Fecha de creación',
  'Comentarios',
];
const colMap = detectArkikSectionColumnMap(tabularHeaders);
assert.ok(colMap);
assert.strictEqual(colMap!.fecha_creacion, 7);
assert.strictEqual(colMap!.comentarios, 8);

const dataRow = [
  '',
  '24/04/2026',
  'Entrada',
  '50.00',
  '1450',
  '',
  'DOSIFICADOR',
  '24/04/2026 09:01',
  'ENTRADA FICTICIA',
];
assert.strictEqual(extractArkikComentarios(dataRow, colMap!), 'ENTRADA FICTICIA');

const wb = XLSX.utils.book_new();
const rows: unknown[][] = [
  ['Material|Proveedor', '', '', '', '', '', 'CEM001|Prov A|T'],
  ['', 'Unidad de medida', '', 'T', '', '', ''],
  tabularHeaders,
  dataRow,
  [
    '',
    '25/04/2026',
    'Salida por Ajuste',
    '2.5',
    '0',
    '',
    'DOSIFICADOR',
    '25/04/2026 10:00',
    'AJUSTE MERMA',
  ],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Mov');
const parsed = parseArkikMaterialMovementsWorkbook(wb);

assert.strictEqual(parsed.entradas_sin_remision.length, 1);
assert.strictEqual(parsed.entradas_sin_remision[0].notas, 'ENTRADA FICTICIA');
assert.strictEqual(parsed.salidas_por_ajuste.length, 1);
assert.strictEqual(parsed.salidas_por_ajuste[0].movement_type, 'Salida por Ajuste');
assert.strictEqual(parsed.salidas_por_ajuste[0].notas, 'AJUSTE MERMA');
assert.strictEqual(parsed.consumos_sin_remision.length, 0);
assert.strictEqual(parsed.meta.by_tipo['Salida por Ajuste'], 1);
assert.strictEqual(parsed.meta.en_revision.ajustes_negativos, 1);

const wbConsumo = XLSX.utils.book_new();
const consumoRows: unknown[][] = [
  ['Material|Proveedor', '', '', '', '', '', 'CEM001|Prov A|T'],
  ['', 'Unidad de medida', '', 'T', '', '', ''],
  tabularHeaders,
  [
    '',
    '26/04/2026',
    'Consumo',
    '10',
    '0',
    'REM-99',
    'DOSIFICADOR',
    '26/04/2026 08:00',
    'CON REM',
  ],
  [
    '',
    '27/04/2026',
    'Consumo',
    '5',
    '0',
    '',
    'DOSIFICADOR',
    '27/04/2026 09:00',
    'SIN REM',
  ],
];
XLSX.utils.book_append_sheet(wbConsumo, XLSX.utils.aoa_to_sheet(consumoRows), 'Mov');
const parsedConsumo = parseArkikMaterialMovementsWorkbook(wbConsumo);
assert.strictEqual(parsedConsumo.consumos_sin_remision.length, 1);
assert.strictEqual(parsedConsumo.consumos_sin_remision[0].notas, 'SIN REM');
assert.strictEqual(parsedConsumo.meta.consumo_con_remision, 1);
assert.strictEqual(parsedConsumo.meta.consumo_sin_remision, 1);
assert.strictEqual(parsedConsumo.meta.by_tipo['Consumo'], 2);

console.log('arkikMaterialMovementsParser.test.ts: ok');
