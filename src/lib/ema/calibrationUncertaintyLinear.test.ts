import assert from 'node:assert/strict';
import {
  linearUncertaintyMicrometersAtLmm,
  linearUncertaintyMicrometersMaxOnClosedInterval,
  micrometersToMm,
  parseMedicionIntervalMaxMm,
  parseMedicionIntervalMinMaxMm,
} from './calibrationUncertaintyLinear';

assert.equal(linearUncertaintyMicrometersAtLmm(9.9, 0.01, 0), 9.9);
assert.equal(linearUncertaintyMicrometersAtLmm(9.9, 0.01, 600), 15.9);
assert.equal(linearUncertaintyMicrometersAtLmm(9.9, 0.01, 1000), 19.9);
assert.equal(micrometersToMm(15.9), 0.0159);

assert.equal(linearUncertaintyMicrometersMaxOnClosedInterval(9.9, 0.01, 0, 600), 15.9);
assert.equal(linearUncertaintyMicrometersMaxOnClosedInterval(9.9, 0.01, 600, 0), 15.9);

assert.equal(parseMedicionIntervalMaxMm('0 mm-600 mm'), 600);
assert.equal(parseMedicionIntervalMaxMm('0 mm hasta 600 mm'), 600);
assert.equal(parseMedicionIntervalMaxMm('0–600 mm'), 600);
assert.equal(parseMedicionIntervalMaxMm('0 a 600 mm'), 600);
assert.equal(parseMedicionIntervalMaxMm(null), null);
assert.deepEqual(parseMedicionIntervalMinMaxMm('0 mm-600 mm'), { min: 0, max: 600 });

console.log('calibrationUncertaintyLinear.test.ts OK');
