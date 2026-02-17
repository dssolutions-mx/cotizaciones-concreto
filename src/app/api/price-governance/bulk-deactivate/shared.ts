import { SupabaseClient } from '@supabase/supabase-js';

export type BulkDeactivateCandidate = {
  id: string;
  site_name: string;
  client_name: string;
  client_code: string | null;
  last_used: string | null;
};

export async function getBulkDeactivateCandidates(
  supabase: SupabaseClient,
  options: { olderThanDays?: number; clientId?: string; plantId?: string }
): Promise<BulkDeactivateCandidate[]> {
  const olderThanDays = options.olderThanDays ?? 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  let sitesQuery = supabase
    .from('construction_sites')
    .select(
      `
      id,
      name,
      client_id,
      is_active,
      clients!client_id(business_name, client_code)
    `
    )
    .eq('approval_status', 'APPROVED')
    .eq('is_active', true)
    .order('name');

  if (options.clientId) sitesQuery = sitesQuery.eq('client_id', options.clientId);
  if (options.plantId) sitesQuery = sitesQuery.eq('plant_id', options.plantId);

  const { data: sites, error: sitesError } = await sitesQuery;
  if (sitesError) throw sitesError;
  if (!sites || sites.length === 0) return [];

  const siteKeys = new Set(sites.map((s: any) => `${s.client_id}::${s.name}`));
  const clientIds = [...new Set(sites.map((s: any) => s.client_id))];
  const siteNames = [...new Set(sites.map((s: any) => s.name))];

  const [pricesRes, lastUsedRes] = await Promise.all([
    supabase
      .from('product_prices')
      .select('client_id, construction_site, master_recipe_id, recipe_id')
      .eq('is_active', true)
      .in('client_id', clientIds)
      .in('construction_site', siteNames),
    supabase.rpc('get_price_last_used', {
      p_client_ids: clientIds,
      p_site_names: siteNames,
    }),
  ]);

  if (pricesRes.error) throw pricesRes.error;
  if (lastUsedRes.error) throw lastUsedRes.error;

  const allPrices = pricesRes.data || [];
  const lastUsedRows = lastUsedRes.data || [];

  const lastUsedMap = new Map<string, string>();
  lastUsedRows.forEach(
    (row: {
      client_id: string;
      construction_site: string;
      master_recipe_id: string | null;
      recipe_id: string | null;
      last_used: string;
    }) => {
      if (!row?.client_id || !row?.construction_site || !row?.last_used) return;
      const base = `${row.client_id}::${row.construction_site}`;
      const keysToSet: string[] = [
        `${base}::${row.master_recipe_id || ''}::${row.recipe_id || ''}`,
        ...(row.master_recipe_id ? [`${base}::${row.master_recipe_id}::`] : []),
        ...(row.recipe_id ? [`${base}:: ::${row.recipe_id}`] : []),
      ];
      keysToSet.forEach((key) => {
        if (!lastUsedMap.has(key) || row.last_used > lastUsedMap.get(key)!)
          lastUsedMap.set(key, row.last_used);
      });
    }
  );

  const siteMaxLastUsed = new Map<string, string | null>();
  allPrices.forEach((p: any) => {
    const key = `${p.client_id}::${p.construction_site}`;
    if (!siteKeys.has(key)) return;

    const lastKey = `${p.client_id}::${p.construction_site}::${p.master_recipe_id || ''}::${p.recipe_id || ''}`;
    const masterKey = p.master_recipe_id
      ? `${p.client_id}::${p.construction_site}::${p.master_recipe_id}::`
      : null;
    const recipeKey = p.recipe_id
      ? `${p.client_id}::${p.construction_site}:: ::${p.recipe_id}`
      : null;
    const lastUsed =
      lastUsedMap.get(lastKey) ||
      (masterKey && lastUsedMap.get(masterKey)) ||
      (recipeKey && lastUsedMap.get(recipeKey)) ||
      null;

    const current = siteMaxLastUsed.get(key);
    if (!current) {
      siteMaxLastUsed.set(key, lastUsed);
    } else if (lastUsed && (!current || lastUsed > current)) {
      siteMaxLastUsed.set(key, lastUsed);
    }
  });

  const candidates: BulkDeactivateCandidate[] = [];
  for (const s of sites as any[]) {
    const key = `${s.client_id}::${s.name}`;
    const siteLastUsed = siteMaxLastUsed.get(key) ?? null;
    const hasPrices = siteMaxLastUsed.has(key);
    if (!hasPrices) continue;

    const isStale =
      siteLastUsed === null || new Date(siteLastUsed) < cutoffDate;
    if (!isStale) continue;

    candidates.push({
      id: s.id,
      site_name: s.name,
      client_name: s.clients?.business_name || '',
      client_code: s.clients?.client_code || null,
      last_used: siteLastUsed,
    });
  }

  return candidates;
}
