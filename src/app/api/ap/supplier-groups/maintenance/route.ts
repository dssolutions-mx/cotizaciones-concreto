import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  loadEnrichedSupplierGroups,
  loadMaintenancePreview,
  runSupplierGroupMaintenance,
} from '@/lib/ap/supplierGroupMaintenance'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

async function assertRole(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }
  return { supabase }
}

/** GET — preview duplicates, missing RFC, and empty groups */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const auth = await assertRole(supabase)
    if ('error' in auth) return auth.error

    const preview = await loadMaintenancePreview(auth.supabase)
    return NextResponse.json(preview)
  } catch (err) {
    console.error('/api/ap/supplier-groups/maintenance GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** POST — merge duplicates, backfill RFC from invoices, deactivate empty groups */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const auth = await assertRole(supabase)
    if ('error' in auth) return auth.error

    const body = await request.json().catch(() => ({}))
    const result = await runSupplierGroupMaintenance(auth.supabase, {
      merge_duplicates: body.merge_duplicates !== false,
      backfill_rfc: body.backfill_rfc !== false,
      deactivate_empty: body.deactivate_empty !== false,
    })

    const preview = await loadMaintenancePreview(auth.supabase)

    return NextResponse.json({ result, preview })
  } catch (err) {
    console.error('/api/ap/supplier-groups/maintenance POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
