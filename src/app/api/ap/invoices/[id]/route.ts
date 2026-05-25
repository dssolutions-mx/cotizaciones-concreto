import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { computeInvoiceTotals } from '@/lib/ap/retentionRates'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// ── GET /api/ap/invoices/[id] ────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: invoice, error } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
        items:supplier_invoice_items(
          id, entry_id, cost_category, description, qty, unit_price, amount,
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
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('supplier_invoices')
      .select(`
        id, status, subtotal, vat_rate, discount_amount,
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

    let subtotal = Number(existing.subtotal)
    if ('subtotal' in body) {
      subtotal = Number(body.subtotal)
    } else if (itemUpdates.length > 0) {
      const { data: currentItems } = await supabase
        .from('supplier_invoice_items')
        .select('id, amount')
        .eq('invoice_id', id)
      const amountById = new Map(itemUpdates.map(it => [it.id, it.amount]))
      subtotal = (currentItems ?? []).reduce((sum, row) => {
        const amt = amountById.has(row.id) ? amountById.get(row.id)! : Number(row.amount)
        return sum + amt
      }, 0)
      subtotal = Math.round(subtotal * 100) / 100
    }

    const vatRate = 'vat_rate' in body ? Number(body.vat_rate) : Number(existing.vat_rate)
    const discountAmt = 'discount_amount' in body
      ? Math.round(Number(body.discount_amount) * 100) / 100
      : Number(existing.discount_amount ?? 0)
    const isrRate = 'retention_isr_rate' in body
      ? Number(body.retention_isr_rate)
      : Number(existing.retention_isr_rate ?? 0)
    const ivaRetRate = 'retention_iva_rate' in body
      ? Number(body.retention_iva_rate)
      : Number(existing.retention_iva_rate ?? 0)

    const { tax, isrAmt, ivaRetAmt, total } = computeInvoiceTotals({
      subtotal,
      discount: discountAmt,
      vatRate,
      isrRate,
      ivaRetRate,
    })

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

  type InvoiceUpdate = {
      status?: string
      notes?: string | null
      document_url?: string
      xml_url?: string
      due_date?: string
      vat_rate?: number
      subtotal?: number
      discount_amount?: number
      retention_isr_rate?: number
      retention_isr_amount?: number
      retention_iva_rate?: number
      retention_iva_amount?: number
      tax?: number
      total?: number
    }

    const update: InvoiceUpdate = {
      subtotal,
      vat_rate: vatRate,
      discount_amount: discountAmt,
      retention_isr_rate: isrRate,
      retention_isr_amount: isrAmt,
      retention_iva_rate: ivaRetRate,
      retention_iva_amount: ivaRetAmt,
      tax,
      total,
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
      .select()
      .single()

    if (error || !invoice) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })

    if (itemUpdates.length > 0) {
      for (const it of itemUpdates) {
        const amt = Math.round(Number(it.amount) * 100) / 100
        const { error: itemErr } = await supabase
          .from('supplier_invoice_items')
          .update({ amount: amt })
          .eq('id', it.id)
          .eq('invoice_id', id)
        if (itemErr) {
          return NextResponse.json({ error: itemErr.message }, { status: 500 })
        }
      }
    }

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
          const amt = Math.round(Number(it.amount) * 100) / 100
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
