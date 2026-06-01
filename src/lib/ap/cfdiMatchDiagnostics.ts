import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedCfdi } from '@/types/finance'
import type { CfdiMatchDiagnostics, RepMatchMethod } from '@/types/finance'
import type { CreditNoteBulkPreviewStatus } from '@/lib/ap/creditNoteBulk'
import type { RepPaymentPreviewStatus } from '@/types/finance'

export type CfdiOpenInvoiceHint = {
  id: string
  invoice_number: string
  cfdi_uuid: string | null
  cfdi_folio: string | null
  cfdi_serie: string | null
  status: string
  balance: number | null
  plant_id: string
}

export type CfdiRelatedUuidHint = {
  uuid: string
  tipo_relacion: string | null
  matched_in_cxp: boolean
}

export function relatedUuidsFromCfdi(cfdi: ParsedCfdi): CfdiRelatedUuidHint[] {
  return cfdi.cfdi_relacionados.map((r) => ({
    uuid: r.uuid,
    tipo_relacion: r.tipo_relacion ?? null,
    matched_in_cxp: false,
  }))
}

export function markRelatedUuidMatches(
  related: CfdiRelatedUuidHint[],
  openInvoices: CfdiOpenInvoiceHint[],
): CfdiRelatedUuidHint[] {
  const uuids = new Set(
    openInvoices.map((i) => (i.cfdi_uuid ?? '').toLowerCase()).filter(Boolean),
  )
  return related.map((r) => ({
    ...r,
    matched_in_cxp: uuids.has(r.uuid.toLowerCase()),
  }))
}

export function buildNcMatchDiagnostics(params: {
  cfdi: ParsedCfdi
  status: CreditNoteBulkPreviewStatus
  supplierGroupName: string | null
  related: CfdiRelatedUuidHint[]
  openInvoices: CfdiOpenInvoiceHint[]
  matchedInvoiceCount?: number
}): CfdiMatchDiagnostics {
  const { cfdi, status, supplierGroupName, related, openInvoices } = params
  const steps: string[] = [
    `Emisor (proveedor): RFC ${cfdi.emisor_rfc}${cfdi.emisor_nombre ? ` · ${cfdi.emisor_nombre}` : ''}`,
    supplierGroupName
      ? `Grupo en CxP: «${supplierGroupName}» (mismo RFC)`
      : `Sin grupo de proveedor activo con RFC ${cfdi.emisor_rfc}`,
    `CfdiRelacionados en XML: ${related.length} UUID(s) — tipo relación suele ser 01 (nota aplicada a factura)`,
    ...related.map(
      (r, i) =>
        `  ${i + 1}. ${r.uuid}${r.tipo_relacion ? ` [${r.tipo_relacion}]` : ''}${
          r.matched_in_cxp ? ' ✓ factura abierta con este UUID' : ' ✗ sin factura abierta con este UUID'
        }`,
    ),
    'Criterio de match: factura abierta o parcialmente pagada del mismo proveedor cuyo cfdi_uuid coincide (sin distinguir mayúsculas) con un UUID relacionado',
    `Facturas abiertas del proveedor en CxP: ${openInvoices.length} (muestra hasta 25)`,
  ]

  let criteria_summary: string
  switch (status) {
    case 'ready':
      criteria_summary = `Match por UUID: ${params.matchedInvoiceCount ?? 0} factura(s) relacionada(s)`
      break
    case 'missing_supplier_group':
      criteria_summary = 'Cree o active un grupo de proveedor con el RFC del emisor antes de importar'
      break
    case 'no_related_invoices':
      criteria_summary =
        related.length === 0
          ? 'El XML no incluye CFDI relacionados — no hay UUID que buscar en CxP'
          : 'Los UUID del XML no coinciden con ninguna factura abierta del proveedor (revise UUID en factura o registre la factura)'
      break
    case 'duplicate':
      criteria_summary = 'Esta NC ya está registrada en el sistema'
      break
    case 'receptor_mismatch':
      criteria_summary = 'El RFC receptor del XML no es el de su empresa'
      break
    case 'allocation_mismatch':
      criteria_summary = 'Hay facturas relacionadas pero no se pudo repartir el monto de la NC'
      break
    default:
      criteria_summary = 'Revise el detalle abajo'
  }

  return {
    criteria_summary,
    steps,
    searched_uuids: related.map((r) => r.uuid),
    searched_folio: [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || null,
    emisor_rfc: cfdi.emisor_rfc,
    supplier_group_name: supplierGroupName,
    related_uuids: related,
    open_invoices_same_supplier: openInvoices,
  }
}

export function buildRepMatchDiagnostics(params: {
  emisor_rfc: string
  emisor_nombre: string | null
  docto_uuid: string
  docto_folio: string | null
  status: RepPaymentPreviewStatus
  match_method: RepMatchMethod | null
  supplierGroupName: string | null
  openInvoices: CfdiOpenInvoiceHint[]
  companyRfc?: string | null
}): CfdiMatchDiagnostics {
  const folio = params.docto_folio
  const steps: string[] = [
    `Emisor (proveedor): RFC ${params.emisor_rfc}${params.emisor_nombre ? ` · ${params.emisor_nombre}` : ''}`,
    params.supplierGroupName
      ? `Grupo en CxP: «${params.supplierGroupName}»`
      : `Sin grupo activo con RFC ${params.emisor_rfc}`,
    `DoctoRelacionado @IdDocumento (UUID factura ingreso): ${params.docto_uuid}`,
    folio ? `Folio / serie en nodo de pago: ${folio}` : 'Sin folio en el complemento — solo búsqueda por UUID y SAT',
    'Orden de match: (1) cfdi_uuid en factura CxP = UUID del docto, (2) inventario SAT tipo I + folio, (3) RFC emisor + folio vs número de factura / cfdi_folio',
    params.match_method
      ? `Resultado: ${params.match_method === 'uuid' ? 'coincidencia por UUID' : params.match_method === 'folio' ? 'coincidencia por folio + RFC' : params.match_method === 'sat_bridge' ? 'vía SAT + folio' : params.match_method}`
      : 'Resultado: sin factura enlazada',
    `Facturas abiertas del proveedor: ${params.openInvoices.length}`,
  ]

  let criteria_summary: string
  switch (params.status) {
    case 'ready':
      criteria_summary = 'Listo para aplicar — match por UUID'
      break
    case 'match_folio_confirm':
      criteria_summary = 'Match por folio/SAT — confirme antes de aplicar (se puede guardar UUID en la factura)'
      break
    case 'ambiguous_match':
      criteria_summary = 'Varias facturas cumplen folio/RFC — elija la correcta'
      break
    case 'invoice_not_found':
      criteria_summary =
        'No hay factura en CxP con ese UUID ni folio del proveedor — registre la factura o corrija cfdi_uuid'
      break
    case 'sat_without_invoice':
      criteria_summary = 'El CFDI de ingreso está en inventario SAT pero no hay factura en CxP'
      break
    case 'no_payable':
      criteria_summary = 'Factura encontrada pero sin cuenta por pagar — se puede crear al aplicar'
      break
    case 'receptor_mismatch':
      criteria_summary = params.companyRfc
        ? `Receptor del XML distinto al RFC empresa (${params.companyRfc})`
        : 'Receptor del XML no coincide con la empresa'
      break
    case 'already_applied':
      criteria_summary = 'Este par REP + documento + parcialidad ya tiene pago registrado'
      break
    default:
      criteria_summary = params.status.replace(/_/g, ' ')
  }

  return {
    criteria_summary,
    steps,
    searched_uuids: [params.docto_uuid],
    searched_folio: folio,
    emisor_rfc: params.emisor_rfc,
    supplier_group_name: params.supplierGroupName,
    related_uuids: [],
    open_invoices_same_supplier: params.openInvoices,
  }
}

export async function loadSupplierContextByEmisorRfc(
  supabase: SupabaseClient,
  emisorRfc: string,
  plantId?: string | null,
): Promise<{ groupId: string | null; groupName: string | null; openInvoices: CfdiOpenInvoiceHint[] }> {
  const { data: group } = await supabase
    .from('supplier_groups')
    .select('id, name')
    .eq('rfc', emisorRfc)
    .eq('is_active', true)
    .maybeSingle()
  if (!group) {
    return { groupId: null, groupName: null, openInvoices: [] }
  }
  const openInvoices = await loadOpenInvoicesForSupplierGroup(supabase, group.id, plantId)
  return { groupId: group.id, groupName: group.name, openInvoices }
}

export async function loadOpenInvoicesForSupplierGroup(
  supabase: SupabaseClient,
  supplierGroupId: string,
  plantId?: string | null,
  limit = 25,
): Promise<CfdiOpenInvoiceHint[]> {
  let q = supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_number, status, plant_id, cfdi_uuid, cfdi_folio, cfdi_serie,
      subtotal, discount_amount, total,
      payable:payables!invoice_id(
        id,
        payments:payments!payable_id(amount)
      ),
      cn_allocations:credit_note_invoice_allocations(allocated_total)
    `)
    .eq('supplier_group_id', supplierGroupId)
    .in('status', ['open', 'partially_paid'])
    .order('invoice_date', { ascending: false })
    .limit(limit)

  if (plantId) q = q.eq('plant_id', plantId)

  const { data } = await q
  return (data ?? []).map((inv) => {
    const payable = Array.isArray(inv.payable) ? inv.payable[0] : inv.payable
    const payments = payable?.payments ?? []
    const paid = payments.reduce((s: number, p: { amount: number }) => s + Number(p.amount ?? 0), 0)
    const cn = (inv.cn_allocations ?? []).reduce(
      (s: number, a: { allocated_total: number }) => s + Number(a.allocated_total ?? 0),
      0,
    )
    const balance = Number(inv.total) - paid - cn
    return {
      id: inv.id as string,
      invoice_number: inv.invoice_number as string,
      cfdi_uuid: inv.cfdi_uuid as string | null,
      cfdi_folio: inv.cfdi_folio as string | null,
      cfdi_serie: inv.cfdi_serie as string | null,
      status: inv.status as string,
      balance: Math.round(balance * 100) / 100,
      plant_id: inv.plant_id as string,
    }
  })
}
