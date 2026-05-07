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
  guidedFrenteIsComplete,
  formatFrenteSegment,
} from './formatElemento';

function run() {
  assert.strictEqual(
    formatElementoGuided({
      frenteChoice: '1',
      frenteOtroText: '',
      referenceKind: 'cadenamiento',
      customReferenceLabel: '',
      referenceValue: '',
      chainageKm: '3',
      chainageMeters: '944',
      elementoStructural: 'Muro 2',
      description: 'cabecero aguas abajo/ eje 2/ paso ganadero',
    }),
    'Frente: Frente 1 Cadenamiento: KM 3+944 Elemento: Muro 2 Descripción: cabecero aguas abajo/ eje 2/ paso ganadero'
  );

  assert.strictEqual(formatChainageSegment('cadenamiento', '12', '380'), 'KM 12+380');
  assert.strictEqual(formatChainageSegment('pk', '12', '400'), '12+400');

  assert.strictEqual(
    formatElementoGuided({
      frenteChoice: '1',
      frenteOtroText: '',
      referenceKind: 'cadenamiento',
      customReferenceLabel: '',
      referenceValue: '',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: 'Losa',
      description: '',
    }),
    'Frente: Frente 1 Elemento: Losa'
  );

  assert.strictEqual(
    effectiveReferenceValue({
      frenteChoice: '',
      frenteOtroText: '',
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
      frenteChoice: '2',
      frenteOtroText: '',
      referenceKind: 'tramo',
      customReferenceLabel: '',
      referenceValue: 'Tramo 2',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: '',
      description: 'solo notas',
    }),
    'Frente: Frente 2 Tramo: Tramo 2 Descripción: solo notas'
  );

  assert.strictEqual(
    formatElementoGuided({
      frenteChoice: '1',
      frenteOtroText: '',
      referenceKind: 'otro',
      customReferenceLabel: 'Sección',
      referenceValue: 'B',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: 'Zapata Z-4',
      description: '',
    }),
    'Frente: Frente 1 Sección: B Elemento: Zapata Z-4'
  );

  const ex = ELEMENTO_QUICK_EXAMPLES[0];
  assert.ok(formatElementoGuided(ex.parts).includes('Frente: Frente 1'));
  assert.ok(formatElementoGuided(ex.parts).includes('Cadenamiento: KM 3+944'));

  assert.strictEqual(referenceKindToLabel('pk', ''), 'PK / Kilometraje');

  assert.deepStrictEqual(parseKmPlusPattern('KM 12+380'), { km: '12', meters: '380' });

  assert.strictEqual(guidedFrenteIsComplete({ ...ex.parts, frenteChoice: '' }), false);
  assert.strictEqual(guidedFrenteIsComplete({ ...ex.parts, frenteChoice: 'otro', frenteOtroText: '' }), false);
  assert.strictEqual(formatFrenteSegment({ ...ex.parts, frenteChoice: 'otro', frenteOtroText: '  Norte  ' }), 'Frente: Norte');

  console.log('formatElemento tests OK');
}

run();
