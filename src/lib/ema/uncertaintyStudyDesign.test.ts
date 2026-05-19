import { describe, expect, it } from 'vitest';
import { assessAnovaReadiness, listUniqueOperatorIds } from './uncertaintyStudyDesign';
import type { UncertaintyStudyReplica } from '@/types/ema-uncertainty';

function replica(
  orden: number,
  operator_id: string | null,
  computed_value: number | null = 1,
): UncertaintyStudyReplica {
  return {
    id: String(orden),
    study_id: 's1',
    orden,
    operator_id,
    instrumento_id: null,
    raw_values_json: {},
    computed_value,
    created_at: '',
  };
}

describe('assessAnovaReadiness', () => {
  it('counts distinct operators, not row count', () => {
    const replicas = [
      replica(1, 'op-a'),
      replica(2, 'op-a'),
      replica(3, 'op-a'),
    ];
    expect(listUniqueOperatorIds(replicas)).toEqual(['op-a']);
    const r = assessAnovaReadiness(replicas);
    expect(r.distinctOperators).toBe(1);
    expect(r.needsMoreOperators).toBe(true);
  });

  it('detects ANOVA-ready design', () => {
    const replicas = [
      replica(1, 'op-a', 10),
      replica(2, 'op-a', 11),
      replica(3, 'op-b', 12),
      replica(4, 'op-b', 13),
    ];
    const r = assessAnovaReadiness(replicas);
    expect(r.canUseAnova).toBe(true);
    expect(r.operatorsEligibleForAnova).toBe(2);
  });
});
