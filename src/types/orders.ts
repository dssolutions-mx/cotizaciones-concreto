/**
 * Order status enumeration
 */
export enum OrderStatus {
  CREATED = 'created',
  VALIDATED = 'validated',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Credit status enumeration
 */
export enum CreditStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REJECTED_BY_VALIDATOR = 'rejected_by_validator'
}

/**
 * User profile with minimal information
 */
export interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Client information for orders
 */
export interface OrderClient {
  id: string;
  business_name: string;
  client_code?: string;
  rfc?: string;
  requires_invoice: boolean;
  address?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  credit_status?: string;
}

/**
 * Order item details
 */
export interface OrderItem {
  id: string;
  order_id: string;
  quote_detail_id?: string;
  product_type: string;
  volume: number;
  unit_price: number;
  total_price: number;
  has_pump_service: boolean;
  pump_price?: number;
  pump_volume?: number;
  has_empty_truck_charge: boolean;
  empty_truck_volume?: number;
  empty_truck_price?: number;
  created_at: string;
}

/**
 * Basic order information
 */
export interface Order {
  id: string;
  order_number: string;
  quote_id: string;
  client_id: string;
  construction_site: string;
  requires_invoice: boolean;
  delivery_date: string;
  delivery_time: string;
  special_requirements?: string;
  total_amount: number;
  credit_status: CreditStatus;
  credit_validated_by?: string;
  credit_validation_date?: string;
  order_status: OrderStatus;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Order with client information
 */
export interface OrderWithClient extends Omit<Order, 'created_by' | 'credit_validated_by'> {
  clients: OrderClient;
  created_by: UserProfile;
  credit_validated_by?: UserProfile;
}

/**
 * Complete order with all details
 */
export interface OrderWithDetails extends OrderWithClient {
  items: OrderItem[];
}

/**
 * Order notification information
 */
export interface OrderNotification {
  id: string;
  order_id: string;
  notification_type: string;
  recipient: string;
  sent_at: string;
  delivery_status?: string;
}

/**
 * Empty truck charge details
 */
export interface EmptyTruckDetails {
  hasEmptyTruckCharge: boolean;
  emptyTruckVolume: number;
  emptyTruckPrice: number;
}

/**
 * Order creation parameters
 */
export interface OrderCreationParams {
  quoteId: string;
  deliveryDate: string;
  deliveryTime: string;
  requiresInvoice: boolean;
  specialRequirements?: string;
  emptyTruckDetails?: EmptyTruckDetails;
} 