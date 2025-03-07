import { Database } from './supabase';

type Tables = Database['public']['Tables'];
type QuoteRow = Tables['quotes']['Row'];

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

export type PriceHistoryEntry = {
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
  isActive: boolean;
  effectiveDate: Date;
  quoteId?: string;
  quote?: QuoteRow;
  createdAt?: Date;
  updatedAt?: Date;
  approvalDate?: Date;
  construction_site?: string;
};

export type RecipeInHistory = {
  recipeId: string;
  recipeCode: string;
  currentPrice: number;
  priceHistory: PriceHistoryEntry[];
  priceChange: PriceChange;
};

export type ClientInHistory = {
  clientId: string;
  businessName: string;
  currentPrice: number;
  priceHistory: PriceHistoryEntry[];
  priceChange: PriceChange;
};

export type ClientPriceHistory = {
  clientId: string;
  businessName: string;
  recipes: RecipeInHistory[];
};

export type RecipePriceHistory = {
  recipeId: string;
  recipeCode: string;
  strengthFc: number;
  ageDays: number;
  placementType: string;
  clients: ClientInHistory[];
};

export type ViewMode = 'table' | 'chart';

export type PriceRecord = Database['public']['Tables']['product_prices']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Recipe = Database['public']['Tables']['recipes']['Row'];
export type Quote = Database['public']['Tables']['quotes']['Row'];

export type GroupBy = 'client' | 'recipe'; 