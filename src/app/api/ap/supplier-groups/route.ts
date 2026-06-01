import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeRfc } from '@/lib/ap/supplierGroupMaintenance'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// GET — list active supplier groups, optionally filtered by plant_id
// (returns groups that have at least one supplier associated with the given plant)
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

    let groups: any[] = []

    if (plant_id) {
      // Groups that have a supplier linked to this plant
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('group_id, id, name, default_vat_rate, default_payment_terms_days')
        .eq('plant_id', plant_id)
        .eq('is_active', true)
        .not('group_id', 'is', null)

      if (suppliers && suppliers.length > 0) {
        const groupIds = [...new Set(suppliers.map((s: any) => s.group_id))]
        const { data: groupRows } = await supabase
          .from('supplier_groups')
          .select('id, name, rfc, is_active')
          .in('id', groupIds)
          .eq('is_active', true)
          .order('name')

        groups = (groupRows ?? []).map((g: any) => ({
          ...g,
          // Attach the matching plant supplier for VAT default + terms
          plant_supplier: suppliers.find((s: any) => s.group_id === g.id) ?? null,
        }))
      }
    } else {
      const { data: groupRows } = await supabase
        .from('supplier_groups')
        .select('id, name, rfc, is_active')
        .eq('is_active', true)
        .order('name')
      groups = groupRows ?? []
    }

    return NextResponse.json({ groups })
  } catch (err) {
    console.error('/api/ap/supplier-groups GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — create a new supplier group
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, rfc } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const trimmedName = name.trim()
    const normalizedRfc = normalizeRfc(rfc)

    if (normalizedRfc) {
      const { data: existingByRfc } = await supabase
        .from('supplier_groups')
        .select('id, name, rfc, is_active')
        .eq('rfc', normalizedRfc)
        .eq('is_active', true)
        .maybeSingle()

      if (existingByRfc) {
        return NextResponse.json(
          { group: existingByRfc, reused: true, message: 'Ya existe un grupo con este RFC' },
          { status: 200 },
        )
      }
    }

    const { data: group, error } = await supabase
      .from('supplier_groups')
      .insert({ name: trimmedName, rfc: normalizedRfc })
      .select()
      .single()

    if (error || !group) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })

    return NextResponse.json({ group, reused: false }, { status: 201 })
  } catch (err) {
    console.error('/api/ap/supplier-groups POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
