/**
 * Run: npx tsx src/lib/client-portal/formatElemento.test.ts
 */
import assert from 'node:assert';
import {
  formatElementoGuided,
  referenceKindToLabel,
  ELEMENTO_QUICK_EXAMPLES,
  formatChainageSegment,
  parseKmPlusPattern,
  effectiveReferenceValue,
} from './formatElemento';

function run() {
  assert.strictEqual(
    formatElementoGuided({
      referenceKind: 'cadenamiento',
      customReferenceLabel: '',
      referenceValue: '',
      chainageKm: '3',
      chainageMeters: '944',
      elementoStructural: 'Muro 2',
      description: 'cabecero aguas abajo/ eje 2/ paso ganadero',
    }),
    'Cadenamiento: KM 3+944 Elemento: Muro 2 Descripción: cabecero aguas abajo/ eje 2/ paso ganadero'
  );

  assert.strictEqual(formatChainageSegment('cadenamiento', '12', '380'), 'KM 12+380');
  assert.strictEqual(formatChainageSegment('pk', '12', '400'), '12+400');

  assert.strictEqual(
    formatElementoGuided({
      referenceKind: 'cadenamiento',
      customReferenceLabel: '',
      referenceValue: '',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: 'Losa',
      description: '',
    }),
    'Elemento: Losa'
  );

  assert.strictEqual(
    effectiveReferenceValue({
      referenceKind: 'tramo',
      customReferenceLabel: '',
      referenceValue: 'Tramo 2',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: '',
      description: '',
    }),
    'Tramo 2'
  );

  assert.strictEqual(
    formatElementoGuided({
      referenceKind: 'tramo',
      customReferenceLabel: '',
      referenceValue: 'Tramo 2',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: '',
      description: 'solo notas',
    }),
    'Tramo: Tramo 2 Descripción: solo notas'
  );

  assert.strictEqual(
    formatElementoGuided({
      referenceKind: 'otro',
      customReferenceLabel: 'Sección',
      referenceValue: 'B',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: 'Zapata Z-4',
      description: '',
    }),
    'Sección: B Elemento: Zapata Z-4'
  );

  const ex = ELEMENTO_QUICK_EXAMPLES[0];
  assert.ok(formatElementoGuided(ex.parts).includes('Cadenamiento: KM 3+944'));
  assert.ok(formatElementoGuided(ex.parts).includes('Elemento: Muro 2'));

  assert.strictEqual(referenceKindToLabel('pk', ''), 'PK / Kilometraje');

  assert.deepStrictEqual(parseKmPlusPattern('KM 12+380'), { km: '12', meters: '380' });
  assert.deepStrictEqual(parseKmPlusPattern('3+944'), { km: '3', meters: '944' });

  console.log('formatElemento tests OK');
}

run();
