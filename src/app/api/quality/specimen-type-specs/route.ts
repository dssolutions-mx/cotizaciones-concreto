import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const NO_STORE = { 'Cache-Control': 'no-store' as const }

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN', 'ADMIN_OPERATIONS']
const WRITE_ROLES = ['EXECUTIVE', 'ADMIN']

export async function GET() {
  try {
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

    if (profileError || !profile || !READ_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const admin = createAdminClientForApi()
    const { data, error } = await admin
      .from('specimen_type_specs')
      .select('*')
      .order('tipo_muestra', { ascending: true })
      .order('dimension_key', { ascending: true })

    if (error) {
      console.error('[specimen-type-specs GET]', error)
      return NextResponse.json({ error: 'Error al listar especificaciones' }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ specs: data ?? [] }, { headers: NO_STORE })
  } catch (e) {
    console.error('[specimen-type-specs GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const tipo_muestra = String(body.tipo_muestra || '').toUpperCase()
    const dimension_key = String(body.dimension_key || '').trim()
    const dimension_label = String(body.dimension_label || '').trim()
    const correction_factor = Number(body.correction_factor)
    const is_default = Boolean(body.is_default)
    const description = body.description != null ? String(body.description) : null

    if (!['CILINDRO', 'VIGA', 'CUBO'].includes(tipo_muestra) || !dimension_key || !dimension_label) {
      return NextResponse.json({ error: 'Invalid tipo_muestra, dimension_key or dimension_label' }, { status: 400 })
    }
    if (!Number.isFinite(correction_factor) || correction_factor <= 0 || correction_factor > 2) {
      return NextResponse.json({ error: 'correction_factor must be between 0 and 2' }, { status: 400 })
    }

    const admin = createAdminClientForApi()
    const { data: created, error } = await admin
      .from('specimen_type_specs')
      .insert({
        tipo_muestra,
        dimension_key,
        dimension_label,
        correction_factor,
        is_default,
        description,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[specimen-type-specs POST]', error)
      return NextResponse.json(
        { error: error.code === '23505' ? 'Ya existe esta combinación tipo/dimensión' : 'Error al crear' },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ spec: created }, { headers: NO_STORE })
  } catch (e) {
    console.error('[specimen-type-specs POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
