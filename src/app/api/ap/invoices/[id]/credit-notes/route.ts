import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// ── GET /api/ap/invoices/[id]/credit-notes ───────────────────────────────────
// Returns CN allocations that touch this invoice, joined to the CN header.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: allocations, error } = await supabase
      .from('credit_note_invoice_allocations')
      .select(`
        id, credit_note_id, invoice_id,
        allocated_subtotal, allocated_tax, allocated_total,
        created_at,
        credit_note:invoice_credit_notes(
          id, credit_number, credit_date, reason, amount, tax_amount, total,
          vat_rate, status, notes, applied_by
        ),
        item_allocations:invoice_credit_note_allocations(
          id, invoice_item_id, allocated_amount
        )
      `)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ credit_notes: allocations ?? [] })
  } catch (err) {
    console.error('GET credit-notes error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST /api/ap/invoices/[id]/credit-notes — MOVED ─────────────────────────
// Use POST /api/ap/credit-notes instead (supports multi-invoice allocation).
export async function POST() {
  return NextResponse.json(
    { error: 'Este endpoint fue reemplazado. Usa POST /api/ap/credit-notes' },
    { status: 410 }
  )
}
