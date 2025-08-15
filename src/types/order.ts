// Definiciones de tipos para órdenes y productos relacionados

export interface OrderProduct {
  id: string;
  order_id: string;
  product_id?: string;
  name?: string;
  description?: string;
  product_type: string;
  quantity?: number;
  volume: number;
  unit_price: number;
  unit?: string;
  total_price: number;
  created_at: string;
  has_pump_service: boolean;
  pump_price?: number | null;
  pump_volume?: number | null;
  has_empty_truck_charge: boolean;
  empty_truck_volume?: number | null;
  empty_truck_price?: number | null;
  quote_detail_id?: string | null;
  recipe_id?: string | null;
}

export interface Order {
  id: string;
  quote_id: string;
  client_id: string;
  construction_site: string;
  construction_site_id?: string;
  order_number: string;
  delivery_date: string;
  delivery_time: string;
  requires_invoice: boolean;
  special_requirements?: string | null;
  total_amount: number;
  credit_status: CreditStatus;
  credit_validated_by?: string | null;
  credit_validation_date?: string | null;
  order_status: OrderStatus;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  rejection_reason?: string | null;
  plant_id?: string | null;
}

export interface OrderWithClient extends Order {
  client: {
    business_name: string;
    client_code: string;
  };
}

export interface OrderWithDetails extends Order {
  client: {
    business_name: string;
    client_code: string;
    email?: string | null;
    phone?: string | null;
  };
  products: OrderProduct[];
  plant?: {
    id: string;
    name: string;
    code: string;
    business_unit: {
      id: string;
      name: string;
      code: string;
      vat_rate: number;
    };
  };
}

export type OrderStatus = 'created' | 'validated' | 'scheduled' | 'completed' | 'cancelled';
export type CreditStatus = 'pending' | 'approved' | 'rejected' | 'rejected_by_validator'; 