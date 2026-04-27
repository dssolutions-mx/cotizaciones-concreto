import assert from 'node:assert';
import {
  normalizeRepetitionConformityPolicy,
  suggestGlobalResultadoFromComputedRows,
} from './sectionRepetitionPolicy';

assert.strictEqual(normalizeRepetitionConformityPolicy(undefined), 'all_reps_must_pass');
assert.strictEqual(normalizeRepetitionConformityPolicy(null), 'all_reps_must_pass');
assert.strictEqual(normalizeRepetitionConformityPolicy('all_reps_must_pass'), 'all_reps_must_pass');
assert.strictEqual(normalizeRepetitionConformityPolicy('aggregate_then_evaluate'), 'aggregate_then_evaluate');
assert.strictEqual(normalizeRepetitionConformityPolicy('unknown'), 'all_reps_must_pass');

{
  const sections = [{ id: 's1', repetition_conformity_policy: 'all_reps_must_pass' as const }];
  assert.strictEqual(
    suggestGlobalResultadoFromComputedRows(sections, [
      { section_id: 's1', cumple: true },
      { section_id: 's1', cumple: null },
    ]),
    'conforme',
  );
  assert.strictEqual(
    suggestGlobalResultadoFromComputedRows(sections, [
      { section_id: 's1', cumple: true },
      { section_id: 's1', cumple: false },
    ]),
    'no_conforme',
  );
}

{
  const sections = [
    { id: 'a', repetition_conformity_policy: 'all_reps_must_pass' as const },
    { id: 'b', repetition_conformity_policy: 'all_reps_must_pass' as const },
  ];
  assert.strictEqual(
    suggestGlobalResultadoFromComputedRows(sections, [{ section_id: 'b', cumple: false }]),
    'no_conforme',
  );
}

console.log('sectionRepetitionPolicy.test.ts OK');
