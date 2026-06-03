import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClientForApi } from '@/lib/supabase/api'
import { hasInventoryStandardAccess } from '@/lib/auth/inventoryRoles'
import { reverseMaterialCombination } from '@/lib/inventory/reverseMaterialCombination'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile || !hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClientForApi()
    const result = await reverseMaterialCombination(admin, params.id)

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 422 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
