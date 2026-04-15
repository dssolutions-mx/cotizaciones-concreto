import { format, parseISO } from 'date-fns'
import type { MaterialEntry } from '@/types/inventory'
import { formatReceivedQuantity } from '@/lib/inventory/entryReceivedDisplay'

function reviewerLabel(e: MaterialEntry): string {
  const u = e.reviewed_by_user
  if (!u) return ''
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return name || u.email || ''
}

/** Flat rows for ERP / Excel (numeric fields as numbers where possible). */
export function reviewedEntriesToExcelRows(entries: MaterialEntry[]) {
  return entries.map((e) => {
    const poRef = e.po || e.fleet_po
    return {
      entry_id: e.id,
      entrada: e.entry_number || '',
      revisado_el: e.reviewed_at
        ? format(parseISO(e.reviewed_at), 'yyyy-MM-dd HH:mm:ss')
        : '',
      recepcion_fecha: e.entry_date || '',
      recepcion_registro: e.created_at
        ? format(parseISO(e.created_at), 'yyyy-MM-dd HH:mm:ss')
        : '',
      material: e.material?.material_name || '',
      categoria: e.material?.category || '',
      oc: poRef?.po_number || '',
      proveedor: e.supplier?.name || '',
      proveedor_numero: e.supplier?.provider_number || '',
      remision_factura: e.supplier_invoice || '',
      factura_flota: e.fleet_invoice || '',
      vencimiento_material: e.ap_due_date_material || '',
      vencimiento_flota: e.ap_due_date_fleet || '',
      cantidad_etiqueta: formatReceivedQuantity(e),
      cantidad_kg: e.received_qty_kg ?? e.quantity_received ?? '',
      uom_captura: e.received_uom || '',
      precio_unitario: e.unit_price ?? '',
      total_material: e.total_cost ?? '',
      costo_flota: e.fleet_cost ?? '',
      precio_landed_kg: e.landed_unit_price ?? '',
      documentos_adjuntos: e.document_count ?? 0,
      revisado_por: reviewerLabel(e),
      notas: e.notes || '',
    }
  })
}
