import assert from 'node:assert/strict';
import { formatPatronPlantLabel, buildPatronInstrumentosSearchParams } from './patronScope';

assert.equal(formatPatronPlantLabel('Planta Norte', 'P2'), 'Planta Norte (P2)');
assert.equal(formatPatronPlantLabel('Planta Norte', null), 'Planta Norte');
assert.equal(formatPatronPlantLabel(null, null), null);

const qs = buildPatronInstrumentosSearchParams('00000000-0000-4000-8000-000000000001', {
  estado: 'vigente',
});
assert.equal(qs.get('tipo'), 'A');
assert.equal(qs.get('patron_for_plant_id'), '00000000-0000-4000-8000-000000000001');
assert.equal(qs.get('estado'), 'vigente');
