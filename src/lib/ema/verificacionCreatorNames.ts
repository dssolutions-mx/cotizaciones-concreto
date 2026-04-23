import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/** `created_by` points at auth.users; join to user_profiles is a separate query (embed hint may not exist in DB). */
/** Accepts browser/server/service Supabase clients (schema generics differ across entrypoints). */
export async function mapCreatorNames(
  admin: SupabaseClient<Database, 'public', any>,
  rows: { created_by?: string | null }[],
): Promise<Record<string, string | null>> {
  const ids = Array.from(
    new Set(rows.map((r) => r.created_by).filter((x): x is string => typeof x === 'string' && x.length > 0)),
  );
  if (ids.length === 0) return {};
  const { data } = await admin.from('user_profiles').select('id, full_name').in('id', ids);
  const out: Record<string, string | null> = {};
  for (const p of data ?? []) {
    const row = p as { id: string; full_name: string | null };
    out[row.id] = row.full_name;
  }
  return out;
}
