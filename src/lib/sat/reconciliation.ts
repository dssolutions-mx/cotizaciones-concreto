import type { SupabaseClient } from '@supabase/supabase-js'

export type ReconciliationReport = {
  matched: Array<{
    uuid: string
    supplier_invoice_id: string
    invoice_number: string
    sat_total: number
    system_total: number
    total_match: boolean
    sat_estado: string
  }>
  in_sat_not_in_system: any[]
  in_system_not_in_sat: any[]
  cancelled_in_sat_but_open: any[]
  total_mismatch: Array<{
    uuid: string
    invoice_number: string
    sat_total: number
    system_total: number
    diff: number
  }>
  unapplied_credit_notes: any[]
  summary: {
    total_sat: number
    matched: number
    in_sat_only: number
    in_system_only: number
    cancelled_open: number
    total_mismatch: number
    unapplied_nc: number
  }
}

export async function buildReconciliationReport(
  supabase: SupabaseClient,
  from: string,
  to: string,
  emisorRfc?: string,
): Promise<ReconciliationReport> {
  // Fetch SAT inventory for the period
  let satQuery = supabase
    .from('sat_cfdi_recibidos')
    .select('*')
    .gte('fecha_emision', from)
    .lte('fecha_emision', to + 'T23:59:59')
    .in('tipo_comprobante', ['I', 'E'])

  if (emisorRfc) satQuery = satQuery.eq('emisor_rfc', emisorRfc)

  const { data: satRows } = await satQuery
  const satList: any[] = satRows ?? []

  // Fetch invoices with cfdi_uuid set in that date range
  let invQuery = supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_number, invoice_date, total, status, cfdi_uuid, cfdi_emisor_rfc,
      supplier_group:supplier_groups!supplier_group_id(id, name, rfc)
    `)
    .gte('invoice_date', from)
    .lte('invoice_date', to)

  if (emisorRfc) invQuery = invQuery.eq('cfdi_emisor_rfc', emisorRfc)

  const { data: invRows } = await invQuery
  const invList: any[] = invRows ?? []

  // Index by UUID
  const satByUuid = new Map<string, any>(satList.map(r => [r.uuid, r]))
  const invByUuid = new Map<string, any>(
    invList.filter(i => i.cfdi_uuid).map(i => [i.cfdi_uuid as string, i])
  )

  const matched: ReconciliationReport['matched'] = []
  const totalMismatch: ReconciliationReport['total_mismatch'] = []
  const inSatOnly: any[] = []
  const cancelledOpen: any[] = []
  const unappliedNc: any[] = []

  for (const sat of satList) {
    if (sat.tipo_comprobante === 'E') {
      // Credit note — check if linked to a supplier_invoice credit note
      const { data: linked } = await supabase
        .from('invoice_credit_notes')
        .select('id')
        .eq('cfdi_uuid', sat.uuid)
        .maybeSingle()
      if (!linked) unappliedNc.push(sat)
      continue
    }

    const inv = invByUuid.get(sat.uuid)
    if (!inv) {
      if (sat.estado_sat === 'cancelado') {
        // Cancelled in SAT and not in system — just report as SAT-only
      }
      inSatOnly.push(sat)
      continue
    }

    // Matched by UUID
    const totalMatch = Math.abs(Number(sat.total) - Number(inv.total)) <= 0.02
    matched.push({
      uuid: sat.uuid,
      supplier_invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      sat_total: Number(sat.total),
      system_total: Number(inv.total),
      total_match: totalMatch,
      sat_estado: sat.estado_sat ?? 'vigente',
    })

    if (!totalMatch) {
      totalMismatch.push({
        uuid: sat.uuid,
        invoice_number: inv.invoice_number,
        sat_total: Number(sat.total),
        system_total: Number(inv.total),
        diff: Math.round((Number(inv.total) - Number(sat.total)) * 100) / 100,
      })
    }

    if (sat.estado_sat === 'cancelado' && (inv.status === 'open' || inv.status === 'partially_paid')) {
      cancelledOpen.push({ sat, inv })
    }
  }

  // Invoices in system not in SAT (UUID present but SAT doesn't have it, or no UUID)
  const inSystemOnly = invList.filter(inv => {
    if (!inv.cfdi_uuid) return true // manual mode — no UUID to match
    return !satByUuid.has(inv.cfdi_uuid)
  })

  return {
    matched,
    in_sat_not_in_system: inSatOnly,
    in_system_not_in_sat: inSystemOnly,
    cancelled_in_sat_but_open: cancelledOpen,
    total_mismatch: totalMismatch,
    unapplied_credit_notes: unappliedNc,
    summary: {
      total_sat: satList.filter(s => s.tipo_comprobante === 'I').length,
      matched: matched.length,
      in_sat_only: inSatOnly.length,
      in_system_only: inSystemOnly.length,
      cancelled_open: cancelledOpen.length,
      total_mismatch: totalMismatch.length,
      unapplied_nc: unappliedNc.length,
    },
  }
}
