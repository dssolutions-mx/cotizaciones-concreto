import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Approved-quote pump unit price for client + obra (mirrors ScheduleOrderForm pump pricing).
 * Priority: standalone pumping quote_details, then concrete lines with pump_service.
 */
export async function fetchApprovedPumpUnitPrice(
  supabase: SupabaseClient,
  clientId: string,
  constructionSiteName: string
): Promise<number> {
  if (!clientId || !constructionSiteName) return 0;

  let { data: standalonePumpData, error: standalonePumpError } = await supabase
    .from('quote_details')
    .select(`
      pump_price,
      pump_service,
      product_id,
      recipe_id,
      master_recipe_id,
      quotes!inner(
        id,
        client_id,
        construction_site,
        status,
        created_at
      )
    `)
    .eq('pump_service', true)
    .eq('quotes.client_id', clientId)
    .eq('quotes.construction_site', constructionSiteName)
    .eq('quotes.status', 'APPROVED')
    .not('product_id', 'is', null)
    .is('recipe_id', null)
    .is('master_recipe_id', null)
    .order('created_at', { ascending: false, foreignTable: 'quotes' });

  if (standalonePumpError) {
    console.error('fetchApprovedPumpUnitPrice: standalone pump error', standalonePumpError);
    return 0;
  }

  if (standalonePumpData && standalonePumpData.length > 0) {
    const sortedByDate = [...standalonePumpData].sort((a, b) => {
      const dateA = new Date((a as { quotes: { created_at: string } }).quotes.created_at).getTime();
      const dateB = new Date((b as { quotes: { created_at: string } }).quotes.created_at).getTime();
      return dateB - dateA;
    });
    standalonePumpData = [sortedByDate[0]];
  }

  let pumpServiceData = standalonePumpData;
  if ((!standalonePumpData || standalonePumpData.length === 0) && !standalonePumpError) {
    const { data: concretePumpData, error: concretePumpError } = await supabase
      .from('quote_details')
      .select(`
        pump_price,
        pump_service,
        quotes!inner(
          id,
          client_id,
          construction_site,
          status,
          created_at
        )
      `)
      .eq('pump_service', true)
      .eq('quotes.client_id', clientId)
      .eq('quotes.construction_site', constructionSiteName)
      .eq('quotes.status', 'APPROVED')
      .order('created_at', { ascending: false, foreignTable: 'quotes' });

    if (concretePumpError) {
      console.error('fetchApprovedPumpUnitPrice: concrete pump error', concretePumpError);
      return 0;
    }

    if (concretePumpData && concretePumpData.length > 0) {
      const sortedByDate = [...concretePumpData].sort((a, b) => {
        const dateA = new Date((a as { quotes: { created_at: string } }).quotes.created_at).getTime();
        const dateB = new Date((b as { quotes: { created_at: string } }).quotes.created_at).getTime();
        return dateB - dateA;
      });
      pumpServiceData = [sortedByDate[0]];
    }
  }

  if (pumpServiceData && pumpServiceData.length > 0) {
    const row = pumpServiceData.find((d) => d && d.pump_price !== null && d.pump_price !== undefined);
    if (row && row.pump_price !== null) {
      return Number(row.pump_price);
    }
  }

  return 0;
}
