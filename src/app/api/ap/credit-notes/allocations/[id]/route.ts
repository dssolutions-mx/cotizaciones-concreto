import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { removeCreditNoteInvoiceAllocation } from '@/lib/ap/voidCreditNote'

const WRITE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

export async function DELETE(
  _request: NextRequest,
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

    const result = await removeCreditNoteInvoiceAllocation(supabase, id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/ap/credit-notes/allocations/[id] error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
