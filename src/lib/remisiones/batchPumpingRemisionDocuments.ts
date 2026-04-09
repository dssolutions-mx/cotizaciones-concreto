import type { SupabaseClient } from '@supabase/supabase-js';

export type PumpingRemisionDocumentRow = {
  id: string;
  file_name: string | null;
  original_name: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  document_type: string | null;
  document_category: string | null;
  uploaded_by: string | null;
  created_at: string;
  remision_id: string;
};

const SELECT = `
  id,
  file_name,
  original_name,
  file_path,
  file_size,
  mime_type,
  document_type,
  document_category,
  uploaded_by,
  created_at,
  remision_id
`;

/** PostgREST / Cloudflare can 502 under many parallel small queries; batch instead. */
const REMISION_ID_CHUNK = 120;

/**
 * Loads pumping-remisión evidence for many remisiones in a few round-trips (chunked `.in()`),
 * grouped by `remision_id`, newest document first per remisión.
 */
export async function batchFetchPumpingRemisionDocuments(
  supabase: SupabaseClient,
  remisionIds: string[]
): Promise<Map<string, PumpingRemisionDocumentRow[]>> {
  const byRemision = new Map<string, PumpingRemisionDocumentRow[]>();
  if (remisionIds.length === 0) return byRemision;

  const unique = Array.from(new Set(remisionIds));

  for (let i = 0; i < unique.length; i += REMISION_ID_CHUNK) {
    const chunk = unique.slice(i, i + REMISION_ID_CHUNK);
    const { data, error } = await supabase
      .from('remision_documents')
      .select(SELECT)
      .in('remision_id', chunk)
      .eq('document_category', 'pumping_remision');

    if (error) {
      console.warn('batchFetchPumpingRemisionDocuments:', error.message ?? error);
      continue;
    }

    for (const row of (data || []) as PumpingRemisionDocumentRow[]) {
      const rid = row.remision_id;
      if (!byRemision.has(rid)) byRemision.set(rid, []);
      byRemision.get(rid)!.push(row);
    }
  }

  byRemision.forEach((arr) => {
    arr.sort(
      (a: PumpingRemisionDocumentRow, b: PumpingRemisionDocumentRow) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  return byRemision;
}
