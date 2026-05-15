import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

// ── PATCH /api/ap/invoices/[id] — update status or metadata ─────────────────
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

    const body = await request.json()
    type InvoiceUpdate = {
      status?: string
      notes?: string
      document_url?: string
      xml_url?: string
      due_date?: string
      discount_amount?: number
      retention_isr_rate?: number
      retention_isr_amount?: number
      retention_iva_rate?: number
      retention_iva_amount?: number
      tax?: number
      total?: number
    }
    const update: InvoiceUpdate = {}
    if ('status' in body) update.status = body.status
    if ('notes' in body) update.notes = body.notes
    if ('document_url' in body) update.document_url = body.document_url
    if ('xml_url' in body) update.xml_url = body.xml_url
    if ('due_date' in body) update.due_date = body.due_date
    if ('discount_amount' in body) update.discount_amount = Number(body.discount_amount)
    if ('retention_isr_rate' in body) update.retention_isr_rate = Number(body.retention_isr_rate)
    if ('retention_isr_amount' in body) update.retention_isr_amount = Number(body.retention_isr_amount)
    if ('retention_iva_rate' in body) update.retention_iva_rate = Number(body.retention_iva_rate)
    if ('retention_iva_amount' in body) update.retention_iva_amount = Number(body.retention_iva_amount)
    if ('tax' in body) update.tax = Number(body.tax)
    if ('total' in body) update.total = Number(body.total)
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Sin campos a actualizar' }, { status: 400 })
    }

    const { data: invoice, error } = await supabase
      .from('supplier_invoices')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error || !invoice) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })

    // Sync status to linked payable if status changed
    if (update.status) {
      await supabase.from('payables').update({ status: update.status }).eq('invoice_id', id)
    }

    return NextResponse.json({ invoice })
  } catch (err) {
    console.error('/api/ap/invoices/[id] PATCH error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
