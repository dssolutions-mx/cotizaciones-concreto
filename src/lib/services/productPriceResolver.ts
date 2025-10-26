import { supabase } from '@/lib/supabase';

export interface ResolveMasterPriceParams {
  clientId: string;
  constructionSite: string;
  plantId: string;
  createdAt: string;
  masterRecipeId: string;
}

export interface ResolvedPriceLinkage {
  quoteId: string;
  quoteDetailId: string;
  unitPrice: number;
  priceSource: 'as_of' | 'current';
}

/**
 * Resolve the quote detail linkage for a master recipe as of the order's created_at.
 * Falls back to currently active prices if none existed as-of created_at.
 */
export async function resolveMasterPriceForAsOf(params: ResolveMasterPriceParams): Promise<ResolvedPriceLinkage> {
  const { clientId, constructionSite, plantId, createdAt, masterRecipeId } = params;

  // 1) Try as-of created_at
  const { data: asOfPrices, error: asOfError } = await supabase
    .from('product_prices')
    .select('quote_id, id, is_active, updated_at, master_recipe_id')
    .eq('client_id', clientId)
    .eq('construction_site', constructionSite)
    .eq('is_active', true)
    .eq('master_recipe_id', masterRecipeId)
    .lte('updated_at', createdAt)
    .order('updated_at', { ascending: false });

  if (asOfError) throw asOfError;

  const attempt = async (rows: any[] | null | undefined, priceSource: 'as_of' | 'current') => {
    if (!rows || rows.length === 0) return null;
    const quoteIds = Array.from(new Set(rows.map(r => r.quote_id).filter(Boolean)));
    if (quoteIds.length === 0) return null;

    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        id,
        created_at,
        status,
        quote_details(
          id,
          final_price,
          master_recipe_id,
          master_recipes:master_recipe_id(
            id,
            plant_id,
            master_code
          )
        )
      `)
      .in('id', quoteIds)
      .eq('status', 'APPROVED');

    if (quotesError) throw quotesError;
    if (!quotes || quotes.length === 0) return null;

    // Filter to matching master and plant
    const candidates: { quoteId: string; quoteDetailId: string; unitPrice: number; quoteCreatedAt: string }[] = [];
    for (const q of quotes as any[]) {
      const details = (q.quote_details || []) as any[];
      for (const d of details) {
        const mr = d.master_recipes;
        if (d.master_recipe_id === masterRecipeId && mr && mr.plant_id === plantId) {
          candidates.push({
            quoteId: q.id,
            quoteDetailId: d.id,
            unitPrice: d.final_price || 0,
            quoteCreatedAt: q.created_at,
          });
        }
      }
    }

    if (candidates.length === 0) return null;
    // Choose latest by quote.created_at as tiebreaker
    candidates.sort((a, b) => (a.quoteCreatedAt < b.quoteCreatedAt ? 1 : -1));
    const best = candidates[0];
    return { quoteId: best.quoteId, quoteDetailId: best.quoteDetailId, unitPrice: best.unitPrice, priceSource } as ResolvedPriceLinkage;
  };

  const asOfResolved = await attempt(asOfPrices, 'as_of');
  if (asOfResolved) return asOfResolved;

  // 2) Fallback to current active
  const { data: currentPrices, error: currentError } = await supabase
    .from('product_prices')
    .select('quote_id, id, is_active, updated_at, master_recipe_id')
    .eq('client_id', clientId)
    .eq('construction_site', constructionSite)
    .eq('is_active', true)
    .eq('master_recipe_id', masterRecipeId)
    .order('updated_at', { ascending: false });

  if (currentError) throw currentError;

  const currentResolved = await attempt(currentPrices, 'current');
  if (currentResolved) return currentResolved;

  throw new Error('No se encontró un precio activo para la receta maestra seleccionada.');
}


