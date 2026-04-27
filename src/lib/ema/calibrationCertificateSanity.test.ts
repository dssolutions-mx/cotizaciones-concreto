import assert from 'node:assert/strict';
import {
  tryParseLinearUmLawFromText,
  validateCalibrationCertificateSanity,
} from './calibrationCertificateSanity';

const formula =
  'INCERTIDUMBRE: ± [ 9,9 + ( 0,01 * L ) ] µm (L en mm)';

assert.deepEqual(tryParseLinearUmLawFromText(formula), { aUm: 9.9, bUmPerMm: 0.01 });
assert.deepEqual(
  tryParseLinearUmLawFromText('según cert: ± [ 9,9 + ( 0,01 × L ) ] µm'),
  { aUm: 9.9, bUmPerMm: 0.01 },
);

assert.equal(
  validateCalibrationCertificateSanity({
    incertidumbre_expandida: 0.0199,
    incertidumbre_unidad: 'mm',
    rango_medicion: '0 mm-600 mm',
    observaciones: formula,
    metodo_calibracion: null,
  }).ok,
  false,
);

assert.equal(
  validateCalibrationCertificateSanity({
    incertidumbre_expandida: 0.0159,
    incertidumbre_unidad: 'mm',
    rango_medicion: '0 mm-600 mm',
    observaciones: formula,
    metodo_calibracion: null,
  }).ok,
  true,
);

assert.equal(
  validateCalibrationCertificateSanity({
    incertidumbre_expandida: 0.005,
    incertidumbre_unidad: 'mm',
    rango_medicion: '0 mm-600 mm',
    observaciones: formula,
    metodo_calibracion: null,
  }).ok,
  false,
);

assert.equal(
  validateCalibrationCertificateSanity({
    incertidumbre_expandida: 0.02,
    incertidumbre_unidad: 'mm',
    rango_medicion: '0 mm-600 mm',
    observaciones: null,
    metodo_calibracion: null,
  }).ok,
  true,
);

console.log('calibrationCertificateSanity.test.ts OK');
