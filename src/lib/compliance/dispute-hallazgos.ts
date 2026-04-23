/**
 * How many hallazgos a dispute row represents for UI / payroll context.
 * Legacy rows have `included_finding_keys` empty → treat as 1.
 */
export function hallazgosInDispute(includedFindingKeys: string[] | null | undefined): number {
  const n = includedFindingKeys?.length ?? 0;
  return n > 0 ? n : 1;
}
