/**
 * Replica PUT payload sanitization.
 * Run: npx tsx src/lib/ema/uncertaintyReplicaPayload.test.ts
 */

import assert from 'node:assert/strict';
import { UpsertReplicasPayloadSchema } from './uncertaintyReplicaPayload';

const parsed = UpsertReplicasPayloadSchema.safeParse({
  replicas: [
    {
      orden: 1,
      operator_id: '',
      instrumento_id: null,
      raw_values_json: {
        P: 3375,
        b: 15,
        d: 15,
        L: 45,
        a: 15,
        _instr_seccion: '550e8400-e29b-41d4-a716-446655440000',
        _fracture_zone: 'tercio_medio',
        badNull: null,
        badNaN: NaN,
      },
      computed_value: null,
    },
  ],
});

assert.ok(parsed.success, `schema should accept sanitized VIGAS row: ${JSON.stringify(parsed.error?.flatten())}`);
assert.equal(parsed.data!.replicas[0].operator_id, null);
assert.equal(parsed.data!.replicas[0].raw_values_json.badNull, undefined);
assert.equal(parsed.data!.replicas[0].raw_values_json.badNaN, undefined);
assert.equal(parsed.data!.replicas[0].raw_values_json.P, 3375);
assert.equal(parsed.data!.replicas[0].raw_values_json._fracture_zone, 'tercio_medio');

// Reject NaN masquerading as fracture zone (legacy bug: Number("tercio_medio"))
const badFz = UpsertReplicasPayloadSchema.safeParse({
  replicas: [{ orden: 1, raw_values_json: { _fracture_zone: NaN as unknown as number } }],
});
assert.ok(badFz.success);
assert.equal(badFz.data!.replicas[0].raw_values_json._fracture_zone, undefined);

console.log('  ✓ uncertaintyReplicaPayload tests passed');
