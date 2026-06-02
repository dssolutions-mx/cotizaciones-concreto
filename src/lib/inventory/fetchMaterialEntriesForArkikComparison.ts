import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArkikDbEntry } from '@/lib/inventory/arkikEntriesComparator';

const PAGE_SIZE = 1000;

/**
 * Load material_entries for Arkik reconciliation (all pages in range).
 */
export async function fetchMaterialEntriesForArkikComparison(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string
): Promise<ArkikDbEntry[]> {
  const rows: ArkikDbEntry[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('material_entries')
      .select(
        'entry_number, entry_date, quantity_received, supplier_invoice, material:materials!material_id(material_code), supplier:suppliers!supplier_id(name)'
      )
      .eq('plant_id', plantId)
      .gte('entry_date', dateFrom)
      .lte('entry_date', dateTo)
      .order('entry_date', { ascending: true })
      .order('entry_number', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const r of batch) {
      const material = r.material as { material_code?: string } | null;
      const supplier = r.supplier as { name?: string } | null;
      rows.push({
        entry_number: String(r.entry_number ?? ''),
        material_code: String(material?.material_code ?? '').trim(),
        supplier_name: supplier?.name ?? '',
        supplier_invoice: r.supplier_invoice != null ? String(r.supplier_invoice) : null,
        entry_date: String(r.entry_date ?? ''),
        quantity_received: Number(r.quantity_received) || 0,
      });
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}
