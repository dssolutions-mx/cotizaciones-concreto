export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'void'
export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'void'
export type InvoiceSource = 'system' | 'historical'
export type InvoiceCostCategory = 'material' | 'fleet'
export type CreditNoteReason = 'price_adjustment' | 'return' | 'defect' | 'other'
export type CreditNoteStatus = 'open' | 'partially_applied' | 'fully_applied' | 'void'
export type CfdiCaptureMode = 'manual' | 'cfdi'
export type CfdiTipoComprobante = 'I' | 'E' | 'P' | 'N' | 'T'
export type CfdiEstadoSat = 'vigente' | 'cancelado'

export interface CfdiFields {
  cfdi_uuid: string | null
  cfdi_serie: string | null
  cfdi_folio: string | null
  cfdi_forma_pago: string | null
  cfdi_metodo_pago: string | null
  cfdi_uso: string | null
  cfdi_tipo_comprobante: CfdiTipoComprobante | null
  cfdi_fecha_emision: string | null
  cfdi_fecha_timbrado: string | null
  cfdi_emisor_rfc: string | null
  cfdi_receptor_rfc: string | null
  cfdi_estado_sat: CfdiEstadoSat | null
  cfdi_estado_checked_at: string | null
  cfdi_capture_mode: CfdiCaptureMode
}

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
  // CFDI fiscal fields
  cfdi_uuid: string | null
  cfdi_serie: string | null
  cfdi_folio: string | null
  cfdi_forma_pago: string | null
  cfdi_metodo_pago: string | null
  cfdi_uso: string | null
  cfdi_tipo_comprobante: CfdiTipoComprobante | null
  cfdi_fecha_emision: string | null
  cfdi_fecha_timbrado: string | null
  cfdi_emisor_rfc: string | null
  cfdi_receptor_rfc: string | null
  cfdi_estado_sat: CfdiEstadoSat | null
  cfdi_estado_checked_at: string | null
  cfdi_capture_mode: CfdiCaptureMode
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
  // CFDI fiscal fields (NCs are CFDIs tipo='E')
  cfdi_uuid: string | null
  cfdi_serie: string | null
  cfdi_folio: string | null
  cfdi_forma_pago: string | null
  cfdi_metodo_pago: string | null
  cfdi_uso: string | null
  cfdi_tipo_comprobante: CfdiTipoComprobante | null
  cfdi_fecha_emision: string | null
  cfdi_fecha_timbrado: string | null
  cfdi_emisor_rfc: string | null
  cfdi_receptor_rfc: string | null
  cfdi_relacionado_uuid: string | null
  cfdi_estado_sat: CfdiEstadoSat | null
  cfdi_estado_checked_at: string | null
  cfdi_capture_mode: CfdiCaptureMode
  // relations
  invoice_allocations?: CreditNoteInvoiceAllocation[]
}

export interface SatCfdiRecibido {
  uuid: string
  receptor_rfc: string
  emisor_rfc: string
  emisor_nombre: string | null
  serie: string | null
  folio: string | null
  fecha_emision: string
  fecha_timbrado: string
  tipo_comprobante: CfdiTipoComprobante
  subtotal: number
  descuento: number
  total: number
  iva_trasladado: number
  isr_retenido: number
  iva_retenido: number
  metodo_pago: string | null
  forma_pago: string | null
  uso_cfdi: string | null
  moneda: string
  tipo_cambio: number | null
  cfdi_relacionados: Array<{ uuid: string; tipo_relacion: string }> | null
  pagos_doctos: Array<{
    uuid: string
    docto_relacionado_uuid: string
    imp_pagado: number
    num_parcialidad: number
  }> | null
  estado_sat: CfdiEstadoSat
  estado_checked_at: string | null
  raw_xml_path: string | null
  imported_by: string | null
  imported_at: string
  source: 'manual_zip' | 'manual_xml' | 'pac'
}

export interface CfdiConcepto {
  clave_prod_serv: string | null
  clave_unidad: string | null
  no_identificacion: string | null
  cantidad: number
  descripcion: string
  valor_unitario: number
  importe: number
  descuento: number
  objeto_imp: string | null
}

export interface ParsedCfdi {
  uuid: string
  serie: string | null
  folio: string | null
  tipo_comprobante: CfdiTipoComprobante
  fecha_emision: string
  fecha_timbrado: string
  emisor_rfc: string
  emisor_nombre: string | null
  receptor_rfc: string
  receptor_nombre: string | null
  subtotal: number
  descuento: number
  total: number
  iva_trasladado: number
  isr_retenido: number
  iva_retenido: number
  vat_rate: number
  retention_isr_rate: number
  retention_iva_rate: number
  metodo_pago: string | null
  forma_pago: string | null
  uso_cfdi: string | null
  moneda: string
  tipo_cambio: number
  cfdi_relacionados: Array<{ uuid: string; tipo_relacion: string }>
  pagos_doctos: Array<{
    uuid: string
    docto_relacionado_uuid: string
    imp_pagado: number
    num_parcialidad: number
  }>
  conceptos: CfdiConcepto[]
}

export interface ReconciliationReport {
  matched: Array<{
    uuid: string
    supplier_invoice_id: string
    invoice_number: string
    sat_total: number
    system_total: number
    total_match: boolean
  }>
  in_sat_not_in_system: SatCfdiRecibido[]
  in_system_not_in_sat: SupplierInvoice[]
  cancelled_in_sat_but_open: Array<SatCfdiRecibido & { supplier_invoice_id: string }>
  total_mismatch: Array<{
    uuid: string
    supplier_invoice_id: string
    sat_total: number
    system_total: number
  }>
  unapplied_credit_notes: SatCfdiRecibido[]
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


