import { Database } from './supabase';

export type PriceHistoryFilters = {
  clientId?: string;
  recipeId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
};

export type PriceChange = {
  amount: number;
  percentage: number;
};

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
  fc_mr_value: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: string;
  slump: string;
  quote_number?: string;
  quote_status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  created_at: Date;
}

export interface RecipeInHistory {
  recipeId: string;
  recipeCode: string;
  prices: PriceEntry[];
}

export interface ClientInHistory {
  clientId: string;
  businessName: string;
  prices: PriceEntry[];
}

export interface ClientPriceData {
  clientId: string;
  businessName: string;
  recipes: RecipeInHistory[];
}

export interface RecipePriceData {
  recipeId: string;
  recipeCode: string;
  clients: ClientInHistory[];
}

export type { ClientPriceData as ClientPriceHistory };
export type { RecipePriceData as RecipePriceHistory };

export type ViewMode = 'table' | 'chart';

export type PriceRecord = Database['public']['Tables']['product_prices']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Recipe = Database['public']['Tables']['recipes']['Row'];
export type Quote = Database['public']['Tables']['quotes']['Row'];

export type GroupBy = 'client' | 'recipe'; 