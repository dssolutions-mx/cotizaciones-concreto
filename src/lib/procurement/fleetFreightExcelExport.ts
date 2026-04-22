import * as XLSX from 'xlsx'
import { format, parseISO } from 'date-fns'
import type { MaterialEntry } from '@/types/inventory'
import { formatReceivedQuantity } from '@/lib/inventory/entryReceivedDisplay'

type FleetPoEmb = { po_number?: string | null; supplier?: { name?: string | null } | null } | null

function fleetItem(e: MaterialEntry) {
  return (e as MaterialEntry & { fleet_po_item?: { uom?: string | null; qty_ordered?: number; qty_received?: number } })
    .fleet_po_item
}

/** Rows for conciliación fletes (alineado con la vista en pantalla). */
export function fleetFreightReconciliationToRows(
  entries: MaterialEntry[],
  options: { transportistaSeleccionado: string; dateFrom: string; dateTo: string }
) {
  return entries.map((e) => {
    const fp = (e as MaterialEntry & { fleet_po?: FleetPoEmb }).fleet_po
    const fi = fleetItem(e)
    return {
      periodo_desde: options.dateFrom,
      periodo_hasta: options.dateTo,
      transportista_filtro: options.transportistaSeleccionado,
      transportista_encabezado_oc_flota: fp?.supplier?.name || '',
      entrada: e.entry_number || e.id.slice(0, 8),
      recepcion_fecha: e.entry_date || '',
      recepcion_hora: e.entry_time || '',
      planta: e.plant?.name || e.plant?.code || '',
      material: e.material?.material_name || '',
      proveedor_material: e.supplier?.name || '',
      oc_material: e.po?.po_number || '',
      oc_flota: e.fleet_po?.po_number || '',
      linea_flota_uom: fi?.uom || e.fleet_uom || '',
      linea_ordenada: fi?.qty_ordered ?? '',
      linea_recibida_acum: fi?.qty_received ?? '',
      cantidad_recepcion: formatReceivedQuantity(e),
      servicio_cantidad: e.fleet_qty_entered ?? '',
      servicio_uom: e.fleet_uom || fi?.uom || '',
      costo_flete: e.fleet_cost ?? '',
      factura_flete: e.fleet_invoice || '',
      vencimiento_flete: e.ap_due_date_fleet || '',
      estado_precios: e.pricing_status || '',
      revisado: e.reviewed_at
        ? format(parseISO(e.reviewed_at), 'yyyy-MM-dd HH:mm')
        : '',
      notas: e.notes || '',
    }
  })
}

export function downloadFleetFreightReconciliationXlsx(
  entries: MaterialEntry[],
  options: { transportistaSeleccionado: string; dateFrom: string; dateTo: string; filenameBase?: string }
) {
  const rows = fleetFreightReconciliationToRows(entries, options)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ mensaje: 'Sin filas en el export' }])
  const safe = (s: string) => s.replace(/[^\w\-]+/g, '_').slice(0, 40)
  XLSX.utils.book_append_sheet(wb, ws, 'Fletes')
  const base = options.filenameBase || `Fletes_${safe(options.transportistaSeleccionado)}`
  const file = `${base}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  XLSX.writeFile(wb, file)
}
