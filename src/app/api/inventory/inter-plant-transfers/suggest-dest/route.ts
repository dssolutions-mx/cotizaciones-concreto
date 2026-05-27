import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hasInventoryStandardAccess } from '@/lib/auth/inventoryRoles'
import { suggestDestMaterial, type MaterialMatchRow } from '@/lib/inventory/interPlantMaterialMatch'

const QuerySchema = z.object({
  source_material_id: z.string().uuid(),
  to_plant_id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile, error: pe } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (pe || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }
    if (!hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { source_material_id, to_plant_id } = parsed.data

    const { data: source, error: srcErr } = await supabase
      .from('materials')
      .select('id, material_code, material_name, accounting_code, plant_id')
      .eq('id', source_material_id)
      .single()
    if (srcErr || !source) {
      return NextResponse.json({ error: 'Material de origen no encontrado' }, { status: 404 })
    }

    const { data: destRows, error: destErr } = await supabase
      .from('materials')
      .select('id, material_code, material_name, accounting_code, plant_id, is_active')
      .eq('plant_id', to_plant_id)
      .eq('is_active', true)
    if (destErr) {
      return NextResponse.json({ error: destErr.message }, { status: 400 })
    }

    const result = suggestDestMaterial(source as MaterialMatchRow, (destRows || []) as MaterialMatchRow[])

    return NextResponse.json({
      source: {
        id: source.id,
        material_code: source.material_code,
        material_name: source.material_name,
        accounting_code: source.accounting_code,
      },
      suggested_id: result.suggestedId,
      match_reason: result.matchReason,
      candidates: result.candidates.map((c) => ({
        id: c.id,
        material_code: c.material_code,
        material_name: c.material_name,
        accounting_code: c.accounting_code,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
