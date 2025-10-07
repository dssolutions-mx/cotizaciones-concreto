export interface Client {
  id: string;
  business_name: string;
  client_code: string;
  rfc: string;
  requires_invoice: boolean;
  address: string;
  contact_name: string;
  email: string;
  phone: string;
  credit_status: string;
  logo_path?: string | null;
}

export interface ConstructionSite {
  id: string;
  name: string;
  location: string;
  access_restrictions: string;
  special_conditions: string;
  client_id: string;
  created_at: string;
  is_active: boolean;
}

export interface ClientPayment {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
  construction_site: string | null; // Can be name or ID depending on usage, clarify if needed
  created_at: string;
}

export interface ClientBalance {
  client_id: string;
  construction_site: string | null; // Can be name or ID
  current_balance: number;
  last_updated: string;
} 