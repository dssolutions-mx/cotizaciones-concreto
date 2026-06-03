import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClientForApi } from '@/lib/supabase/api'
import { hasInventoryStandardAccess } from '@/lib/auth/inventoryRoles'
import { createMaterialCombination } from '@/lib/inventory/createMaterialCombination'

const InputSpecSchema = z.object({
  material_id: z.string().uuid(),
  quantity_kg: z.number().positive(),
})

const BodySchema = z.object({
  plant_id: z.string().uuid(),
  combination_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  output_material_id: z.string().uuid(),
  output_quantity_kg: z.number().positive(),
  inputs: z.array(InputSpecSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 })
    }

    if (!hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 })
    }

    const body = await request.json()
    const data = BodySchema.parse(body)

    // Plant-scoped users can only combine in their own plant
    if (profile.plant_id && profile.plant_id !== data.plant_id) {
      const isGlobal = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'ADMINISTRATIVE', 'ADMIN'].includes(
        profile.role?.toUpperCase() ?? '',
      )
      if (!isGlobal) {
        return NextResponse.json({ error: 'Sin permisos para esta planta' }, { status: 403 })
      }
    }

    // Validate output material belongs to plant
    const admin = createAdminClientForApi()
    const { data: outMat, error: outMatErr } = await admin
      .from('materials')
      .select('id, plant_id, material_name')
      .eq('id', data.output_material_id)
      .single()

    if (outMatErr || !outMat) {
      return NextResponse.json({ error: 'Material de salida no encontrado' }, { status: 400 })
    }
    if (outMat.plant_id !== data.plant_id) {
      return NextResponse.json(
        { error: 'El material de salida no pertenece a la planta seleccionada' },
        { status: 400 },
      )
    }

    // Validate all input materials belong to the same plant
    const inputMaterialIds = data.inputs.map((i) => i.material_id)
    const { data: inMaterials, error: inMatErr } = await admin
      .from('materials')
      .select('id, plant_id, material_name')
      .in('id', inputMaterialIds)

    if (inMatErr || !inMaterials || inMaterials.length !== inputMaterialIds.length) {
      return NextResponse.json({ error: 'Uno o más materiales de entrada no encontrados' }, { status: 400 })
    }
    for (const m of inMaterials) {
      if (m.plant_id !== data.plant_id) {
        return NextResponse.json(
          { error: `El material "${m.material_name}" no pertenece a la planta seleccionada` },
          { status: 400 },
        )
      }
    }

    // Output material must differ from all inputs
    if (inputMaterialIds.includes(data.output_material_id)) {
      return NextResponse.json(
        { error: 'El material de salida debe ser distinto a los materiales de entrada' },
        { status: 400 },
      )
    }

    const result = await createMaterialCombination(admin, {
      plant_id: data.plant_id,
      combination_date: data.combination_date,
      output_material_id: data.output_material_id,
      output_quantity_kg: data.output_quantity_kg,
      inputs: data.inputs,
      notes: data.notes ?? null,
      user_id: user.id,
    })

    if (!result.ok) {
      // Find material name for better INSUFFICIENT_INVENTORY messages
      let errMsg = result.error
      if (result.code === 'INSUFFICIENT_INVENTORY' && result.insufficient_material_id) {
        const mat = inMaterials.find((m) => m.id === result.insufficient_material_id)
        if (mat) {
          errMsg = `Inventario FIFO insuficiente para "${mat.material_name}". ${result.error}`
        }
      }
      return NextResponse.json({ success: false, error: errMsg, code: result.code }, { status: 422 })
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: e.flatten() },
        { status: 400 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile || !hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const admin = createAdminClientForApi()
    let query = admin
      .from('material_combinations')
      .select(`
        *,
        output_material:output_material_id (material_name, unit_of_measure),
        inputs:material_combination_inputs (
          id, material_id, quantity_kg, total_cost, source_adjustment_id,
          material:material_id (material_name, unit_of_measure)
        )
      `)
      .order('combination_date', { ascending: false })
      .order('combination_time', { ascending: false })
      .range(offset, offset + limit - 1)

    const effectivePlantId = plantId ?? profile.plant_id
    if (effectivePlantId) query = query.eq('plant_id', effectivePlantId)
    if (dateFrom) query = query.gte('combination_date', dateFrom)
    if (dateTo) query = query.lte('combination_date', dateTo)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
