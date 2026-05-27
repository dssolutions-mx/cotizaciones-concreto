import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSupplierInvoice } from '@/lib/ap/createSupplierInvoice'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// ── GET /api/ap/invoices ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const plant_id = searchParams.get('plant_id') || undefined
    const supplier_group_id = searchParams.get('supplier_group_id') || undefined
    const status = searchParams.get('status') || undefined
    const include_paid = searchParams.get('include_paid') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('supplier_invoices')
      .select(`
        id, supplier_group_id, plant_id,
        invoice_number, is_internal, invoice_date, due_date,
        currency, vat_rate, subtotal, discount_amount, tax, total,
        retention_isr_rate, retention_isr_amount, retention_iva_rate, retention_iva_amount,
        status, source, document_url, xml_url, notes,
        cfdi_uuid, cfdi_serie, cfdi_folio, cfdi_forma_pago, cfdi_metodo_pago, cfdi_uso,
        cfdi_tipo_comprobante, cfdi_fecha_emision, cfdi_fecha_timbrado,
        cfdi_emisor_rfc, cfdi_receptor_rfc, cfdi_estado_sat, cfdi_estado_checked_at,
        cfdi_capture_mode,
        created_by, created_at,
        supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
        retentions:supplier_invoice_retentions(
          id, impuesto_sat, label, base_amount, rate, amount, sort_order
        ),
        items:supplier_invoice_items(
          id, entry_id, line_source, manual_reason, cost_category, description, qty, unit_price, amount,
          entry:material_entries!entry_id(
            id, entry_number, entry_date, received_qty_entered, received_uom,
            unit_price, landed_unit_price, supplier_invoice
          )
        ),
        payable:payables!invoice_id(
          id, status, subtotal, tax, total,
          payments:payments!payable_id(id, payment_date, amount, method, reference)
        ),
        cn_allocations:credit_note_invoice_allocations(
          id, credit_note_id, allocated_subtotal, allocated_tax, allocated_total
        )
      `, { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (plant_id) query = query.eq('plant_id', plant_id)
    if (supplier_group_id) query = query.eq('supplier_group_id', supplier_group_id)
    if (status) {
      query = query.eq('status', status)
    } else if (!include_paid) {
      query = query.in('status', ['open', 'partially_paid'])
    }

    const { data: invoices, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Compute paid_to_date, credit applied, and balance per invoice
    const enriched = (invoices ?? []).map((inv: any) => {
      const payable = Array.isArray(inv.payable) ? inv.payable[0] : inv.payable
      const payments: any[] = payable?.payments ?? []
      const paid_to_date = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
      const cnAllocs: any[] = inv.cn_allocations ?? []
      const credit_applied_subtotal = cnAllocs.reduce((s: number, a: any) => s + Number(a.allocated_subtotal ?? 0), 0)
      const credit_applied_total = cnAllocs.reduce((s: number, a: any) => s + Number(a.allocated_total ?? 0), 0)
      const taxable_base = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
      return {
        ...inv,
        taxable_base,
        payable: payable ?? null,
        paid_to_date,
        credit_applied_subtotal,
        credit_applied_total,
        balance: Number(inv.total) - paid_to_date - credit_applied_total,
        cn_allocations: undefined,
      }
    })

    return NextResponse.json({
      invoices: enriched,
      pagination: { total: count ?? 0, limit, offset, hasMore: (count ?? 0) > offset + limit },
    })
  } catch (err) {
    console.error('/api/ap/invoices GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST /api/ap/invoices ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const result = await createSupplierInvoice(supabase, user.id, body)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(
      { invoice: result.invoice, warnings: result.warnings.length > 0 ? result.warnings : undefined },
      { status: 201 },
    )
  } catch (err) {
    console.error('/api/ap/invoices POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
