import { createClient } from '@supabase/supabase-js';
import {
  PriceHistoryFilters,
  ClientPriceHistory,
  RecipePriceHistory,
  PriceHistoryEntry,
  Recipe,
  Client,
  Quote
} from '../types/priceHistory';
import { Database } from '../types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PriceHistoryResponse = {
  id: string;
  code: string;
  description: string;
  fc_mr_value: number;
  type: 'STANDARD' | 'SPECIAL' | 'QUOTED';
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  base_price: number;
  is_active: boolean;
  effective_date: string;
  quote_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  approval_date: string | null;
  recipe_id: string | null;
  client_id: string;
  construction_site: string | null;
  recipes: Pick<Recipe, 'id' | 'recipe_code' | 'strength_fc' | 'age_days' | 'placement_type' | 'max_aggregate_size' | 'slump'> | null;
  clients: Pick<Client, 'id' | 'business_name' | 'client_code'> | null;
  quotes: Quote | null;
};

export const fetchPriceHistoryByClient = async (
  filters: PriceHistoryFilters
): Promise<ClientPriceHistory[]> => {
  const query = supabase
    .from('product_prices')
    .select(`
      id,
      code,
      description,
      fc_mr_value,
      type,
      age_days,
      placement_type,
      max_aggregate_size,
      slump,
      base_price,
      is_active,
      effective_date,
      quote_id,
      created_at,
      updated_at,
      approval_date,
      recipe_id,
      client_id,
      construction_site,
      recipes!recipe_id (
        id,
        recipe_code,
        strength_fc,
        age_days,
        placement_type,
        max_aggregate_size,
        slump
      ),
      clients!client_id (
        id,
        business_name,
        client_code
      ),
      quotes!quote_id (*)
    `)
    .order('effective_date', { ascending: false });

  if (filters.clientId) {
    query.eq('client_id', filters.clientId);
  }
  if (filters.startDate) {
    query.gte('effective_date', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query.lte('effective_date', filters.endDate.toISOString());
  }

  const { data: priceRecords, error } = await query;

  if (error) {
    console.error('Error fetching price history:', error);
    throw error;
  }
  
  if (!priceRecords || priceRecords.length === 0) {
    console.log('No price records found');
    return [];
  }

  console.log('Raw price records:', priceRecords);

  const clientPriceHistories = new Map<string, ClientPriceHistory>();

  ((priceRecords as unknown) as PriceHistoryResponse[]).forEach((record) => {
    const clientId = record.clients?.id;
    const businessName = record.clients?.business_name;
    const recipeId = record.recipes?.id;
    const recipeCode = record.recipes?.recipe_code;

    if (!clientId || !businessName || !recipeId || !recipeCode) {
      console.log('Skipping record due to missing data:', {
        clientId,
        businessName,
        recipeId,
        recipeCode,
        record
      });
      return;
    }

    if (!clientPriceHistories.has(clientId)) {
      const newClientHistory: ClientPriceHistory = {
        clientId,
        businessName,
        recipes: []
      };
      clientPriceHistories.set(clientId, newClientHistory);
      console.log('Created new client history:', newClientHistory);
    }

    const clientHistory = clientPriceHistories.get(clientId)!;
    let recipeHistory = clientHistory.recipes.find(r => r.recipeId === recipeId);

    if (!recipeHistory) {
      recipeHistory = {
        recipeId,
        recipeCode,
        currentPrice: 0,
        priceHistory: [],
        priceChange: { amount: 0, percentage: 0 }
      };
      clientHistory.recipes.push(recipeHistory);
      console.log('Added new recipe history:', recipeHistory);
    }

    const priceEntry: PriceHistoryEntry = {
      id: record.id,
      code: record.code,
      description: record.description,
      fc_mr_value: record.fc_mr_value,
      type: record.type,
      age_days: record.age_days,
      placement_type: record.placement_type,
      max_aggregate_size: record.max_aggregate_size,
      slump: record.slump,
      base_price: record.base_price,
      isActive: record.is_active,
      effectiveDate: new Date(record.effective_date),
      quoteId: record.quote_id || undefined,
      quote: record.quotes || undefined,
      createdAt: record.created_at ? new Date(record.created_at) : undefined,
      updatedAt: record.updated_at ? new Date(record.updated_at) : undefined,
      approvalDate: record.approval_date ? new Date(record.approval_date) : undefined,
      construction_site: record.construction_site || undefined
    };

    recipeHistory.priceHistory.push(priceEntry);
    console.log('Added price entry to recipe history:', {
      clientId,
      recipeId,
      priceEntry
    });

    if (record.is_active) {
      recipeHistory.currentPrice = record.base_price;
    }
  });

  // Calculate price changes
  clientPriceHistories.forEach(client => {
    client.recipes.forEach(recipe => {
      const sortedHistory = recipe.priceHistory.sort(
        (a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime()
      );

      if (sortedHistory.length >= 2) {
        const currentPrice = sortedHistory[0].base_price;
        const previousPrice = sortedHistory[1].base_price;
        recipe.priceChange = {
          amount: currentPrice - previousPrice,
          percentage: ((currentPrice - previousPrice) / previousPrice) * 100
        };
      }
    });
  });

  const result = Array.from(clientPriceHistories.values());
  console.log('Final client price histories:', result);
  return result;
};

export const fetchPriceHistoryByRecipe = async (
  filters: PriceHistoryFilters
): Promise<RecipePriceHistory[]> => {
  const query = supabase
    .from('product_prices')
    .select(`
      id,
      code,
      description,
      fc_mr_value,
      type,
      age_days,
      placement_type,
      max_aggregate_size,
      slump,
      base_price,
      is_active,
      effective_date,
      quote_id,
      created_at,
      updated_at,
      approval_date,
      recipe_id,
      client_id,
      construction_site,
      recipes!recipe_id (
        id,
        recipe_code,
        strength_fc,
        age_days,
        placement_type,
        max_aggregate_size,
        slump
      ),
      clients!client_id (
        id,
        business_name,
        client_code
      ),
      quotes!quote_id (*)
    `)
    .order('effective_date', { ascending: false });

  if (filters.recipeId) {
    query.eq('recipe_id', filters.recipeId);
  }
  if (filters.startDate) {
    query.gte('effective_date', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query.lte('effective_date', filters.endDate.toISOString());
  }

  const { data: priceRecords, error } = await query;

  if (error) {
    console.error('Error fetching price history:', error);
    throw error;
  }
  
  if (!priceRecords || priceRecords.length === 0) {
    console.log('No price records found');
    return [];
  }

  console.log('Raw price records:', priceRecords);

  const recipePriceHistories = new Map<string, RecipePriceHistory>();

  ((priceRecords as unknown) as PriceHistoryResponse[]).forEach((record) => {
    const recipeId = record.recipes?.id;
    const recipeData = record.recipes;
    const clientId = record.clients?.id;
    const businessName = record.clients?.business_name;

    if (!recipeId || !recipeData || !clientId || !businessName) {
      console.log('Skipping record due to missing data:', {
        recipeId,
        recipeData,
        clientId,
        businessName,
        record
      });
      return;
    }

    if (!recipePriceHistories.has(recipeId)) {
      const newRecipeHistory: RecipePriceHistory = {
        recipeId,
        recipeCode: recipeData.recipe_code,
        strengthFc: recipeData.strength_fc,
        ageDays: recipeData.age_days,
        placementType: recipeData.placement_type,
        clients: []
      };
      recipePriceHistories.set(recipeId, newRecipeHistory);
      console.log('Created new recipe history:', newRecipeHistory);
    }

    const recipeHistory = recipePriceHistories.get(recipeId)!;
    let clientHistory = recipeHistory.clients.find(c => c.clientId === clientId);

    if (!clientHistory) {
      clientHistory = {
        clientId,
        businessName,
        currentPrice: 0,
        priceHistory: [],
        priceChange: { amount: 0, percentage: 0 }
      };
      recipeHistory.clients.push(clientHistory);
      console.log('Added new client history:', clientHistory);
    }

    const priceEntry: PriceHistoryEntry = {
      id: record.id,
      code: record.code,
      description: record.description,
      fc_mr_value: record.fc_mr_value,
      type: record.type,
      age_days: record.age_days,
      placement_type: record.placement_type,
      max_aggregate_size: record.max_aggregate_size,
      slump: record.slump,
      base_price: record.base_price,
      isActive: record.is_active,
      effectiveDate: new Date(record.effective_date),
      quoteId: record.quote_id || undefined,
      quote: record.quotes || undefined,
      createdAt: record.created_at ? new Date(record.created_at) : undefined,
      updatedAt: record.updated_at ? new Date(record.updated_at) : undefined,
      approvalDate: record.approval_date ? new Date(record.approval_date) : undefined,
      construction_site: record.construction_site || undefined
    };

    clientHistory.priceHistory.push(priceEntry);
    console.log('Added price entry to client history:', {
      clientId,
      recipeId,
      priceEntry
    });

    if (record.is_active) {
      clientHistory.currentPrice = record.base_price;
    }
  });

  // Calculate price changes
  recipePriceHistories.forEach(recipe => {
    recipe.clients.forEach(client => {
      const sortedHistory = client.priceHistory.sort(
        (a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime()
      );

      if (sortedHistory.length >= 2) {
        const currentPrice = sortedHistory[0].base_price;
        const previousPrice = sortedHistory[1].base_price;
        client.priceChange = {
          amount: currentPrice - previousPrice,
          percentage: ((currentPrice - previousPrice) / previousPrice) * 100
        };
      }
    });
  });

  const result = Array.from(recipePriceHistories.values());
  console.log('Final recipe price histories:', result);
  return result;
}; 