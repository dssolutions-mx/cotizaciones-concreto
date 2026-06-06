import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canWriteApInvoices } from '@/lib/ap/apInvoiceRoles'
import { getApServiceClient } from '@/lib/ap/apWriteClient'
import {
  deleteEntireSupplierInvoice,
  deleteSupplierInvoiceItems,
} from '@/lib/ap/deleteSupplierInvoiceItems'
import {
  buildInvoiceTotalsFromBody,
  deriveInvoiceSource,
  normalizeInvoiceItems,
} from '@/lib/ap/normalizeInvoicePayload'
import { roundMoney } from '@/lib/ap/invoiceTotals'

// ── GET /api/ap/invoices/[id] ────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !canWriteApInvoices(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: invoice, error } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
        retentions:supplier_invoice_retentions(
          id, impuesto_sat, label, base_amount, rate, amount, sort_order
        ),
        items:supplier_invoice_items(
          id, entry_id, line_source, manual_reason, cost_category, description, qty, unit_price, amount,
          entry:material_entries!entry_id(
            id, entry_number, entry_date, received_qty_entered, received_uom,
            unit_price, landed_unit_price, supplier_invoice, po_id, fleet_po_id
          )
        ),
        payable:payables!invoice_id(
          id, status, subtotal, tax, total,
          payments:payments!payable_id(id, payment_date, amount, method, reference)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !invoice) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const payable = Array.isArray(invoice.payable) ? (invoice.payable as any[])[0] : invoice.payable
    const payments: any[] = payable?.payments ?? []
    const paid_to_date = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)

    return NextResponse.json({
      invoice: { ...invoice, payable: payable ?? null, paid_to_date, balance: Number(invoice.total) - paid_to_date },
    })
  } catch (err) {
    console.error('/api/ap/invoices/[id] GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH /api/ap/invoices/[id] — update invoice adjustments ─────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !canWriteApInvoices(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('supplier_invoices')
      .select(`
        id, status, plant_id, subtotal, vat_rate, discount_amount,
        retention_isr_rate, retention_iva_rate,
        payable:payables!invoice_id(id, status, payments:payments!payable_id(amount)),
        cn_allocations:credit_note_invoice_allocations(allocated_total)
      `)
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    }

    if (existing.status === 'paid' || existing.status === 'void') {
      return NextResponse.json({ error: 'No se puede editar una factura pagada o anulada' }, { status: 400 })
    }

    const body = await request.json()
    const itemUpdates: Array<{ id: string; amount: number }> = Array.isArray(body.items)
      ? body.items.filter((it: any) => it?.id != null && it.amount != null)
      : []
    const itemsToAdd = Array.isArray(body.items_to_add) ? body.items_to_add : []
    const itemIdsToDelete: string[] = Array.isArray(body.items_to_delete)
      ? body.items_to_delete.map(String)
      : []

    if (itemsToAdd.length > 0) {
      const { items: newItems, error: addErr } = normalizeInvoiceItems(itemsToAdd)
      if (addErr) return NextResponse.json({ error: addErr }, { status: 400 })
      const rows = newItems.map(it => ({
        invoice_id: id,
        entry_id: it.entry_id,
        line_source: it.line_source,
        manual_reason: it.manual_reason,
        cost_category: it.cost_category,
        description: it.description,
        qty: it.qty,
        unit_price: it.unit_price,
        amount: it.amount,
      }))
      const { error: insErr } = await supabase.from('supplier_invoice_items').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    if (itemIdsToDelete.length > 0) {
      const writeClient = getApServiceClient()
      if (!writeClient.ok) {
        return NextResponse.json({ error: writeClient.error }, { status: 503 })
      }
      const delResult = await deleteSupplierInvoiceItems(writeClient.client, id, itemIdsToDelete)
      if (!delResult.ok) {
        return NextResponse.json({ error: delResult.error }, { status: delResult.status })
      }
      if (delResult.invoiceDeleted) {
        return NextResponse.json({
          deleted: true,
          invoice_deleted: true,
          deleted_item_ids: delResult.deletedItemIds,
        })
      }
    }

    if (itemUpdates.length > 0) {
      for (const it of itemUpdates) {
        const amt = roundMoney(Number(it.amount))
        const { error: itemErr } = await supabase
          .from('supplier_invoice_items')
          .update({ amount: amt })
          .eq('id', it.id)
          .eq('invoice_id', id)
        if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })
      }
    }

    const { data: allItems } = await supabase
      .from('supplier_invoice_items')
      .select('id, entry_id, line_source, amount')
      .eq('invoice_id', id)

    if (!allItems?.length) {
      return NextResponse.json({ error: 'La factura debe tener al menos una línea' }, { status: 400 })
    }

    let subtotal = (allItems ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
    subtotal = roundMoney(subtotal)

    const vatRate = 'vat_rate' in body ? Number(body.vat_rate) : Number(existing.vat_rate)
    const discountAmt = 'discount_amount' in body
      ? roundMoney(Number(body.discount_amount))
      : Number(existing.discount_amount ?? 0)

    const totalsPayload = {
      ...body,
      discount_amount: discountAmt,
      vat_rate: vatRate,
      retention_isr_rate: body.retention_isr_rate ?? existing.retention_isr_rate,
      retention_iva_rate: body.retention_iva_rate ?? existing.retention_iva_rate,
    }
    const {
      tax,
      total,
      retention_isr_rate: isrRate,
      retention_isr_amount: isrAmt,
      retention_iva_rate: ivaRetRate,
      retention_iva_amount: ivaRetAmt,
      retentionRows,
      taxableBase,
    } = buildInvoiceTotalsFromBody(totalsPayload, subtotal)

    const invoiceSource = deriveInvoiceSource(
      (allItems ?? []).map(r => ({
        line_source: r.line_source,
        entry_id: r.entry_id,
      })),
    )

    const payable = Array.isArray(existing.payable) ? (existing.payable as any[])[0] : existing.payable
    const payments: any[] = payable?.payments ?? []
    const paidToDate = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
    const cnAllocs: any[] = (existing as any).cn_allocations ?? []
    const creditApplied = cnAllocs.reduce((s: number, a: any) => s + Number(a.allocated_total ?? 0), 0)
    const minTotal = paidToDate + creditApplied

    if (total < minTotal - 0.01) {
      return NextResponse.json({
        error: `El total ajustado (${total.toFixed(2)}) no puede ser menor a lo ya pagado/acreditado (${minTotal.toFixed(2)})`,
      }, { status: 400 })
    }

    if (Array.isArray(body.retentions)) {
      await supabase.from('supplier_invoice_retentions').delete().eq('invoice_id', id)
      if (retentionRows.length > 0) {
        const retentionInserts = retentionRows.map((r, idx) => ({
          invoice_id: id,
          impuesto_sat: r.impuesto_sat,
          label: r.label ?? null,
          base_amount: r.base_amount ?? taxableBase,
          rate: r.rate ?? null,
          amount: r.amount,
          sort_order: r.sort_order ?? idx,
        }))
        const { error: retErr } = await supabase
          .from('supplier_invoice_retentions')
          .insert(retentionInserts)
        if (retErr) return NextResponse.json({ error: retErr.message }, { status: 500 })
      }
    }

    const update: Record<string, unknown> = {
      subtotal,
      vat_rate: vatRate,
      discount_amount: discountAmt,
      retention_isr_rate: isrRate,
      retention_isr_amount: isrAmt,
      retention_iva_rate: ivaRetRate,
      retention_iva_amount: ivaRetAmt,
      tax,
      total,
      source: invoiceSource,
    }

    if ('status' in body) update.status = body.status
    if ('notes' in body) update.notes = body.notes
    if ('document_url' in body) update.document_url = body.document_url
    if ('xml_url' in body) update.xml_url = body.xml_url
    if ('due_date' in body) update.due_date = body.due_date

    const { data: invoice, error } = await supabase
      .from('supplier_invoices')
      .update(update)
      .eq('id', id)
      .select(`
        *,
        retentions:supplier_invoice_retentions(*),
        items:supplier_invoice_items(*)
      `)
      .single()

    if (error || !invoice) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })

    if (payable?.id) {
      const payableUpdate: Record<string, unknown> = {
        subtotal,
        tax,
        total,
        vat_rate: vatRate,
      }
      if ('due_date' in body) payableUpdate.due_date = body.due_date
      if (update.status) payableUpdate.status = update.status

      await supabase.from('payables').update(payableUpdate).eq('id', payable.id)

      if (itemUpdates.length > 0) {
        const { data: invoiceItems } = await supabase
          .from('supplier_invoice_items')
          .select('id, entry_id')
          .eq('invoice_id', id)
          .in('id', itemUpdates.map(it => it.id))

        for (const it of itemUpdates) {
          const amt = roundMoney(Number(it.amount))
          const entryId = invoiceItems?.find(row => row.id === it.id)?.entry_id
          if (!entryId) continue
          await supabase
            .from('payable_items')
            .update({ amount: amt })
            .eq('payable_id', payable.id)
            .eq('entry_id', entryId)
        }
      }
    } else if (update.status) {
      await supabase.from('payables').update({ status: update.status }).eq('invoice_id', id)
    }

    return NextResponse.json({ invoice })
  } catch (err) {
    console.error('/api/ap/invoices/[id] PATCH error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/ap/invoices/[id] — remove invoice (no payments / NC applied) ─
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()
    if (!profile || !canWriteApInvoices(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: invoice } = await supabase
      .from('supplier_invoices')
      .select('id, plant_id')
      .eq('id', id)
      .maybeSingle()

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && invoice.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'Sin permisos para esta planta' }, { status: 403 })
    }

    const writeClient = getApServiceClient()
    if (!writeClient.ok) {
      return NextResponse.json({ error: writeClient.error }, { status: 503 })
    }

    const result = await deleteEntireSupplierInvoice(writeClient.client, id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    if (!result.invoiceDeleted) {
      return NextResponse.json(
        { error: 'La factura no se eliminó por completo. Revise líneas, pagos o notas de crédito.' },
        { status: 409 },
      )
    }

    const { data: stillThere } = await supabase
      .from('supplier_invoices')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (stillThere) {
      return NextResponse.json(
        {
          error:
            'La factura sigue visible después del borrado. Contacte soporte si el problema persiste.',
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      invoice_deleted: true,
      deleted_item_ids: result.deletedItemIds,
      remaining_item_count: result.remainingItemCount,
    })
  } catch (err) {
    console.error('/api/ap/invoices/[id] DELETE error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
