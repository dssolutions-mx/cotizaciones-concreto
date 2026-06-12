import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteCreditNote, updateCreditNoteAllocations } from '@/lib/ap/voidCreditNote'
import type { CreditNoteInvoiceAllocationInput } from '@/lib/ap/creditNoteAllocationTypes'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']
const WRITE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('invoice_credit_notes')
      .select(`
        id, supplier_group_id, plant_id,
        credit_number, credit_date, reason, amount, status,
        invoice_allocations:credit_note_invoice_allocations(
          id, invoice_id, allocated_subtotal,
          invoice:supplier_invoices!invoice_id(id, invoice_number, status),
          item_allocations:invoice_credit_note_allocations(
            invoice_item_id, allocated_amount
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Nota de crédito no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ credit_note: data })
  } catch (err) {
    console.error('GET /api/ap/credit-notes/[id] error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const invoice_allocations = body?.invoice_allocations as CreditNoteInvoiceAllocationInput[] | undefined
    if (!Array.isArray(invoice_allocations) || invoice_allocations.length === 0) {
      return NextResponse.json({ error: 'invoice_allocations es requerido' }, { status: 400 })
    }

    const result = await updateCreditNoteAllocations(supabase, id, invoice_allocations)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ credit_note: result.credit_note })
  } catch (err) {
    console.error('PATCH /api/ap/credit-notes/[id] error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const result = await deleteCreditNote(supabase, id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/ap/credit-notes/[id] error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
