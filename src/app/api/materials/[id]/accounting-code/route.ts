import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canWriteMaterialsCatalog } from '@/lib/auth/materialsCatalogRoles'
import { canCompleteEntryPricingReview } from '@/lib/auth/inventoryRoles'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * PATCH /api/materials/[id]/accounting-code
 * Solo actualiza accounting_code (contabilidad / compras).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const canEdit =
      canWriteMaterialsCatalog(profile.role) || canCompleteEntryPricingReview(profile.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    if (!('accounting_code' in body)) {
      return NextResponse.json({ error: 'accounting_code requerido' }, { status: 400 })
    }

    const raw = body.accounting_code
    if (raw != null && typeof raw !== 'string') {
      return NextResponse.json({ error: 'accounting_code debe ser texto' }, { status: 400 })
    }

    const accounting_code =
      raw == null || String(raw).trim() === '' ? null : String(raw).trim().slice(0, 128)

    const { data: material, error } = await supabase
      .from('materials')
      .update({ accounting_code, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('PATCH material accounting_code:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true, material })
  } catch (e) {
    console.error('PATCH /api/materials/[id]/accounting-code', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
