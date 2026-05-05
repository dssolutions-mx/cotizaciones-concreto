/**
 * Canonical key for matching remisión conductor / unidad filters across the stack
 * (HR weekly API, facet pickers). Unicode-normalized and diacritic-insensitive.
 */
export function normalizeRemisionFilterKey(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.replace(/\s+/g, ' ').toLowerCase();
}
