export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'void'
export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'void'
export type InvoiceSource = 'system' | 'historical' | 'mixed'
export type InvoiceCostCategory = 'material' | 'fleet'
export type InvoiceLineSource = 'entry' | 'manual'
export type InvoiceManualReason =
  | 'period_gap'
  | 'orphan_fleet'
  | 'provider_adjustment'
  | 'other'

export interface InvoiceRetentionInput {
  impuesto_sat: string
  label?: string | null
  base_amount?: number | null
  rate?: number | null
  amount: number
  sort_order?: number
}

export interface SupplierInvoiceRetention {
  id: string
  invoice_id: string
  impuesto_sat: string
  label: string | null
  base_amount: number | null
  rate: number | null
  amount: number
  sort_order: number
  created_at: string
}

export interface CfdiRetencion {
  impuesto_sat: string
  importe: number
  tasa_o_cuota?: number
}
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
  retentions?: SupplierInvoiceRetention[]
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
  pagos_doctos: CfdiPagoDocto[] | null
  estado_sat: CfdiEstadoSat
  estado_checked_at: string | null
  raw_xml_path: string | null
  imported_by: string | null
  imported_at: string
  source: 'manual_zip' | 'manual_xml' | 'pac'
}

export interface CfdiPagoDocto {
  uuid: string
  docto_relacionado_uuid: string
  imp_pagado: number
  num_parcialidad: number
  fecha_pago: string | null
  forma_pago_p: string | null
  moneda_p?: string | null
}

export type RepPaymentPreviewStatus =
  | 'ready'
  | 'already_applied'
  | 'invoice_not_found'
  | 'no_payable'
  | 'overpayment'
  | 'invoice_void'
  | 'invoice_paid'
  | 'skipped_not_p'

export interface RepPaymentPreviewRow {
  rep_uuid: string
  docto_uuid: string
  num_parcialidad: number
  status: RepPaymentPreviewStatus
  imp_pagado: number
  fecha_pago: string | null
  forma_pago_p: string | null
  emisor_rfc: string
  emisor_nombre: string | null
  rep_serie: string | null
  rep_folio: string | null
  supplier_invoice_id: string | null
  invoice_number: string | null
  balance: number | null
  proposed_payment_date: string | null
  proposed_amount: number | null
  proposed_method: string | null
  message?: string
}

export interface CfdiConcepto {
  clave_prod_serv: string | null
  clave_unidad: string | null
  unidad: string | null
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
  retenciones: CfdiRetencion[]
  metodo_pago: string | null
  forma_pago: string | null
  uso_cfdi: string | null
  moneda: string
  tipo_cambio: number
  cfdi_relacionados: Array<{ uuid: string; tipo_relacion: string }>
  pagos_doctos: CfdiPagoDocto[]
  conceptos: CfdiConcepto[]
}

export type PaymentSource = 'manual' | 'sat_rep'

export interface PaymentReconciliationReport {
  matched: Array<{
    rep_uuid: string
    docto_uuid: string
    num_parcialidad: number
    invoice_number: string | null
    sat_amount: number
    system_amount: number
    amount_match: boolean
  }>
  rep_not_applied: Array<{
    rep_uuid: string
    docto_uuid: string
    num_parcialidad: number
    imp_pagado: number
    emisor_rfc: string
    fecha_emision: string
  }>
  payment_without_rep: Array<{
    payment_id: string
    payment_date: string
    amount: number
    invoice_number: string | null
    method: string | null
  }>
  amount_mismatch: Array<{
    rep_uuid: string
    docto_uuid: string
    invoice_number: string | null
    sat_amount: number
    system_amount: number
    diff: number
  }>
  summary: {
    total_rep_doctos: number
    matched: number
    rep_not_applied: number
    payment_without_rep: number
    amount_mismatch: number
  }
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
  line_source: InvoiceLineSource
  manual_reason: InvoiceManualReason | null
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
  source?: PaymentSource;
  cfdi_rep_uuid?: string | null;
  cfdi_docto_uuid?: string | null;
  cfdi_num_parcialidad?: number | null;
  created_by?: string;
  created_at: string;
}


