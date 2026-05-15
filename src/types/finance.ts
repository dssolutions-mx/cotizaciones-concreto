export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'void'
export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'void'
export type InvoiceSource = 'system' | 'historical'
export type InvoiceCostCategory = 'material' | 'fleet'
export type CreditNoteReason = 'price_adjustment' | 'return' | 'defect' | 'other'
export type CreditNoteStatus = 'open' | 'partially_applied' | 'fully_applied' | 'void'

export interface SupplierGroup {
  id: string
  name: string
  rfc: string | null
  is_active: boolean
  created_at: string
}

export interface SupplierInvoice {
  id: string
  supplier_group_id: string
  plant_id: string
  invoice_number: string
  is_internal: boolean
  invoice_date: string
  due_date: string
  currency: string
  vat_rate: number
  subtotal: number
  discount_amount: number
  tax: number
  total: number
  retention_isr_rate: number
  retention_isr_amount: number
  retention_iva_rate: number
  retention_iva_amount: number
  status: InvoiceStatus
  source: InvoiceSource
  document_url: string | null
  xml_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  // computed fields (API enrichment)
  taxable_base?: number
  supplier_group?: SupplierGroup | null
  items?: SupplierInvoiceItem[]
  paid_to_date?: number
  credit_applied_subtotal?: number
  credit_applied_total?: number
  balance?: number
}

export interface InvoiceCreditNote {
  id: string
  supplier_group_id: string
  plant_id: string
  credit_number: string | null
  credit_date: string
  reason: CreditNoteReason
  amount: number        // subtotal of the CN
  tax_amount: number    // IVA portion
  total: number         // amount + tax_amount
  vat_rate: number
  status: CreditNoteStatus
  document_url: string | null
  xml_url: string | null
  notes: string | null
  applied_by: string | null
  created_at: string | null
  // relations
  invoice_allocations?: CreditNoteInvoiceAllocation[]
}

export interface CreditNoteInvoiceAllocation {
  id: string
  credit_note_id: string
  invoice_id: string
  allocated_subtotal: number
  allocated_tax: number
  allocated_total: number | null
  created_at: string
  // relations
  item_allocations?: CreditNoteItemAllocation[]
  invoice?: Pick<SupplierInvoice, 'id' | 'invoice_number' | 'subtotal' | 'total' | 'status'> | null
}

export interface CreditNoteItemAllocation {
  id: string
  credit_note_id: string
  invoice_allocation_id: string | null
  invoice_item_id: string
  allocated_amount: number
}

export interface SupplierInvoiceItem {
  id: string
  invoice_id: string
  entry_id: string | null
  cost_category: InvoiceCostCategory | null
  description: string | null
  qty: number | null
  unit_price: number | null
  amount: number
  created_at: string
}

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
  entry_id: string | null; // material_entries.id; null = línea sin recepción vinculada
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


