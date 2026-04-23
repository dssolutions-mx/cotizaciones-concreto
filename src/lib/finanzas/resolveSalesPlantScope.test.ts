/**
 * Run: npx tsx src/lib/finanzas/resolveSalesPlantScope.test.ts
 */
import assert from 'assert';
import {
  normalizeBaseAccessiblePlantIds,
  resolveEffectiveSalesPlantIds,
} from './resolveSalesPlantScope';

function run() {
  const picker = ['p1', 'p2', 'p3'];

  assert.deepStrictEqual(
    normalizeBaseAccessiblePlantIds(null, picker),
    ['p1', 'p2', 'p3'],
    'ACL null (global) → enumerate picker plants'
  );

  assert.deepStrictEqual(
    normalizeBaseAccessiblePlantIds(['p1'], picker),
    ['p1'],
    'ACL array is passed through unchanged'
  );

  assert.deepStrictEqual(
    resolveEffectiveSalesPlantIds([], ['p1', 'p2']),
    ['p1', 'p2'],
    'Empty selection → full base scope'
  );

  assert.deepStrictEqual(
    resolveEffectiveSalesPlantIds(['p2'], ['p1', 'p2']),
    ['p2'],
    'Selection intersects base'
  );

  assert.deepStrictEqual(
    resolveEffectiveSalesPlantIds(['p9'], ['p1', 'p2']),
    [],
    'Selection outside base → empty effective scope'
  );

  assert.deepStrictEqual(
    resolveEffectiveSalesPlantIds(['p1'], []),
    [],
    'Empty base → empty effective scope'
  );

  console.log('resolveSalesPlantScope tests: OK');
}

run();
