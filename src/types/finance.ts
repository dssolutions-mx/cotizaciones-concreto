export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'void';

export interface Payable {
  id: string;
  supplier_id: string;
  plant_id: string;
  invoice_number: string;
  invoice_date?: string;
  due_date: string;
  vat_rate: number; // e.g., 0.08 or 0.16
  currency: 'MXN';
  subtotal: number;
  tax: number;
  total: number;
  status: PayableStatus;
  created_by?: string;
  created_at: string;
}

export type PayableItemCategory = 'material' | 'fleet';

export interface PayableItem {
  id: string;
  payable_id: string;
  entry_id: string; // material_entries.id
  amount: number; // net amount (sin IVA)
  cost_category: PayableItemCategory;
  created_at: string;
}

export interface Payment {
  id: string;
  payable_id: string;
  payment_date: string; // YYYY-MM-DD
  amount: number;
  method?: string;
  reference?: string;
  created_by?: string;
  created_at: string;
}


