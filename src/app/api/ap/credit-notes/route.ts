import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createCreditNote } from '@/lib/ap/createCreditNote'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']
const WRITE_ROLES   = ['EXECUTIVE', 'ADMIN_OPERATIONS']

// ── GET /api/ap/credit-notes?supplier_group_id=…&plant_id=… ──────────────────
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
    const supplier_group_id = searchParams.get('supplier_group_id')
    const plant_id          = searchParams.get('plant_id')
    const status            = searchParams.get('status') || undefined
    const limit             = Math.min(parseInt(searchParams.get('limit') || '300', 10), 500)

    let query = supabase
      .from('invoice_credit_notes')
      .select(`
        id, supplier_group_id, plant_id,
        credit_number, credit_date, reason,
        amount, tax_amount, total, vat_rate, status,
        notes, applied_by, created_at,
        document_url, xml_url,
        cfdi_uuid, cfdi_serie, cfdi_folio, cfdi_tipo_comprobante,
        cfdi_emisor_rfc, cfdi_relacionado_uuid, cfdi_capture_mode,
        cfdi_estado_sat, cfdi_estado_checked_at,
        supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
        invoice_allocations:credit_note_invoice_allocations(
          id, invoice_id, allocated_subtotal, allocated_tax, allocated_total,
          invoice:supplier_invoices!invoice_id(
            id, invoice_number, subtotal, total, status
          ),
          item_allocations:invoice_credit_note_allocations(
            id, invoice_item_id, allocated_amount,
            invoice_item:supplier_invoice_items!invoice_item_id(
              id, description, cost_category, entry_id,
              entry:material_entries!entry_id(id, entry_number)
            )
          )
        )
      `)
      .order('credit_date', { ascending: false })
      .limit(limit)

    if (supplier_group_id) query = query.eq('supplier_group_id', supplier_group_id)
    if (plant_id)          query = query.eq('plant_id', plant_id)
    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.neq('status', 'void')
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const enriched = (data ?? []).map((cn: {
      total: number
      invoice_allocations?: Array<{ allocated_total?: number | null }>
    }) => {
      const allocs = cn.invoice_allocations ?? []
      const allocated_total = allocs.reduce(
        (s, a) => s + Number(a.allocated_total ?? 0),
        0,
      )
      return {
        ...cn,
        allocated_total,
        unapplied_total: Math.max(0, Number(cn.total) - allocated_total),
      }
    })

    return NextResponse.json({ credit_notes: enriched })
  } catch (err) {
    console.error('GET /api/ap/credit-notes error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST /api/ap/credit-notes ─────────────────────────────────────────────────
// Body:
// {
//   supplier_group_id, plant_id,
//   credit_number?, credit_date, reason, notes?,
//   amount,       // total CN subtotal across all invoices
//   vat_rate?,    // defaults to 0.16
//   invoice_allocations: [
//     {
//       invoice_id,
//       allocated_subtotal,
//       item_allocations?: [{ invoice_item_id, allocated_amount }]
//     }
//   ]
// }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json() as Parameters<typeof createCreditNote>[2]
    const result = await createCreditNote(supabase, user.id, body)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ credit_note: result.credit_note }, { status: 201 })
  } catch (err) {
    console.error('POST /api/ap/credit-notes error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
