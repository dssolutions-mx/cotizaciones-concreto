/**
 * Run: npx tsx src/lib/quality/informeMeasurands.uncertainty.test.ts
 */
import assert from 'node:assert/strict';
import {
  FIELD_UNCERTAINTY_MEASURANDS,
  requiredMeasurandsForInformeUncertainty,
  requiredMeasurandsForMuestreo,
} from './informeMeasurands';

const base = {
  revenimiento_sitio: 10,
  temperatura_concreto: 28,
  contenido_aire: 2,
  masa_unitaria: 2400,
  specimenTypes: ['CILINDRO'],
};

const all = requiredMeasurandsForMuestreo(base);
assert.ok(all.some((m) => m.codigo === 'REV'));
assert.ok(all.some((m) => m.codigo === 'FC'));

const withoutField = requiredMeasurandsForInformeUncertainty({
  ...base,
  declarar_incertidumbre_campo: false,
});
for (const codigo of FIELD_UNCERTAINTY_MEASURANDS) {
  assert.ok(!withoutField.some((m) => m.codigo === codigo), `expected no ${codigo}`);
}
assert.ok(withoutField.some((m) => m.codigo === 'FC'));

const withField = requiredMeasurandsForInformeUncertainty({
  ...base,
  declarar_incertidumbre_campo: true,
});
assert.equal(withField.length, all.length);

console.log('  ✓ informeMeasurands uncertainty toggle tests passed');
