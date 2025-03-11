import {
  ClientPriceHistory,
  RecipePriceHistory
} from '../types/priceHistory';
import { supabase } from '../lib/supabase/client';

export interface PriceHistoryFilters {
  clientId?: string;
  recipeId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

interface PriceHistoryRecord {
  id: string;
  code: string;
  description: string;
  base_price: number;
  is_active: boolean;
  effective_date: string;
  construction_site: string | null;
  type: 'STANDARD' | 'SPECIAL' | 'QUOTED';
  quote_id: string | null;
  fc_mr_value: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: string;
  slump: string;
  created_at: string;
  recipe: {
    id: string;
    recipe_code: string;
  } | null;
  client: {
    id: string;
    business_name: string;
  } | null;
  quotes: {
    id: string;
    quote_number: string;
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    client_id: string | null;
    construction_site: string;
    location: string;
    validity_date: string;
    created_at: string;
    updated_at: string;
    created_by: string;
    approved_by: string | null;
    approval_date: string | null;
    rejection_date: string | null;
    rejection_reason: string | null;
  } | null;
}

export interface PriceEntry {
  id: string;
  code: string;
  description: string;
  base_price: number;
  is_active: boolean;
  effective_date: Date;
  construction_site: string | null;
  type: 'STANDARD' | 'SPECIAL' | 'QUOTED';
  quote_id: string | null;
  quote_number?: string;
  quote_status?: string;
}

export interface ClientPriceData {
  clientId: string;
  businessName: string;
  recipes: {
    recipeId: string;
    recipeCode: string;
    prices: PriceEntry[];
  }[];
}

export interface RecipePriceData {
  recipeId: string;
  recipeCode: string;
  clients: {
    clientId: string;
    businessName: string;
    prices: PriceEntry[];
  }[];
}

export const fetchPriceHistory = async (
  groupBy: 'client' | 'recipe',
  filters: PriceHistoryFilters = {}
) => {
  try {
    console.log('Fetching price history with filters:', { groupBy, filters });

    const query = supabase
      .from('product_prices')
      .select(`
        *,
        recipes!recipe_id (
          id,
          recipe_code
        ),
        clients!client_id (
          id,
          business_name
        ),
        quotes!quote_id (
          id,
          quote_number,
          status
        )
      `)
      .order('effective_date', { ascending: false });

    // Apply filters
    if (filters.clientId) {
      query.eq('client_id', filters.clientId);
    }
    if (filters.recipeId) {
      query.eq('recipe_id', filters.recipeId);
    }
    if (filters.startDate) {
      query.gte('effective_date', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query.lte('effective_date', filters.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching price history:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No price records found');
      return groupBy === 'client' ? [] : [];
    }

    console.log('Raw data:', data);

    // Transform data based on grouping
    if (groupBy === 'client') {
      const clientMap = new Map<string, ClientPriceData>();

      (data as PriceHistoryRecord[]).forEach(record => {
        const clientId = record.client?.id;
        const businessName = record.client?.business_name;
        const recipeId = record.recipe?.id;
        const recipe = record.recipe;

        if (!clientId || !businessName || !recipeId || !recipe) return;

        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            clientId,
            businessName,
            recipes: []
          });
        }

        const clientData = clientMap.get(clientId)!;
        let recipeData = clientData.recipes.find(r => r.recipeId === recipeId);

        if (!recipeData) {
          recipeData = {
            recipeId,
            recipeCode: recipe.recipe_code,
            prices: []
          };
          clientData.recipes.push(recipeData);
        }

        recipeData.prices.push({
          id: record.id,
          code: record.code,
          description: record.description,
          base_price: record.base_price,
          is_active: record.is_active,
          effective_date: new Date(record.effective_date),
          construction_site: record.construction_site,
          type: record.type,
          quote_id: record.quote_id,
          quote_number: record.quotes?.quote_number,
          quote_status: record.quotes?.status
        });
      });

      return Array.from(clientMap.values());
    } else {
      const recipeMap = new Map<string, RecipePriceData>();

      (data as PriceHistoryRecord[]).forEach(record => {
        const recipeId = record.recipe?.id;
        const recipe = record.recipe;
        const clientId = record.client?.id;
        const businessName = record.client?.business_name;

        if (!recipeId || !recipe || !clientId || !businessName) return;

        if (!recipeMap.has(recipeId)) {
          recipeMap.set(recipeId, {
            recipeId,
            recipeCode: recipe.recipe_code,
            clients: []
          });
        }

        const recipeData = recipeMap.get(recipeId)!;
        let clientData = recipeData.clients.find(c => c.clientId === clientId);

        if (!clientData) {
          clientData = {
            clientId,
            businessName,
            prices: []
          };
          recipeData.clients.push(clientData);
        }

        clientData.prices.push({
          id: record.id,
          code: record.code,
          description: record.description,
          base_price: record.base_price,
          is_active: record.is_active,
          effective_date: new Date(record.effective_date),
          construction_site: record.construction_site,
          type: record.type,
          quote_id: record.quote_id,
          quote_number: record.quotes?.quote_number,
          quote_status: record.quotes?.status
        });
      });

      return Array.from(recipeMap.values());
    }
  } catch (error) {
    console.error('Error in fetchPriceHistory:', error);
    throw error;
  }
};

export const fetchPriceHistoryByClient = async (
  filters: PriceHistoryFilters
): Promise<ClientPriceHistory[]> => {
  try {
    console.log('Fetching price history by client with filters:', filters);

    let query = supabase
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
        recipes!recipe_id(id, recipe_code, strength_fc, age_days, placement_type, max_aggregate_size, slump),
        clients!client_id(id, business_name, client_code),
        quotes!quote_id(*)
      `)
      .order('effective_date', { ascending: false });

    // Apply filters
    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    if (filters.recipeId) {
      query = query.eq('recipe_id', filters.recipeId);
    }
    if (filters.startDate) {
      query = query.gte('effective_date', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('effective_date', filters.endDate.toISOString());
    }
    if (filters.searchTerm) {
      query = query.or(`
        clients.business_name.ilike.%${filters.searchTerm}%,
        recipes.recipe_code.ilike.%${filters.searchTerm}%,
        construction_site.ilike.%${filters.searchTerm}%
      `);
    }

    const { data: priceRecords, error } = await query;

    if (error) {
      console.error('Error fetching price history by client:', error);
      throw error;
    }

    console.log('Raw price records:', priceRecords);

    if (!priceRecords || priceRecords.length === 0) {
      return [];
    }

    // Group by client
    const clientMap = new Map<string, ClientPriceHistory>();

    priceRecords.forEach(record => {
      if (!record.clients || !record.recipes) {
        console.log('Record missing client or recipe data:', record);
        return;
      }

      const clientId = record.client_id;
      const recipeId = record.recipe_id;
      
      // Access the first element if clients/recipes are arrays
      const client = Array.isArray(record.clients) ? record.clients[0] : record.clients;
      const recipe = Array.isArray(record.recipes) ? record.recipes[0] : record.recipes;
      
      if (!client || !recipe) {
        console.log('Client or recipe data is null:', { client, recipe });
        return;
      }

      // Add client if not exists
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          clientId,
          businessName: client.business_name,
          recipes: []
        });
      }

      // Get client data
      const clientData = clientMap.get(clientId)!;

      // Find or create recipe
      let recipeData = clientData.recipes.find(r => r.recipeId === recipeId);
      if (!recipeData) {
        recipeData = {
          recipeId,
          recipeCode: recipe.recipe_code,
          prices: []
        };
        clientData.recipes.push(recipeData);
      }

      // Get quote data
      const quote = Array.isArray(record.quotes) ? record.quotes[0] : record.quotes;

      // Add price entry
      recipeData.prices.push({
        id: record.id,
        code: record.code,
        description: record.description,
        base_price: record.base_price,
        is_active: record.is_active,
        effective_date: new Date(record.effective_date),
        construction_site: record.construction_site,
        type: record.type,
        quote_id: record.quote_id,
        quote_number: quote?.quote_number,
        quote_status: quote?.status,
        fc_mr_value: record.fc_mr_value,
        age_days: record.age_days,
        placement_type: record.placement_type,
        max_aggregate_size: record.max_aggregate_size,
        slump: record.slump,
        created_at: new Date(record.created_at)
      });
    });

    const result = Array.from(clientMap.values());
    console.log('Transformed client price history data:', result);
    return result;
  } catch (error) {
    console.error('Error in fetchPriceHistoryByClient:', error);
    throw error;
  }
};

export const fetchPriceHistoryByRecipe = async (
  filters: PriceHistoryFilters
): Promise<RecipePriceHistory[]> => {
  try {
    console.log('Fetching price history by recipe with filters:', filters);

    let query = supabase
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
        recipes!recipe_id(id, recipe_code, strength_fc, age_days, placement_type, max_aggregate_size, slump),
        clients!client_id(id, business_name, client_code),
        quotes!quote_id(*)
      `)
      .order('effective_date', { ascending: false });

    // Apply filters
    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    if (filters.recipeId) {
      query = query.eq('recipe_id', filters.recipeId);
    }
    if (filters.startDate) {
      query = query.gte('effective_date', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('effective_date', filters.endDate.toISOString());
    }
    if (filters.searchTerm) {
      query = query.or(`
        clients.business_name.ilike.%${filters.searchTerm}%,
        recipes.recipe_code.ilike.%${filters.searchTerm}%,
        construction_site.ilike.%${filters.searchTerm}%
      `);
    }

    const { data: priceRecords, error } = await query;

    if (error) {
      console.error('Error fetching price history by recipe:', error);
      throw error;
    }

    console.log('Raw price records:', priceRecords);

    if (!priceRecords || priceRecords.length === 0) {
      return [];
    }

    // Group by recipe
    const recipeMap = new Map<string, RecipePriceHistory>();

    priceRecords.forEach(record => {
      if (!record.clients || !record.recipes) {
        console.log('Record missing client or recipe data:', record);
        return;
      }

      const clientId = record.client_id;
      const recipeId = record.recipe_id;
      
      // Access the first element if clients/recipes are arrays
      const client = Array.isArray(record.clients) ? record.clients[0] : record.clients;
      const recipe = Array.isArray(record.recipes) ? record.recipes[0] : record.recipes;
      
      if (!client || !recipe) {
        console.log('Client or recipe data is null:', { client, recipe });
        return;
      }

      // Add recipe if not exists
      if (!recipeMap.has(recipeId)) {
        recipeMap.set(recipeId, {
          recipeId,
          recipeCode: recipe.recipe_code,
          clients: []
        });
      }

      // Get recipe data
      const recipeData = recipeMap.get(recipeId)!;

      // Find or create client
      let clientData = recipeData.clients.find(c => c.clientId === clientId);
      if (!clientData) {
        clientData = {
          clientId,
          businessName: client.business_name,
          prices: []
        };
        recipeData.clients.push(clientData);
      }

      // Get quote data
      const quote = Array.isArray(record.quotes) ? record.quotes[0] : record.quotes;

      // Add price entry
      clientData.prices.push({
        id: record.id,
        code: record.code,
        description: record.description,
        base_price: record.base_price,
        is_active: record.is_active,
        effective_date: new Date(record.effective_date),
        construction_site: record.construction_site,
        type: record.type,
        quote_id: record.quote_id,
        quote_number: quote?.quote_number,
        quote_status: quote?.status,
        fc_mr_value: record.fc_mr_value,
        age_days: record.age_days,
        placement_type: record.placement_type,
        max_aggregate_size: record.max_aggregate_size,
        slump: record.slump,
        created_at: new Date(record.created_at)
      });
    });

    const result = Array.from(recipeMap.values());
    console.log('Transformed recipe price history data:', result);
    return result;
  } catch (error) {
    console.error('Error in fetchPriceHistoryByRecipe:', error);
    throw error;
  }
}; 