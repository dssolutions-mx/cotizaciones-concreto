import assert from 'node:assert/strict';
import { formatMoldeInstrumentoDisplay } from './moldeInstrumentoDisplay';

assert.equal(
  formatMoldeInstrumentoDisplay({ codigo: 'MOL-12', nombre: 'Cilindro 15×30' }),
  'MOL-12 · Cilindro 15×30',
);
assert.equal(formatMoldeInstrumentoDisplay({ codigo: 'MOL-12', nombre: null }), 'MOL-12');
assert.equal(formatMoldeInstrumentoDisplay(null, 'CIL-20260520-001'), 'CIL-20260520-001');
assert.equal(formatMoldeInstrumentoDisplay(null, ''), '—');

console.log('moldeInstrumentoDisplay.test.ts: ok');
