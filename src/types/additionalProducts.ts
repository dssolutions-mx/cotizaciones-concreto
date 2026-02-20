export type BillingType = 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT';

export interface AdditionalProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'SPECIAL_PRODUCT' | 'SERVICE' | 'MATERIAL' | 'EQUIPMENT' | 'OTHER';
  unit: string;
  base_price: number;
  billing_type?: BillingType;
  is_active: boolean;
  requires_distance_calculation: boolean;
  distance_rate_per_km?: number;
  plant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuoteAdditionalProduct {
  id: string;
  quote_id: string;
  additional_product_id: string;
  quantity: number;
  base_price: number;
  margin_percentage: number;
  unit_price: number;
  total_price: number;
  billing_type?: BillingType;
  notes?: string;
  product?: AdditionalProduct;
  created_at?: string;
}

export interface OrderAdditionalProduct {
  id: string;
  order_id: string;
  quote_additional_product_id: string;
  additional_product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  billing_type?: BillingType;
  notes?: string;
  product?: AdditionalProduct;
  quote_product?: QuoteAdditionalProduct;
  created_at?: string;
}

