export interface DistanceRangeConfig {
  id: string;
  plant_id: string;
  bloque_number: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  range_code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  range_name?: string;
  min_distance_km: number;
  max_distance_km: number;
  
  // Per Trip Costs
  diesel_per_trip: number;
  maintenance_per_trip: number;
  operator_bonus_per_trip: number;
  tires_per_trip: number;
  total_per_trip: number;
  
  // Per m³ Costs
  diesel_per_m3: number;
  maintenance_per_m3: number;
  bonus_per_m3: number;
  tires_per_m3: number;
  additive_te_per_m3: number | null;
  total_transport_per_m3: number;
  
  // Differential
  diferencial: number | null;
  
  is_active: boolean;
}

export interface DistanceCalculation {
  distance_km: number;
  bloque_number: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  range_code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  transport_cost_per_m3: number;
  total_per_trip: number;
  operator_bonus_per_trip: number;
  cost_breakdown: {
    diesel_per_m3: number;
    maintenance_per_m3: number;
    bonus_per_m3: number;
    tires_per_m3: number;
    additive_te_per_m3: number | null;
    diferencial: number | null;
  };
}

export interface QuotePricingBreakdown {
  // Distance information
  distance_km: number;
  bloque_number: number;
  range_code: string;
  
  // Transportation costs
  transport_cost_per_m3: number;
  total_per_trip: number;
  
  // Concrete products
  concrete_products: Array<{
    recipe_code: string;
    volume: number;
    base_cost_per_m3: number;
    transport_cost_per_m3: number;
    price_per_m3: number;
    subtotal: number;
  }>;
  concrete_subtotal: number;
  
  // Special products
  special_products: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    base_price: number;
    margin_percentage: number;
    unit_price: number;
    total: number;
  }>;
  special_products_subtotal: number;
  
  // Totals
  total_before_margin: number;
  margin_percentage: number;
  margin_amount: number;
  final_price: number;
}

