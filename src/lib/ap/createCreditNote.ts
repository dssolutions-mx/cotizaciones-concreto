import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { propagateCreditToEntry, buildProportionalItemAllocations } from '@/lib/ap/creditPropagation'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'

export type CreditNoteInvoiceAllocationInput = {
  invoice_id: string
  allocated_subtotal: number
  item_allocations?: Array<{ invoice_item_id: string; allocated_amount: number }>
}

export type CreateCreditNoteInput = {
  supplier_group_id: string
  plant_id: string
  credit_number?: string | null
  credit_date: string
  reason: string
  notes?: string | null
  amount: number
  vat_rate?: number
  invoice_allocations: CreditNoteInvoiceAllocationInput[]
  cfdi_uuid?: string | null
  cfdi_serie?: string | null
  cfdi_folio?: string | null
  cfdi_forma_pago?: string | null
  cfdi_metodo_pago?: string | null
  cfdi_uso?: string | null
  cfdi_tipo_comprobante?: string | null
  cfdi_fecha_emision?: string | null
  cfdi_fecha_timbrado?: string | null
  cfdi_emisor_rfc?: string | null
  cfdi_receptor_rfc?: string | null
  cfdi_relacionado_uuid?: string | null
  cfdi_capture_mode?: string
}

export type CreateCreditNoteResult =
  | { ok: true; credit_note: Record<string, unknown> }
  | { ok: false; error: string; status: number }

export async function createCreditNote(
  supabase: SupabaseClient,
  userId: string,
  body: CreateCreditNoteInput,
): Promise<CreateCreditNoteResult> {
  const {
    supplier_group_id,
    plant_id,
    credit_number,
    credit_date,
    reason,
    notes,
    amount,
    vat_rate = 0.16,
    invoice_allocations,
    cfdi_uuid: rawCfdiUuid = null,
    cfdi_serie = null,
    cfdi_folio = null,
    cfdi_forma_pago = null,
    cfdi_metodo_pago = null,
    cfdi_uso = null,
    cfdi_tipo_comprobante = null,
    cfdi_fecha_emision = null,
    cfdi_fecha_timbrado = null,
    cfdi_emisor_rfc = null,
    cfdi_receptor_rfc = null,
    cfdi_relacionado_uuid = null,
    cfdi_capture_mode = 'manual',
  } = body

  const cfdi_uuid = normalizeCfdiUuid(rawCfdiUuid)

  if (!supplier_group_id || !plant_id || !credit_date || !reason || !amount || amount <= 0) {
    return {
      ok: false,
      error: 'Campos requeridos: supplier_group_id, plant_id, credit_date, reason, amount',
      status: 400,
    }
  }
  if (!Array.isArray(invoice_allocations) || invoice_allocations.length === 0) {
    return { ok: false, error: 'Se requiere al menos una factura en invoice_allocations', status: 400 }
  }

  if (cfdi_capture_mode === 'cfdi') {
    if (!cfdi_uuid || !cfdi_emisor_rfc) {
      return { ok: false, error: 'Modo CFDI requiere cfdi_uuid y cfdi_emisor_rfc', status: 400 }
    }
    if (cfdi_tipo_comprobante && cfdi_tipo_comprobante !== 'E') {
      return { ok: false, error: 'El CFDI debe ser de tipo Egreso (E) para una nota de crédito', status: 400 }
    }
  }

  if (cfdi_uuid) {
    const { data: dup } = await supabase
      .from('invoice_credit_notes')
      .select('id, credit_number')
      .eq('cfdi_uuid', cfdi_uuid)
      .maybeSingle()
    if (dup) {
      return {
        ok: false,
        error: `Este CFDI ya está registrado en la NC ${dup.credit_number ?? dup.id}`,
        status: 409,
      }
    }
  }

  const allocSum = invoice_allocations.reduce((s, a) => s + Number(a.allocated_subtotal ?? 0), 0)
  if (Math.abs(allocSum - Number(amount)) > 0.01) {
    return {
      ok: false,
      error: `La suma de asignaciones (${allocSum}) no coincide con el monto del crédito (${amount})`,
      status: 400,
    }
  }

  const invoiceIds = invoice_allocations.map((a) => a.invoice_id)
  const { data: invoices, error: invErr } = await supabase
    .from('supplier_invoices')
    .select(`
      id, supplier_group_id, invoice_number, subtotal, discount_amount, vat_rate, status,
      items:supplier_invoice_items(id, entry_id, amount, cost_category)
    `)
    .in('id', invoiceIds)

  if (invErr || !invoices || invoices.length !== invoiceIds.length) {
    return { ok: false, error: 'Una o más facturas no encontradas', status: 404 }
  }

  for (const inv of invoices) {
    if (inv.supplier_group_id !== supplier_group_id) {
      return {
        ok: false,
        error: `Factura ${inv.id} no pertenece al grupo de proveedor indicado`,
        status: 400,
      }
    }
    if (inv.status === 'void') {
      return {
        ok: false,
        error: `Factura ${inv.id} está anulada y no puede recibir notas de crédito`,
        status: 400,
      }
    }
  }

  const { data: existingInvAllocs } = await supabase
    .from('credit_note_invoice_allocations')
    .select('invoice_id, allocated_subtotal')
    .in('invoice_id', invoiceIds)

  for (const alloc of invoice_allocations) {
    const inv = invoices.find((i) => i.id === alloc.invoice_id)!
    const taxableBase = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
    const alreadyApplied = (existingInvAllocs ?? [])
      .filter((a) => a.invoice_id === alloc.invoice_id)
      .reduce((s, a) => s + Number(a.allocated_subtotal), 0)
    if (alreadyApplied + Number(alloc.allocated_subtotal) > taxableBase + 0.01) {
      return {
        ok: false,
        error: `El crédito para la factura ${inv.invoice_number ?? inv.id} excede la base gravable (${taxableBase})`,
        status: 400,
      }
    }

    if ((alloc.item_allocations?.length ?? 0) > 0) {
      const itemSum = alloc.item_allocations.reduce((s, a) => s + Number(a.allocated_amount ?? 0), 0)
      if (Math.abs(itemSum - Number(alloc.allocated_subtotal)) > 0.01) {
        return {
          ok: false,
          error: `La suma de asignaciones por línea no coincide con el monto asignado a la factura ${inv.id}`,
          status: 400,
        }
      }
    }
  }

  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return { ok: false, error: 'Configuración del servidor incompleta', status: 503 }
  }

  const taxAmount = Math.round(Number(amount) * Number(vat_rate) * 100) / 100

  const { data: creditNote, error: cnErr } = await admin
    .from('invoice_credit_notes')
    .insert({
      supplier_group_id,
      plant_id,
      credit_number: credit_number?.trim() || null,
      credit_date,
      reason,
      amount: Number(amount),
      tax_amount: taxAmount,
      total: Number(amount) + taxAmount,
      vat_rate: Number(vat_rate),
      status: 'open',
      notes: notes?.trim() || null,
      applied_by: userId,
      cfdi_uuid: cfdi_uuid || null,
      cfdi_serie,
      cfdi_folio,
      cfdi_forma_pago,
      cfdi_metodo_pago,
      cfdi_uso,
      cfdi_tipo_comprobante,
      cfdi_fecha_emision,
      cfdi_fecha_timbrado,
      cfdi_emisor_rfc,
      cfdi_receptor_rfc,
      cfdi_relacionado_uuid,
      cfdi_capture_mode,
    })
    .select()
    .single()

  if (cnErr || !creditNote) {
    return { ok: false, error: cnErr?.message ?? 'Error al crear nota de crédito', status: 500 }
  }

  for (const alloc of invoice_allocations) {
    const inv = invoices.find((i) => i.id === alloc.invoice_id)!
    const allocTax = Math.round(Number(alloc.allocated_subtotal) * Number(inv.vat_rate) * 100) / 100

    const { data: invAlloc, error: invAllocErr } = await admin
      .from('credit_note_invoice_allocations')
      .insert({
        credit_note_id: creditNote.id,
        invoice_id: alloc.invoice_id,
        allocated_subtotal: Number(alloc.allocated_subtotal),
        allocated_tax: allocTax,
      })
      .select('id')
      .single()

    if (invAllocErr || !invAlloc) continue

    const items = (inv.items ?? []).map((i: { id: string; amount: number }) => ({
      id: i.id,
      amount: Number(i.amount),
    }))

    const itemAllocs =
      (alloc.item_allocations?.length ?? 0) > 0
        ? alloc.item_allocations!
        : buildProportionalItemAllocations(items, Number(alloc.allocated_subtotal))

    if (itemAllocs.length > 0) {
      await admin.from('invoice_credit_note_allocations').insert(
        itemAllocs.map((a) => ({
          credit_note_id: creditNote.id,
          invoice_allocation_id: invAlloc.id,
          invoice_item_id: a.invoice_item_id,
          allocated_amount: a.allocated_amount,
        })),
      )
    }

    for (const itemAlloc of itemAllocs) {
      const item = (inv.items ?? []).find((i: { id: string }) => i.id === itemAlloc.invoice_item_id) as
        | { id: string; entry_id: string | null; amount: number; cost_category: string }
        | undefined
      if (!item?.entry_id) continue
      await propagateCreditToEntry(
        admin,
        item.id,
        Number(item.amount),
        item.cost_category,
        item.entry_id,
      ).catch((e) => console.error('propagateCreditToEntry error:', e))
    }

    const { data: currentAllocs } = await admin
      .from('credit_note_invoice_allocations')
      .select('allocated_subtotal')
      .eq('invoice_id', alloc.invoice_id)

    const totalCredited = (currentAllocs ?? []).reduce(
      (s, a) => s + Number(a.allocated_subtotal),
      0,
    )
    const taxableBase = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)

    if (totalCredited >= taxableBase - 0.01) {
      await admin.from('supplier_invoices').update({ status: 'paid' }).eq('id', alloc.invoice_id)
      await admin.from('payables').update({ status: 'paid' }).eq('invoice_id', alloc.invoice_id)
    }
  }

  const totalAllocated = invoice_allocations.reduce(
    (s, a) => s + Number(a.allocated_subtotal),
    0,
  )
  const cnStatus =
    Math.abs(totalAllocated - Number(amount)) <= 0.01 ? 'fully_applied' : 'partially_applied'

  await admin.from('invoice_credit_notes').update({ status: cnStatus }).eq('id', creditNote.id)

  return { ok: true, credit_note: { ...creditNote, status: cnStatus } }
}
