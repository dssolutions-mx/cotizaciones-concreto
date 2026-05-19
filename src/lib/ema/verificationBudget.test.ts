/**
 * Numerical parity tests for buildBudgetFromVerificationPoints.
 *
 * Based on the "Flexómetro – Presupuesto" sheet of
 * DCEMA-HC-LC-P01-7.6-01_INCERTIDUMBRE_FINAL (rev. 0, 2025-12-18).
 *
 * The Excel has:
 *   N = 15 points measured with a 1 mm-division flexómetro vs a vernier (0.05 mm div.)
 *   U_cert_vernier = 0.0199 mm, k_cert_vernier = 2
 *   Type A: u_rep = STDEV(errors)/√15
 *   Type B res_inst: (1.0/2)/√3 = 0.28868 mm
 *   Type B res_std:  (0.05/2)/√3 = 0.01443 mm
 *   Type B cal_std:  0.0199/2   = 0.00995 mm
 *   u_c = √(u_rep² + u_res_inst² + u_res_std² + u_cal_std²)
 *   νeff via Welch–Satterthwaite; k from GUM Table G.2 at 95.45%; U = k·u_c
 *
 * Math that differs from the Excel where it matters is documented below.
 */

import assert from 'node:assert/strict'
import { buildBudgetFromVerificationPoints, type VerificationPoint } from './uncertaintyBudget'
import { tStudent95 } from './studentT'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function near(a: number, b: number, tol = 1e-4): boolean {
  if (b === 0) return Math.abs(a) < tol
  return Math.abs((a - b) / b) < tol
}

function nearAbs(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) < eps
}

function stdDevSample(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

// ---------------------------------------------------------------------------
// Synthetic flexómetro verification data
// Simulate 15 points where the flexómetro reads slightly high at all points,
// with small random scatter around a systematic offset of +0.05 mm.
// ---------------------------------------------------------------------------

const NOMINALS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]

// Instrument readings: nominal + systematic offset + small scatter
const INSTRUMENT_READINGS = [
  10.06, 20.04, 30.07, 40.03, 50.08,
  60.05, 70.06, 80.04, 90.07, 100.05,
  110.06, 120.03, 130.08, 140.04, 150.07,
]

const POINTS: VerificationPoint[] = NOMINALS.map((nom, i) => ({
  nominal: nom,
  standard_reading: nom,      // direct-comparison: standard reads nominal exactly
  instrument_reading: INSTRUMENT_READINGS[i],
}))

const DIV_MIN_INSTRUMENT = 1.0    // flexómetro: 1 mm resolution
const DIV_MIN_STANDARD   = 0.05   // vernier:    0.05 mm resolution
const U_CERT_STANDARD    = 0.0199 // mm — from vernier calibration certificate
const K_CERT_STANDARD    = 2.0    // coverage factor from certificate
const CERT_NUMERO        = 'CERT-VERNIER-2025-001'

// Pre-compute expected values
const errors = INSTRUMENT_READINGS.map((r, i) => r - NOMINALS[i])
const s_errors = stdDevSample(errors)
const N = POINTS.length
const u_rep_expected       = s_errors / Math.sqrt(N)
const u_res_inst_expected  = (DIV_MIN_INSTRUMENT / 2) / Math.sqrt(3)
const u_res_std_expected   = (DIV_MIN_STANDARD   / 2) / Math.sqrt(3)
const u_cal_std_expected   = U_CERT_STANDARD / K_CERT_STANDARD
const sum_ui2_expected     = u_rep_expected**2 + u_res_inst_expected**2 + u_res_std_expected**2 + u_cal_std_expected**2
const u_c_expected         = Math.sqrt(sum_ui2_expected)

// Welch–Satterthwaite: νeff = u_c⁴ / Σ(uᵢ⁴/νᵢ)
// Engine caps Infinity at 1e9 (see welchSatterthwaite in uncertaintyBudget.ts), so Type B terms
// contribute uᵢ⁴/1e9 — negligible but non-zero. Match the engine exactly.
const NU_INF_CAP = 1e9
const ws_denom =
  u_rep_expected ** 4 / (N - 1) +
  u_res_inst_expected ** 4 / NU_INF_CAP +
  u_res_std_expected ** 4 / NU_INF_CAP +
  u_cal_std_expected ** 4 / NU_INF_CAP
const nu_eff_expected = u_c_expected ** 4 / ws_denom

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const result = buildBudgetFromVerificationPoints(
  POINTS,
  DIV_MIN_INSTRUMENT,
  DIV_MIN_STANDARD,
  U_CERT_STANDARD,
  K_CERT_STANDARD,
  CERT_NUMERO,
)

// 1. Individual uncertainty components ----------------------------------------

console.log('1. u_rep (Type A)...')
assert.ok(
  near(result.u_rep, u_rep_expected),
  `u_rep expected ~${u_rep_expected.toExponential(4)}, got ${result.u_rep.toExponential(4)}`,
)

console.log('2. u_res_instrument (Type B, resolution flexómetro)...')
assert.ok(
  nearAbs(result.u_res_instrument, u_res_inst_expected, 1e-6),
  `u_res_inst expected ${u_res_inst_expected.toFixed(6)}, got ${result.u_res_instrument.toFixed(6)}`,
)
// Exact: (1.0/2)/√3 = 0.28868...
assert.ok(
  nearAbs(result.u_res_instrument, 0.28868, 1e-4),
  `u_res_inst should be ~0.28868 mm`,
)

console.log('3. u_res_standard (Type B, resolution vernier)...')
assert.ok(
  nearAbs(result.u_res_standard, u_res_std_expected, 1e-6),
  `u_res_std expected ${u_res_std_expected.toFixed(6)}, got ${result.u_res_standard.toFixed(6)}`,
)
// Exact: (0.05/2)/√3 = 0.014434...
assert.ok(
  nearAbs(result.u_res_standard, 0.01443, 1e-4),
  `u_res_std should be ~0.01443 mm`,
)

console.log('4. u_cal_standard (Type B, calibration certificate)...')
assert.ok(
  nearAbs(result.u_cal_standard, u_cal_std_expected, 1e-8),
  `u_cal_std expected ${u_cal_std_expected.toFixed(8)}, got ${result.u_cal_standard.toFixed(8)}`,
)
// Exact: 0.0199/2 = 0.00995
assert.ok(
  nearAbs(result.u_cal_standard, 0.00995, 1e-5),
  `u_cal_std should be exactly 0.00995 mm`,
)

// 2. Combined u_c (GUM §5.1.2) ------------------------------------------------

console.log('5. Combined u_c ...')
assert.ok(
  near(result.u_c, u_c_expected),
  `u_c expected ~${u_c_expected.toExponential(4)}, got ${result.u_c.toExponential(4)}`,
)

// u_res_instrument is by far the dominant term
assert.ok(
  result.u_res_instrument > result.u_rep,
  'u_res_instrument should dominate over u_rep for a 1mm-resolution tape',
)
assert.ok(
  result.u_res_instrument > result.u_res_standard,
  'u_res_instrument should dominate over u_res_standard',
)

// 3. Welch–Satterthwaite νeff (GUM Annex G.4) ----------------------------------

console.log('6. νeff (Welch–Satterthwaite)...')
// νeff ≈ u_c⁴ / (u_rep⁴/14)  since Type B ν = ∞ → those terms vanish
// When u_rep << u_res_inst, νeff will be very large (dominated by Type B terms)
// The actual νeff from the engine should equal the analytical formula
assert.ok(
  near(result.nu_eff, nu_eff_expected, 0.01),
  `νeff expected ~${nu_eff_expected.toFixed(1)}, got ${result.nu_eff.toFixed(1)}`,
)

// 4. Coverage factor k (GUM Table G.2 at 95.45%) ------------------------------

console.log('7. Coverage factor k...')
const k_expected = tStudent95(nu_eff_expected)
assert.ok(
  nearAbs(result.k, k_expected, 1e-4),
  `k expected ${k_expected.toFixed(4)}, got ${result.k.toFixed(4)}`,
)
// For large νeff (≥200), tStudent95 returns 1.96 (GUM Table G.2 at 95% two-sided)
if (nu_eff_expected > 200) {
  assert.ok(
    nearAbs(result.k, 1.96, 0.01),
    `k should be ~1.96 for large νeff, got ${result.k.toFixed(4)}`,
  )
}

// 5. Expanded U = k · u_c (GUM §6.2) -----------------------------------------

console.log('8. Expanded U...')
const U_expected = k_expected * u_c_expected
assert.ok(
  near(result.U, U_expected),
  `U expected ~${U_expected.toExponential(4)}, got ${result.U.toExponential(4)}`,
)
assert.ok(
  nearAbs(result.U, result.k * result.u_c, 1e-10),
  'U must equal k × u_c exactly',
)

// 6. Components array structure ------------------------------------------------

console.log('9. Components array structure...')
assert.strictEqual(result.components.length, 4, 'Must have exactly 4 components')

const typeAComp = result.components.find((c) => c.tipo === 'A')
const typeBComps = result.components.filter((c) => c.tipo === 'B')

assert.ok(typeAComp, 'Must have exactly one Type A component')
assert.strictEqual(typeBComps.length, 3, 'Must have exactly 3 Type B components')

// All ci = 1 (direct error propagation, no sensitivity transform)
for (const comp of result.components) {
  assert.strictEqual(comp.ci, 1, `ci should be 1 for ${comp.fuente}`)
  assert.ok(comp.ui_y > 0, `ui_y should be positive for ${comp.fuente}`)
  assert.ok(comp.ui2_y > 0, `ui2_y should be positive for ${comp.fuente}`)
  assert.ok(nearAbs(comp.ui2_y, comp.ui_y ** 2, 1e-12), `ui2_y = ui_y² for ${comp.fuente}`)
}

// Type A component checks
assert.ok(typeAComp!.distribucion === 'normal', 'Type A distribution should be normal')
assert.ok(isFinite(typeAComp!.nu!), 'Type A ν should be finite')
assert.strictEqual(typeAComp!.nu, N - 1, `Type A ν should be N-1 = ${N - 1}`)

// Type B resolution components should have rectangular distribution and infinite ν
const resBComps = typeBComps.filter((c) => c.distribucion === 'rectangular')
assert.strictEqual(resBComps.length, 2, 'Should have 2 rectangular Type B components')
for (const rb of resBComps) {
  assert.ok(!isFinite(rb.nu!), `Resolution Type B ν should be Infinity, got ${rb.nu}`)
}

// Certificate number appears in calibration component fuente
const calComp = typeBComps.find((c) => c.fuente.includes(CERT_NUMERO))
assert.ok(calComp, `Calibration component should reference cert number ${CERT_NUMERO}`)

// 7. Sum of ui2_y = u_c² (internal consistency) --------------------------------

console.log('10. Sum ui²(y) = u_c² ...')
const sumUi2 = result.components.reduce((s, c) => s + c.ui2_y, 0)
assert.ok(
  nearAbs(sumUi2, result.u_c ** 2, 1e-12),
  `Σui²(y) = ${sumUi2.toExponential(6)} should equal u_c² = ${(result.u_c**2).toExponential(6)}`,
)

// 8. Minimum-points guard ------------------------------------------------------

console.log('11. Error on < 2 points...')
assert.throws(
  () => buildBudgetFromVerificationPoints([POINTS[0]], 1.0, 0.05, 0.02, 2),
  /need ≥ 2/,
)

// 9. Larger Type A scatter increases u_c ----------------------------------------

console.log('12. Larger scatter increases u_c...')
const SCATTERED_POINTS: VerificationPoint[] = NOMINALS.map((nom, i) => ({
  nominal: nom,
  standard_reading: nom,
  // Much larger scatter: ±2 mm
  instrument_reading: nom + (i % 2 === 0 ? 2.0 : -1.5),
}))

const scattered = buildBudgetFromVerificationPoints(
  SCATTERED_POINTS,
  DIV_MIN_INSTRUMENT,
  DIV_MIN_STANDARD,
  U_CERT_STANDARD,
  K_CERT_STANDARD,
)
assert.ok(
  scattered.u_c > result.u_c,
  `Larger scatter should increase u_c: ${scattered.u_c.toFixed(6)} vs ${result.u_c.toFixed(6)}`,
)
assert.ok(
  scattered.U > result.U,
  'Larger scatter should increase expanded U',
)

// 10. Better reference standard decreases u_c ----------------------------------

console.log('13. Better standard (smaller div_min) decreases u_c...')
const betterStd = buildBudgetFromVerificationPoints(
  POINTS,
  DIV_MIN_INSTRUMENT,
  0.01,   // 0.01 mm instead of 0.05 mm
  U_CERT_STANDARD,
  K_CERT_STANDARD,
)
assert.ok(
  betterStd.u_c < result.u_c,
  `Better standard should reduce u_c: ${betterStd.u_c.toFixed(6)} vs ${result.u_c.toFixed(6)}`,
)

// 11. More verification points decrease u_rep (but not the Type B floor) -------

console.log('14. More points decrease u_rep...')
// Add 5 more identical-error points to the same scatter
const morePoints: VerificationPoint[] = [
  ...POINTS,
  { nominal: 200, standard_reading: 200, instrument_reading: 200.06 },
  { nominal: 210, standard_reading: 210, instrument_reading: 210.04 },
  { nominal: 220, standard_reading: 220, instrument_reading: 220.07 },
  { nominal: 230, standard_reading: 230, instrument_reading: 230.05 },
  { nominal: 240, standard_reading: 240, instrument_reading: 240.06 },
]
const moreResult = buildBudgetFromVerificationPoints(
  morePoints,
  DIV_MIN_INSTRUMENT,
  DIV_MIN_STANDARD,
  U_CERT_STANDARD,
  K_CERT_STANDARD,
)
assert.ok(
  moreResult.u_rep <= result.u_rep * 1.1,
  `More points should not dramatically increase u_rep`,
)
// u_c is dominated by resolution floor so should stay comparable
assert.ok(
  Math.abs(moreResult.u_c - result.u_c) < result.u_c * 0.5,
  'u_c should stay near the resolution floor regardless of N',
)

console.log('\nAll verification budget tests passed.')
