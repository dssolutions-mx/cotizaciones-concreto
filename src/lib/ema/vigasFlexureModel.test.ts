/**
 * VIGAS flexure model — MR and sensitivity (four-point default).
 * Run: npx tsx src/lib/ema/vigasFlexureModel.test.ts
 */

import assert from 'node:assert/strict';
import {
  VIGAS_DEFAULTS,
  VIGAS_SCHEME_FOUR_POINT,
  VIGAS_SCHEME_THIRD_POINT,
  buildVigasSensitivityContext,
  computeVigasMR,
  injectVigasStudyConstants,
  isLegacyVigasEnv,
  parseVigasStudyConfig,
  validateVigasStudyConfig,
  vigasReplicaInputsComplete,
  vigasSensitivityCoefficient,
} from './vigasFlexureModel';

console.log('vigasFlexureModel');

const fourCfg = parseVigasStudyConfig({ _scheme: VIGAS_SCHEME_FOUR_POINT, L_span: 45, four_point_a_cm: 15 });
assert.equal(fourCfg.loading_scheme, 'four_point', 'default scheme is four_point');
assert.equal(fourCfg.L_span_cm, 45);
assert.equal(fourCfg.four_point_a_cm, 15);

const mrFour = computeVigasMR(fourCfg, { P: 3375, b: 15, d: 15 });
assert.ok(mrFour !== null, 'four-point MR computes');
// MR = 3375 * 15 / (15^3) = 3375/225 = 15
assert.ok(Math.abs(mrFour! - 15) < 1e-9, `four-point MR ≈ 15; got ${mrFour}`);

const thirdCfg = parseVigasStudyConfig({ _scheme: VIGAS_SCHEME_THIRD_POINT, L_span: 45 });
const mrThird = computeVigasMR(thirdCfg, { P: 3375, b: 15, d: 15 });
// MR = 3375 * 45 / 3375 = 45
assert.ok(mrThird !== null && Math.abs(mrThird! - 45) < 1e-9, `third-point MR ≈ 45; got ${mrThird}`);

const replicas = [
  { raw_values_json: { P: 3000, b: 15, d: 15 } },
  { raw_values_json: { P: 3750, b: 15, d: 15 } },
];
const ctx = buildVigasSensitivityContext(fourCfg, replicas);
assert.equal(ctx.loading_scheme, 'four_point');
assert.ok(ctx.MR_mean && ctx.P_mean && ctx.b_mean && ctx.d_mean);
const cP = vigasSensitivityCoefficient('P', ctx);
assert.ok(Math.abs(cP - ctx.MR_mean! / ctx.P_mean!) < 1e-9, 'c_P = MR/P');
const cL = vigasSensitivityCoefficient('L', ctx);
assert.equal(cL, 0, 'four-point: c_L = 0');
const ca = vigasSensitivityCoefficient('a', ctx);
assert.ok(Math.abs(ca - ctx.MR_mean! / ctx.a_mean!) < 1e-9, 'c_a = MR/a');

const legacy = parseVigasStudyConfig({ L_span: 40 });
assert.equal(legacy.loading_scheme, VIGAS_DEFAULTS.loading_scheme, 'legacy L_span only → four_point default');

assert.equal(isLegacyVigasEnv({ L_span: 45 }), true);
assert.equal(isLegacyVigasEnv({ _scheme: 0, L_span: 45 }), false);

const rawThird = injectVigasStudyConstants(thirdCfg, { P: 1, b: 1, d: 1, a: 99 });
assert.equal(rawThird.a, undefined, 'third_point inject removes stale a');

assert.equal(vigasReplicaInputsComplete({ P: 1, b: 1, d: 1 }), true);
assert.equal(vigasReplicaInputsComplete({ P: 1, b: 1 }), false);

const issues = validateVigasStudyConfig({
  ...fourCfg,
  four_point_a_cm: 30,
  L_span_cm: 45,
});
assert.ok(issues.some((m) => m.includes('L/2')), 'invalid a warns');

console.log('  ✓ all vigasFlexureModel tests passed');
