/**
 * Excel-alignment parity tests for the GUM uncertainty budget engine.
 *
 * Reference: DCEMA-HC-LC-P01-7.6-01_INCERTIDUMBRE_FINAL.xlsx (rev. 0, 2025-12-18)
 *
 * Each section corresponds to one Excel sheet with all contributors as seeded in
 * 20260519220000_ema_uncertainty_fc_cubo_and_contributors.sql.
 *
 * Mathematical divergences from the Excel are documented inline.
 * All tests use GUM-canonical math (system correct; Excel errors not replicated).
 *
 * Tolerance: nearAbs(epsilon) or near(relative 1e-4) as noted per assertion.
 */

import assert from 'node:assert/strict';
import { tStudent95 } from './studentT';
import {
  buildBudget,
  sensitivityCoefficient,
  mean,
} from './uncertaintyBudget';

const near = (a: number, b: number, tol = 1e-4) =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

const nearAbs = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

// ===========================================================================
// 1. Temperatura del concreto (TEMP)
//    Excel sheet: "Temperatura – Presupuesto"
//    Contributors: Repetibilidad, Resolución, Calibración, T_grad, T_drift
// ===========================================================================
console.log('1. TEMP — Temperatura del concreto');

const tempReplicas = [23.5, 23.8, 23.2, 23.1, 22.9, 24.0, 23.6, 23.5, 23.4, 23.8];
const tempMean = mean(tempReplicas);

const tempBudget = buildBudget({
  measurandCode: 'TEMP',
  measurandName: 'Temperatura del concreto',
  unit: '°C',
  replicaValues: tempReplicas,
  typeBInputs: [
    {
      fuente: 'Resolución del termómetro',
      magnitud_xi: 'Temperatura',
      unidad: '°C',
      valor_xi: tempMean,
      kind: 'resolution',
      divMin: 0.1,
      categoria: 'resolution',
    },
    {
      fuente: 'Calibración del termómetro',
      magnitud_xi: 'Temperatura',
      unidad: '°C',
      valor_xi: tempMean,
      kind: 'calibration',
      U_cert: 0.4,
      k_cert: 2,
      categoria: 'calibration',
    },
    // T_grad — environmental: gradiente de temperatura en la masa (halfWidth 0.5 °C, NMX-C-025 §7)
    {
      fuente: 'Gradiente de temperatura en la masa',
      magnitud_xi: 'T_grad',
      unidad: '°C',
      valor_xi: 0.5,
      kind: 'rectangular',
      halfWidth: 0.5,
      norma_ref_override: 'NMX-C-025 §7',
      categoria: 'environmental',
    },
    // T_drift — systematic: deriva del termómetro entre calibraciones (halfWidth 0.1 °C)
    {
      fuente: 'Deriva del termómetro entre calibraciones',
      magnitud_xi: 'T_drift',
      unidad: '°C',
      valor_xi: 0.1,
      kind: 'rectangular',
      halfWidth: 0.1,
      norma_ref_override: 'fabricante',
      categoria: 'systematic',
    },
  ],
});

assert.ok(tempBudget.components.length === 5, `TEMP: 5 components (1A+4B), got ${tempBudget.components.length}`);
assert.ok(tempBudget.components.filter((c) => c.tipo === 'A').length === 1, 'TEMP: 1 Type A');
assert.ok(tempBudget.components.filter((c) => c.tipo === 'B').length === 4, 'TEMP: 4 Type B');

// Category chips correctly assigned
const tempCats = tempBudget.components.map((c) => c.categoria);
assert.ok(tempCats.includes('repeatability'), 'TEMP: repeatability chip');
assert.ok(tempCats.includes('resolution'), 'TEMP: resolution chip');
assert.ok(tempCats.includes('calibration'), 'TEMP: calibration chip');
assert.ok(tempCats.includes('environmental'), 'TEMP: environmental chip');
assert.ok(tempCats.includes('systematic'), 'TEMP: systematic chip');

// GUM quadrature combination (GUM §5.1.2)
const tempSumSq = tempBudget.components.reduce((s, c) => s + c.ui2_y, 0);
assert.ok(near(tempBudget.u_c, Math.sqrt(tempSumSq)), 'TEMP: u_c = √Σuᵢ²(y)');
assert.ok(near(tempBudget.U, tempBudget.k * tempBudget.u_c), 'TEMP: U = k·u_c');

// k from GUM Table G.2 at 95.45%
assert.ok(near(tempBudget.k, tStudent95(tempBudget.nu_eff), 1e-3), 'TEMP: k from t-table');

// Environmental contributor T_grad: u = halfWidth/√3 = 0.5/√3
const tGrad = tempBudget.components.find((c) => c.magnitud_xi === 'T_grad')!;
assert.ok(tGrad !== undefined, 'TEMP: T_grad component present');
assert.ok(nearAbs(tGrad.u_xi, 0.5 / Math.sqrt(3), 1e-6),
  `TEMP: u(T_grad) = 0.5/√3 = ${(0.5/Math.sqrt(3)).toExponential(4)}, got ${tGrad.u_xi.toExponential(4)}`);
assert.ok(nearAbs(tGrad.ci, 1, 1e-9), 'TEMP: ci(T_grad) = 1');

// Systematic contributor T_drift: u = 0.1/√3
const tDrift = tempBudget.components.find((c) => c.magnitud_xi === 'T_drift')!;
assert.ok(nearAbs(tDrift.u_xi, 0.1 / Math.sqrt(3), 1e-6), 'TEMP: u(T_drift) = 0.1/√3');

assert.ok(tempBudget.U > 0, 'TEMP: U > 0');

console.log(`  u_c=${tempBudget.u_c.toExponential(4)} °C  U=${tempBudget.U.toExponential(4)} °C  k=${tempBudget.k.toFixed(3)}`);
console.log('  ✓ TEMP');

// ===========================================================================
// 2. Revenimiento (REV)
//    Excel sheet: "Revenimiento – Presupuesto"
//    Contributors: Repetibilidad, Resolución, Calibración
//    NOTE: R_temp and R_op were removed per the norm revision (2026-05-23).
//    Environmental/method contributions are now user-defined per-study via
//    ema_uncertainty_study_custom_inputs (StudyCustomInput).
// ===========================================================================
console.log('2. REV — Revenimiento');

const revReplicas = [18.0, 17.0, 19.0, 18.0, 17.0, 19.0, 17.0, 18.0, 18.0, 19.0]; // cm
const revMean = mean(revReplicas);

const revBudget = buildBudget({
  measurandCode: 'REV',
  measurandName: 'Revenimiento',
  unit: 'cm',
  replicaValues: revReplicas,
  typeBInputs: [
    {
      fuente: 'Resolución del instrumento (flexómetro)',
      magnitud_xi: 'R',
      unidad: 'cm',
      valor_xi: revMean,
      kind: 'resolution',
      divMin: 0.1,
      categoria: 'resolution',
    },
    {
      fuente: 'Calibración del instrumento',
      magnitud_xi: 'R',
      unidad: 'cm',
      valor_xi: revMean,
      kind: 'calibration',
      U_cert: 1.0,
      k_cert: 2,
      categoria: 'calibration',
    },
  ],
});

// 3 components: Repetibilidad + Resolución + Calibración
assert.ok(revBudget.components.length === 3, `REV: 3 components (R_temp/R_op removed), got ${revBudget.components.length}`);
assert.ok(near(revBudget.U, revBudget.k * revBudget.u_c), 'REV: U = k·u_c');

// REV: all ci = 1 (direct measurand)
assert.ok(revBudget.components.every((c) => near(c.ci, 1)), 'REV: all ci = 1');

// Resolution: u = (divMin/2)/√3 = 0.1/(2√3)
const revRes = revBudget.components.find((c) => c.categoria === 'resolution')!;
assert.ok(nearAbs(revRes.u_xi, 0.1 / (2 * Math.sqrt(3)), 1e-6), 'REV: u(resolución) = divMin/(2√3)');

// Calibration: u = U_cert/k = 1.0/2
const revCal = revBudget.components.find((c) => c.categoria === 'calibration')!;
assert.ok(nearAbs(revCal.u_xi, 1.0 / 2, 1e-6), 'REV: u(calibración) = U_cert/k');

// Smoke-test: user-defined custom variable (extra Type A) is accepted by engine
const revBudgetWithCustom = buildBudget({
  measurandCode: 'REV',
  measurandName: 'Revenimiento',
  unit: 'cm',
  replicaValues: revReplicas,
  typeBInputs: [],
  extraTypeAInputs: [
    { fuente: 'Variable personalizada A', simbolo: 'V_a', unidad: 'cm', mean: 18, s: 0.5, n: 5 },
  ],
});
const customComp = revBudgetWithCustom.components.find((c) => c.magnitud_xi === 'V_a')!;
assert.ok(customComp, 'REV: custom Type A component appears in budget');
assert.ok(nearAbs(customComp.u_xi, 0.5 / Math.sqrt(5), 1e-6), 'REV: custom Type A u = s/√n');
assert.ok(customComp.nu === 4, 'REV: custom Type A ν = n-1 = 4');
assert.ok(customComp.categoria === 'custom', 'REV: custom Type A has categoria=custom');

console.log(`  u_c=${revBudget.u_c.toExponential(4)} cm  U=${revBudget.U.toExponential(4)} cm  k=${revBudget.k.toFixed(3)}`);
console.log('  ✓ REV');

// ===========================================================================
// 3. Contenido de aire (AIRE)
//    Excel sheet: "Contenido de aire – Presupuesto"
//    Contributors: Repetibilidad, Resolución, A_temp, A_consol
// ===========================================================================
console.log('3. AIRE — Contenido de aire');

const aireReplicas = [1.5, 1.4, 1.3, 1.1, 1.6, 1.5, 1.6, 1.7, 1.7, 1.5]; // %
const aireMean = mean(aireReplicas);

const aireBudget = buildBudget({
  measurandCode: 'AIRE',
  measurandName: 'Contenido de aire',
  unit: '%',
  replicaValues: aireReplicas,
  typeBInputs: [
    {
      fuente: 'Resolución del medidor',
      magnitud_xi: 'A',
      unidad: '%',
      valor_xi: aireMean,
      kind: 'resolution',
      divMin: 0.1,
      categoria: 'resolution',
    },
    // A_temp — environmental: efecto T sobre lectura del manómetro
    {
      fuente: 'Efecto T sobre lectura del manómetro',
      magnitud_xi: 'A_temp',
      unidad: '%',
      valor_xi: 0.05,
      kind: 'rectangular',
      halfWidth: 0.05,
      norma_ref_override: 'NMX-C-162 §7',
      categoria: 'environmental',
    },
    // A_consol — method: variación por consolidación / vibrado
    {
      fuente: 'Variación por consolidación / vibrado',
      magnitud_xi: 'A_consol',
      unidad: '%',
      valor_xi: 0.1,
      kind: 'rectangular',
      halfWidth: 0.1,
      norma_ref_override: 'NMX-C-162 §8.2',
      categoria: 'method',
    },
  ],
});

assert.ok(aireBudget.components.length === 4, `AIRE: 4 components (1A+3B), got ${aireBudget.components.length}`);
assert.ok(near(aireBudget.U, aireBudget.k * aireBudget.u_c), 'AIRE: U = k·u_c');
assert.ok(aireBudget.U_rel_pct !== null && aireBudget.U_rel_pct > 0, 'AIRE: U_rel_pct > 0');

const aireCats = aireBudget.components.map((c) => c.categoria);
assert.ok(aireCats.includes('environmental'), 'AIRE: A_temp → environmental');
assert.ok(aireCats.includes('method'), 'AIRE: A_consol → method');

// A_temp: u = 0.05/√3
const aTemp = aireBudget.components.find((c) => c.magnitud_xi === 'A_temp')!;
assert.ok(nearAbs(aTemp.u_xi, 0.05 / Math.sqrt(3), 1e-7), 'AIRE: u(A_temp) = 0.05/√3');

// A_consol: u = 0.1/√3
const aConsol = aireBudget.components.find((c) => c.magnitud_xi === 'A_consol')!;
assert.ok(nearAbs(aConsol.u_xi, 0.1 / Math.sqrt(3), 1e-6), 'AIRE: u(A_consol) = 0.1/√3');

console.log(`  u_c=${aireBudget.u_c.toExponential(4)} %  U=${aireBudget.U.toExponential(4)} %  k=${aireBudget.k.toFixed(3)}`);
console.log('  ✓ AIRE');

// ===========================================================================
// 4. Masa Unitaria (MU)
//    Excel sheet: "Masa Unitaria – Presupuesto"
//    Contributors: Repetibilidad, Resolución balanza, Calibración balanza,
//                  V_recip (ci = |MU/V|), rho_agua (ci = 1)
//
//    DIVERGENCE: V_recip has ci ≈ 325.8 (kg/m³)/L — NOT 1 as in Excel.
//    u(V_recip) × ci ≈ (0.02/√3) × 325.8 ≈ 3.76 kg/m³ (dominant contributor).
//    The Excel uses ci=1 which under-estimates this contribution by ~325×.
// ===========================================================================
console.log('4. MU — Masa Unitaria');

const MU_MEAN = 2300;   // kg/m³
const V_REC = 7.06;     // L (standard cylinder)

// Sensitivity coefficient c_V = -(MU/V)   (GUM §5.1.3, ∂(M/V)/∂V = -M/V²)
const c_V = sensitivityCoefficient('MU', 'V_recip', { mu_mean: MU_MEAN, V_recipiente: V_REC });
assert.ok(c_V < 0, `MU: c_V must be negative, got ${c_V}`);
assert.ok(nearAbs(c_V, -(MU_MEAN / V_REC), 1e-3), `MU: c_V = -MU/V = ${-(MU_MEAN/V_REC).toFixed(2)}`);
// With MU=2300, V=7.06: |ci| ≈ 325.78 (kg/m³)/L
assert.ok(Math.abs(c_V) > 300 && Math.abs(c_V) < 380, `MU: |c_V| ≈ 325.8, got ${Math.abs(c_V).toFixed(1)}`);

const muReplicas = [2298, 2300, 2302, 2299, 2301, 2300, 2298, 2303, 2300, 2299];
const masa_media = 16.24; // kg (representative fill mass)

const muBudget = buildBudget({
  measurandCode: 'MU',
  measurandName: 'Masa Unitaria',
  unit: 'kg/m³',
  replicaValues: muReplicas,
  typeBInputs: [
    // Resolución balanza: div.mín = 0.1 g = 0.0001 kg; ci = 1/V
    {
      fuente: 'Resolución de la balanza',
      magnitud_xi: 'masa',
      unidad: 'kg',
      valor_xi: masa_media,
      kind: 'resolution',
      divMin: 0.0001,
      ci_override: 1 / V_REC,
      categoria: 'resolution',
    },
    // Calibración balanza: U_cert = 0.002 kg, k = 2; ci = 1/V
    {
      fuente: 'Calibración de la balanza',
      magnitud_xi: 'masa',
      unidad: 'kg',
      valor_xi: masa_media,
      kind: 'calibration',
      U_cert: 0.002,
      k_cert: 2,
      ci_override: 1 / V_REC,
      categoria: 'calibration',
    },
    // V_recip — environmental: ci = |MU/V| ≈ 325.8  (high-impact!)
    {
      fuente: 'Calibración del recipiente (volumen)',
      magnitud_xi: 'V_recip',
      unidad: 'L',
      valor_xi: 0.02,
      kind: 'rectangular',
      halfWidth: 0.02,
      ci_override: Math.abs(c_V),
      norma_ref_override: 'NMX-C-073',
      categoria: 'environmental',
    },
    // rho_agua — environmental: ci = 1
    {
      fuente: 'Efecto T sobre densidad del agua',
      magnitud_xi: 'rho_agua',
      unidad: 'kg/m³',
      valor_xi: 0.3,
      kind: 'rectangular',
      halfWidth: 0.3,
      ci_override: 1,
      norma_ref_override: 'NMX-C-073',
      categoria: 'environmental',
    },
  ],
  sensitivityContext: { mu_mean: MU_MEAN, V_recipiente: V_REC },
});

assert.ok(muBudget.components.length === 5, `MU: 5 components, got ${muBudget.components.length}`);
assert.ok(near(muBudget.U, muBudget.k * muBudget.u_c), 'MU: U = k·u_c');

// V_recip component: ui_y = |c_V| × (0.02/√3)
const vRecipComp = muBudget.components.find((c) => c.magnitud_xi === 'V_recip')!;
assert.ok(vRecipComp !== undefined, 'MU: V_recip component present');
const expectedUiV = Math.abs(c_V) * (0.02 / Math.sqrt(3));
assert.ok(nearAbs(vRecipComp.ui_y, expectedUiV, 0.01),
  `MU: ui_y(V_recip) ≈ ${expectedUiV.toFixed(2)} kg/m³, got ${vRecipComp.ui_y.toFixed(2)}`);
// V_recip should dominate over rho_agua
const rhoComp = muBudget.components.find((c) => c.magnitud_xi === 'rho_agua')!;
assert.ok(vRecipComp.ui_y > rhoComp.ui_y, 'MU: V_recip dominates over rho_agua');

console.log(`  u_c=${muBudget.u_c.toExponential(4)} kg/m³  U=${muBudget.U.toExponential(4)} kg/m³  k=${muBudget.k.toFixed(3)}`);
console.log(`  V_recip ui_y=${vRecipComp.ui_y.toFixed(2)} kg/m³  (ci=${Math.abs(c_V).toFixed(1)}) — dominant`);
console.log('  ✓ MU');

// ===========================================================================
// 5. Resistencia a la compresión — cubo (FC_CUBO)
//    Excel sheet: "Resistencia – Cubo"
//    f'c = Carga / (L1 × L2)
//    Contributors: Repetibilidad, Resolución prensa, Calibración prensa,
//                  capping (ci=1), L_meas_err (ci=|2·f'c/L|)
//
//    DIVERGENCE: system propagates u(Carga) and u(L) separately with their
//    respective sensitivity coefficients (GUM §5.1.2). The Excel uses a single
//    lumped Type A = STDEV(f'c)/√n which collapses load+geometry variability.
// ===========================================================================
console.log('5. FC_CUBO — Resistencia a la compresión (cubo)');

const L_CUBO = 15.0;           // cm
const A_CUBO = L_CUBO ** 2;    // 225 cm²
const FC_MEAN = 250;           // kg/cm²
const CARGA_MEAN = FC_MEAN * A_CUBO; // 56 250 kg

const c_carga_cubo = sensitivityCoefficient('FC_CUBO', 'Carga', {
  carga_mean: CARGA_MEAN, L_mean: L_CUBO, area_mean: A_CUBO, fc_mean: FC_MEAN,
});
const c_L_cubo = sensitivityCoefficient('FC_CUBO', 'L1', {
  carga_mean: CARGA_MEAN, L_mean: L_CUBO, area_mean: A_CUBO, fc_mean: FC_MEAN,
});
const c_capping = sensitivityCoefficient('FC_CUBO', 'capping', {
  carga_mean: CARGA_MEAN, L_mean: L_CUBO, area_mean: A_CUBO, fc_mean: FC_MEAN,
});

// c_Carga = 1/A = 1/225
assert.ok(nearAbs(c_carga_cubo, 1 / A_CUBO, 1e-9),
  `FC_CUBO: c_Carga = 1/225 = ${(1/A_CUBO).toExponential(4)}, got ${c_carga_cubo.toExponential(4)}`);

// c_L = -2·f'c/L = -2×250/15 ≈ -33.333
assert.ok(nearAbs(c_L_cubo, -2 * FC_MEAN / L_CUBO, 1e-6),
  `FC_CUBO: c_L = -2·f'c/L = ${(-2*FC_MEAN/L_CUBO).toFixed(3)}, got ${c_L_cubo.toFixed(3)}`);

// c_L2 symmetric to c_L1
const c_L2_cubo = sensitivityCoefficient('FC_CUBO', 'L2', {
  carga_mean: CARGA_MEAN, L_mean: L_CUBO, area_mean: A_CUBO, fc_mean: FC_MEAN,
});
assert.ok(nearAbs(c_L_cubo, c_L2_cubo, 1e-9), 'FC_CUBO: c_L1 = c_L2 (symmetric)');

// c_capping = 1
assert.ok(nearAbs(c_capping, 1, 1e-9), 'FC_CUBO: c_capping = 1');

const fcCuboBudget = buildBudget({
  measurandCode: 'FC_CUBO',
  measurandName: "Resistencia a la compresión f'c (cubo)",
  unit: 'kg/cm²',
  replicaValues: [248, 252, 250, 249, 251, 250, 253, 248, 251, 252],
  typeBInputs: [
    // Resolución prensa: div.mín = 1 kg; ci = 1/A
    {
      fuente: 'Resolución de la prensa hidráulica',
      magnitud_xi: 'Carga',
      unidad: 'kg',
      valor_xi: CARGA_MEAN,
      kind: 'resolution',
      divMin: 1,
      ci_override: 1 / A_CUBO,
      categoria: 'resolution',
    },
    // Calibración prensa: U_cert = 250 kg, k = 2; ci = 1/A
    {
      fuente: 'Calibración de la prensa hidráulica',
      magnitud_xi: 'Carga',
      unidad: 'kg',
      valor_xi: CARGA_MEAN,
      kind: 'calibration',
      U_cert: 250,
      k_cert: 2,
      ci_override: 1 / A_CUBO,
      categoria: 'calibration',
    },
    // capping — systematic: no planitud del refrentado (halfWidth = 2 kg/cm²)
    {
      fuente: 'No planitud (capping)',
      magnitud_xi: 'capping',
      unidad: 'kg/cm²',
      valor_xi: 2.0,
      kind: 'rectangular',
      halfWidth: 2.0,
      ci_override: 1,
      norma_ref_override: 'ASTM C617',
      categoria: 'systematic',
    },
    // L_meas_err — systematic: propagated from flexómetro Uim
    // Test value: U = 0.07mm = 0.007cm, k = 2 → u = 0.0035 cm; ci = |c_L| = 33.333
    {
      fuente: 'Error sist. medición lado',
      magnitud_xi: 'L_meas_err',
      unidad: 'cm',
      valor_xi: 0.0035,
      kind: 'custom',
      u_custom: 0.0035,
      divisor_custom: 1,
      distribucion_custom: 'normal',
      ci_override: Math.abs(c_L_cubo),
      norma_ref_override: 'NMX-CH-002',
      categoria: 'systematic',
    },
  ],
  sensitivityContext: { carga_mean: CARGA_MEAN, L_mean: L_CUBO, area_mean: A_CUBO, fc_mean: FC_MEAN },
});

assert.ok(fcCuboBudget.components.length === 5, `FC_CUBO: 5 components, got ${fcCuboBudget.components.length}`);
assert.ok(near(fcCuboBudget.U, fcCuboBudget.k * fcCuboBudget.u_c), 'FC_CUBO: U = k·u_c');

// capping: u = 2/√3 ≈ 1.155 kg/cm², ci = 1
const cappingComp = fcCuboBudget.components.find((c) => c.magnitud_xi === 'capping')!;
assert.ok(nearAbs(cappingComp.u_xi, 2 / Math.sqrt(3), 1e-4), 'FC_CUBO: u(capping) = 2/√3');
assert.ok(nearAbs(cappingComp.ci, 1, 1e-9), 'FC_CUBO: ci(capping) = 1');
assert.ok(cappingComp.categoria === 'systematic', 'FC_CUBO: capping → systematic');

// L_meas_err: ci = |2·f'c/L| propagated from instrument cert
const lComp = fcCuboBudget.components.find((c) => c.magnitud_xi === 'L_meas_err')!;
assert.ok(nearAbs(lComp.ci, Math.abs(c_L_cubo), 1e-4),
  `FC_CUBO: ci(L_meas) = |2·f'c/L| = ${Math.abs(c_L_cubo).toFixed(3)}`);
assert.ok(lComp.categoria === 'systematic', 'FC_CUBO: L_meas_err → systematic');

// ui_y(L_meas) = |ci| × u = 33.333 × 0.0035 ≈ 0.1167 kg/cm²
const expectedUiL = Math.abs(c_L_cubo) * 0.0035;
assert.ok(nearAbs(lComp.ui_y, expectedUiL, 1e-4),
  `FC_CUBO: ui_y(L_meas) = ${expectedUiL.toExponential(4)}, got ${lComp.ui_y.toExponential(4)}`);

console.log(`  u_c=${fcCuboBudget.u_c.toExponential(4)} kg/cm²  U=${fcCuboBudget.U.toExponential(4)} kg/cm²  k=${fcCuboBudget.k.toFixed(3)}`);
console.log('  ✓ FC_CUBO');

// ===========================================================================
// 6. Monotonic increase: adding contributors grows u_c
// ===========================================================================
console.log('6. Monotonic u_c growth with contributors');

const revBase = buildBudget({
  measurandCode: 'REV', measurandName: 'REV', unit: 'cm',
  replicaValues: revReplicas, typeBInputs: [],
});
const revWithRes = buildBudget({
  measurandCode: 'REV', measurandName: 'REV', unit: 'cm',
  replicaValues: revReplicas,
  typeBInputs: [
    { fuente: 'Res', magnitud_xi: 'R', unidad: 'cm', valor_xi: 18, kind: 'resolution', divMin: 0.1 },
  ],
});
// revBudget (from above) has 4 Type B

assert.ok(revWithRes.u_c >= revBase.u_c, 'Adding resolution increases u_c');
assert.ok(revBudget.u_c >= revWithRes.u_c, 'Adding env contributors further increases u_c');
console.log(`  0B=${revBase.u_c.toFixed(4)} ≤ 1B=${revWithRes.u_c.toFixed(4)} ≤ 4B=${revBudget.u_c.toFixed(4)}`);
console.log('  ✓ Monotonic increase');

// ===========================================================================
// 7. FC_CUBO sensitivity: c_L = c_L2 ≠ 1 (non-trivial propagation)
// ===========================================================================
console.log('7. FC_CUBO non-unit sensitivity cross-check');

// At different f'c values, verify proportionality
const c_L_200 = sensitivityCoefficient('FC_CUBO', 'L1', {
  carga_mean: 200 * 225, L_mean: 15, area_mean: 225, fc_mean: 200,
});
const c_L_300 = sensitivityCoefficient('FC_CUBO', 'L1', {
  carga_mean: 300 * 225, L_mean: 15, area_mean: 225, fc_mean: 300,
});
// c_L ∝ f'c: doubling f'c doubles |c_L|
assert.ok(nearAbs(c_L_300 / c_L_200, 1.5, 1e-3),
  `FC_CUBO: c_L scales with f'c: c_L(300)/c_L(200) ≈ 1.5, got ${(c_L_300/c_L_200).toFixed(3)}`);

console.log('  ✓ FC_CUBO sensitivity proportionality');

// ===========================================================================
// 8. VIGAS — Módulo de rotura (flexión, carga en tercios)
//    Reference: NMX-C-191-ONNCCE-2017 / ASTM C78
//    MR = P·L / (b·d²)
//    Sensitivities: c_P = MR/P; c_L = MR/L; c_b = -MR/b; c_d = -2·MR/d (dominant)
// ===========================================================================
console.log('8. VIGAS — Módulo de rotura (flexión)');

// Hand computation for a typical 15×15×50 beam, span 45 cm, P_max ≈ 2960 kgf:
//   MR = 2960 · 45 / (15 · 15²) = 133200 / 3375 = 39.47 kg/cm²
// Replicas with small spread (Type A small); plus Type B from calibration of prensa.
const vigasReplicas = [39.5, 39.4, 39.6, 39.3, 39.5];  // kg/cm²
const vigasMean = mean(vigasReplicas);
assert.ok(nearAbs(vigasMean, 39.46, 0.05), `VIGAS mean ≈ 39.46 kg/cm², got ${vigasMean.toFixed(2)}`);

// Sensitivity coefficient sanity: c_d should dominate (factor 2 vs c_b, much larger
// than c_P since P_mean ≫ MR_mean).
const ctx = { P_mean: 2960, L_mean: 45, b_mean: 15, d_mean: 15, MR_mean: 39.47 };
const c_P = sensitivityCoefficient('VIGAS', 'P', ctx);
const c_L = sensitivityCoefficient('VIGAS', 'L', ctx);
const c_b = sensitivityCoefficient('VIGAS', 'b', ctx);
const c_d = sensitivityCoefficient('VIGAS', 'd', ctx);
assert.ok(nearAbs(c_P, 39.47 / 2960, 1e-6), `c_P = MR/P; got ${c_P}`);
assert.ok(nearAbs(c_L, 39.47 / 45, 1e-6),   `c_L = MR/L; got ${c_L}`);
assert.ok(nearAbs(c_b, -39.47 / 15, 1e-6),  `c_b = -MR/b; got ${c_b}`);
assert.ok(nearAbs(c_d, -2 * 39.47 / 15, 1e-6), `c_d = -2·MR/d; got ${c_d}`);
assert.ok(Math.abs(c_d) > Math.abs(c_b),    'c_d dominates c_b (factor of 2)');
console.log(`  c_P=${c_P.toExponential(2)}  c_L=${c_L.toExponential(2)}  c_b=${c_b.toExponential(2)}  c_d=${c_d.toExponential(2)}`);

// Full budget smoke: Type A repetibilidad + 1 Type B (calibration of the prensa)
const vigasBudget = buildBudget({
  measurandCode: 'VIGAS',
  measurandName: 'Módulo de rotura',
  unit: 'kg/cm²',
  replicaValues: vigasReplicas,
  typeBInputs: [
    {
      fuente: 'Calibración de la prensa',
      magnitud_xi: 'P',                  // U is in kgf; sensitivity converts to kg/cm²
      unidad: 'kgf',
      valor_xi: 0,
      kind: 'calibration',
      U_cert: 30,                         // ±30 kgf @ k=2 (typical prensa cert)
      k_cert: 2,
      categoria: 'calibration',
    },
  ],
  sensitivityContext: ctx,
});
assert.ok(vigasBudget.u_c > 0,                          'VIGAS u_c > 0');
assert.ok(vigasBudget.U > 2 * vigasBudget.u_c * 0.9,    'VIGAS U ≈ k·u_c, k near 2');
assert.equal(vigasBudget.components.length, 2,          'VIGAS budget should have exactly 2 components (1 Type A + 1 Type B)');
console.log(`  u_c=${vigasBudget.u_c.toExponential(4)} kg/cm²  U=${vigasBudget.U.toExponential(4)} kg/cm²  k=${vigasBudget.k.toFixed(3)}`);
console.log('  ✓ VIGAS');

console.log('\n✅ All Excel-alignment parity tests passed.');
