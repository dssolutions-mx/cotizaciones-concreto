/**
 * Sales report plant scope: always a finite list intersected with ACL.
 * Callers resolve Supabase `getAccessiblePlantIds` first:
 * - `null` → global admin / unbounded ACL → use all plants shown in the picker (`pickerPlantIds`).
 * - `[]` → no access.
 * - non-empty array → that set is the ACL universe.
 */

export function normalizeBaseAccessiblePlantIds(
  rawAcl: string[] | null,
  pickerPlantIds: string[]
): string[] {
  if (rawAcl === null) {
    return [...pickerPlantIds];
  }
  return [...rawAcl];
}

/**
 * Empty `selectedPlantIds` means "all plants in base scope".
 * Non-empty means restrict to that subset (intersected with base).
 */
export function resolveEffectiveSalesPlantIds(
  selectedPlantIds: string[],
  baseAccessibleIds: string[]
): string[] {
  if (baseAccessibleIds.length === 0) {
    return [];
  }
  if (!selectedPlantIds.length) {
    return [...baseAccessibleIds];
  }
  const allowed = new Set(baseAccessibleIds);
  return selectedPlantIds.filter((id) => allowed.has(id));
}
