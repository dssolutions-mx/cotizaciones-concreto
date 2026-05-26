/**
 * Tests for unit conversion helpers used in the EMA uncertainty pipeline.
 * Run: npx tsx src/lib/ema/units.test.ts
 */

import assert from 'node:assert/strict';
import { convertForceUnit, convertLengthUnit, convertUnit, isForceUnit, isLengthUnit } from './units';

console.log('units — convertLengthUnit / convertUnit');

// mm <-> cm <-> m
assert.equal(convertLengthUnit(10, 'mm', 'cm'), 1, 'mm→cm: 10 mm = 1 cm');
assert.equal(convertLengthUnit(1, 'cm', 'mm'), 10, 'cm→mm: 1 cm = 10 mm');
assert.equal(convertLengthUnit(1, 'm', 'mm'), 1000, 'm→mm: 1 m = 1000 mm');
assert.equal(convertLengthUnit(1000, 'mm', 'm'), 1, 'mm→m: 1000 mm = 1 m');
assert.equal(convertLengthUnit(100, 'cm', 'm'), 1, 'cm→m: 100 cm = 1 m');

// The specific REV-flexómetro case: U = 0.579072 mm should become 0.0579072 cm
const Umm = 0.579072;
const Ucm = convertLengthUnit(Umm, 'mm', 'cm');
assert.ok(Ucm !== null, 'mm→cm should succeed');
assert.ok(Math.abs(Ucm! - 0.0579072) < 1e-9, `0.579072 mm → 0.0579072 cm; got ${Ucm}`);

// Round-trip
const back = convertLengthUnit(Ucm!, 'cm', 'mm');
assert.ok(Math.abs(back! - Umm) < 1e-9, 'mm→cm→mm round-trip');

// Case-insensitivity / whitespace
assert.equal(convertLengthUnit(1, 'CM', 'mm'), 10, 'case-insensitive');
assert.equal(convertLengthUnit(1, ' cm ', 'mm'), 10, 'trims whitespace');

// Unsupported units return null
assert.equal(convertLengthUnit(1, 'mm', 'kg'), null, 'unsupported target unit');
assert.equal(convertLengthUnit(1, '°C', 'cm'), null, 'unsupported source unit');

// isLengthUnit
assert.ok(isLengthUnit('mm'));
assert.ok(isLengthUnit('cm'));
assert.ok(isLengthUnit('m'));
assert.ok(!isLengthUnit('°C'));
assert.ok(!isLengthUnit(''));

// convertUnit dispatcher
const same = convertUnit(5, 'cm', 'cm');
assert.ok(same && same.value === 5 && same.converted === false, 'same-unit → no conversion');

const len = convertUnit(0.579072, 'mm', 'cm');
assert.ok(len && Math.abs(len.value - 0.0579072) < 1e-9 && len.converted === true);

const unknown = convertUnit(1, 'mm', 'g');
assert.equal(unknown, null, 'unsupported pair returns null');

// Force: kN → kgf (lab context: kg ≈ kgf)
assert.ok(isForceUnit('kN'));
assert.ok(isForceUnit('kg'));
const knToKgf = convertForceUnit(1, 'kN', 'kgf');
assert.ok(knToKgf !== null && Math.abs(knToKgf - 101.9716213) < 1e-4, '1 kN ≈ 101.97 kgf');
const knToKg = convertUnit(2, 'kN', 'kg');
assert.ok(knToKg && knToKg.converted && Math.abs(knToKg.value - 203.9432426) < 1e-3);

console.log('  ✓ all units tests passed');
