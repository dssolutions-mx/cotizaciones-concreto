/**
 * FC réplica PDF row parity (d1+d2 → dprom, A; per-role instruments).
 * Run: npx tsx src/lib/ema/uncertaintyInformePdfModel.replica.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildReplicaPdfColumns,
  buildReplicaPdfRows,
  replicaSectionUsesLandscape,
} from './uncertaintyInformeReplicaPdf';
import { resolveReplicaInformeCellValue } from './uncertaintyMeasurand';
import type { UncertaintyMeasurand, UncertaintyStudyReplica } from '@/types/ema-uncertainty';

const measurand = {
  codigo: 'FC',
  nombre: "f'c",
  unidad: 'kg/cm²',
  formula_expr: 'Carga/(PI()*dprom^2/4)',
  inputs: [
    { simbolo: 'Carga', nombre_display: 'Carga', kind: 'measured', orden: 1, unidad: 'kg' },
    { simbolo: 'd1', nombre_display: 'd1', kind: 'measured', orden: 2, unidad: 'mm' },
    { simbolo: 'd2', nombre_display: 'd2', kind: 'measured', orden: 3, unidad: 'mm' },
    { simbolo: 'dprom', nombre_display: 'dprom', kind: 'derived', orden: 4, unidad: 'mm' },
    { simbolo: 'A', nombre_display: 'A', kind: 'derived', orden: 5, unidad: 'cm²' },
  ],
} as UncertaintyMeasurand;

const PRENSA = '11111111-1111-1111-1111-111111111111';
const VERNIER = '22222222-2222-2222-2222-222222222222';

const replicas: UncertaintyStudyReplica[] = [
  {
    id: 'r1',
    study_id: 's1',
    orden: 1,
    operator_id: null,
    instrumento_id: PRENSA,
    raw_values_json: { Carga: 51480, d1: 150, d2: 152, _instr_diametro: VERNIER },
    computed_value: 281.8441,
    created_at: '',
  },
];

const ctx = {
  study: { replicas, excluded_input_simbolos: [], env_overrides: null },
  measurand,
  instrument_lookup: {
    [PRENSA]: { codigo: 'DC-04-01', nombre: 'Prensa' },
    [VERNIER]: { codigo: 'DC-43-01', nombre: 'Vernier' },
  },
};

const cols = buildReplicaPdfColumns(ctx);
const colSum = cols.reduce((s, c) => s + c.widthPt, 0);
assert.ok(cols.some((c) => c.label.startsWith('Prensa')));
assert.ok(cols.some((c) => c.label.startsWith('Vernier')));
assert.ok(cols.some((c) => c.label.includes("f'c")));
assert.ok(colSum <= 778 + 2, 'columns fit inside landscape card');
assert.equal(replicaSectionUsesLandscape(ctx), true);

const rows = buildReplicaPdfRows(ctx);
assert.equal(rows[0][4], '51480.0000', 'Carga column fixed notation');
assert.equal(rows[0][2], 'DC-04-01', 'prensa column');
assert.equal(rows[0][3], 'DC-43-01', 'vernier column');
assert.equal(rows[0][7], '151.0000', 'dprom from d1+d2');
assert.notEqual(rows[0][8], '—', 'A computed');

assert.equal(
  resolveReplicaInformeCellValue(measurand, 'Carga', { Carga: 51480, d1: 150, d2: 152 }),
  '51480.0000',
  'Carga uses fixed notation, not scientific',
);
assert.equal(
  resolveReplicaInformeCellValue(measurand, 'Carga', { Carga: 68000 }),
  '68000.0000',
);

console.log('  ✓ uncertaintyInformePdfModel replica FC test passed');
