/**
 * FC réplica PDF row parity (d1+d2 → dprom, A).
 * Run: npx tsx src/lib/ema/uncertaintyInformePdfModel.replica.test.ts
 */
import assert from 'node:assert/strict';
import { buildReplicaPdfRows } from './uncertaintyInformeReplicaPdf';
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

const replicas: UncertaintyStudyReplica[] = [
  {
    id: 'r1',
    study_id: 's1',
    orden: 1,
    operator_id: null,
    instrumento_id: null,
    raw_values_json: { Carga: 44177, d1: 150, d2: 152 },
    computed_value: 281.8441,
    created_at: '',
  },
];

const rows = buildReplicaPdfRows(replicas, measurand);
assert.equal(rows[0][6], '151.0000', 'dprom from d1+d2');
assert.notEqual(rows[0][7], '—', 'A computed');
console.log('  ✓ uncertaintyInformePdfModel replica FC test passed');
