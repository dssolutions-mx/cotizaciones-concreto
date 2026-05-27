/** Map PostgREST/Postgres errors to Spanish messages for supplier invoice creation. */
export function mapSupplierInvoiceDbError(
  message: string,
  code?: string | null,
): string {
  const msg = message.toLowerCase()
  const isDuplicate = code === '23505' || msg.includes('duplicate key')

  if (!isDuplicate) return message

  if (msg.includes('supplier_invoice_items') && msg.includes('entry_id')) {
    return 'Una o más recepciones ya están vinculadas a otra factura. Actualice la lista de entradas sin factura e intente de nuevo.'
  }
  if (msg.includes('payable_items')) {
    return 'La recepción ya tenía un registro en cuentas por pagar; use otra recepción o revise CXP existente.'
  }
  if (msg.includes('payables') && msg.includes('invoice_number')) {
    return 'Ya existe una cuenta por pagar con ese folio para este proveedor en esta planta.'
  }
  if (msg.includes('supplier_invoices') && msg.includes('cfdi_uuid')) {
    return 'Este CFDI ya fue registrado en otra factura.'
  }
  if (msg.includes('supplier_invoices') && msg.includes('invoice_number')) {
    return 'Ya existe una factura de proveedor con ese folio en esta planta.'
  }
  return 'Ya existe un registro con esos datos. Verifique el folio de factura o si la recepción ya fue facturada.'
}
