import type { SupabaseClient } from '@supabase/supabase-js';

const CHUNK = 150;

/**
 * Maps each remisión number to human-readable Arkik reassignment lines (source/target + reason).
 * Same semantics as the former inline logic in `reportDataService` — kept in one place for HR APIs and finance reports.
 */
export async function fetchReassignmentNotesByRemisionNumbers(
  supabase: SupabaseClient,
  remisionNumbers: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(remisionNumbers.map(String).map((s) => s.trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  const byRowId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const [{ data: asSource }, { data: asTarget }] = await Promise.all([
      supabase.from('remision_reassignments').select('*').in('source_remision_number', chunk),
      supabase.from('remision_reassignments').select('*').in('target_remision_number', chunk),
    ]);
    for (const row of [...(asSource || []), ...(asTarget || [])]) {
      const r = row as { id: string };
      if (r.id) byRowId.set(r.id, row as Record<string, unknown>);
    }
  }

  const linesByRemision = new Map<string, Set<string>>();
  const addLine = (remNum: string, line: string) => {
    if (!linesByRemision.has(remNum)) linesByRemision.set(remNum, new Set());
    linesByRemision.get(remNum)!.add(line);
  };

  for (const row of byRowId.values()) {
    const src = String(row.source_remision_number ?? '');
    const tgt = String(row.target_remision_number ?? '');
    const reason = String(row.reason ?? '').trim() || '—';
    if (src) addLine(src, `→ ${tgt}: ${reason}`);
    if (tgt) addLine(tgt, `← ${src}: ${reason}`);
  }

  return new Map(
    [...linesByRemision.entries()].map(([k, set]) => [k, [...set].join(' | ')]),
  );
}
