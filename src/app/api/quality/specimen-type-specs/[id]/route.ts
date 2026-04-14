import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const NO_STORE = { 'Cache-Control': 'no-store' as const }
const WRITE_ROLES = ['EXECUTIVE', 'ADMIN']

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_STORE })
    }

    const authClient = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
    }

    const { data: profile, error: profileError } = await authClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !WRITE_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const body = await request.json()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.correction_factor !== undefined) {
      const cf = Number(body.correction_factor)
      if (!Number.isFinite(cf) || cf <= 0 || cf > 2) {
        return NextResponse.json({ error: 'Invalid correction_factor' }, { status: 400 })
      }
      patch.correction_factor = cf
    }
    if (body.dimension_label !== undefined) {
      patch.dimension_label = String(body.dimension_label).trim() || undefined
    }
    if (body.description !== undefined) {
      patch.description = body.description === null ? null : String(body.description)
    }
    if (body.is_default !== undefined) {
      patch.is_default = Boolean(body.is_default)
    }

    const admin = createAdminClientForApi()

    if (patch.is_default === true) {
      const { data: row } = await admin.from('specimen_type_specs').select('tipo_muestra').eq('id', id).single()
      if (row?.tipo_muestra) {
        await admin
          .from('specimen_type_specs')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('tipo_muestra', row.tipo_muestra)
          .neq('id', id)
      }
    }

    const { data: updated, error } = await admin
      .from('specimen_type_specs')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[specimen-type-specs PATCH]', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ spec: updated }, { headers: NO_STORE })
  } catch (e) {
    console.error('[specimen-type-specs PATCH]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
