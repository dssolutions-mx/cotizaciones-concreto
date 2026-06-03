import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClientForApi } from '@/lib/supabase/api'
import { hasInventoryStandardAccess } from '@/lib/auth/inventoryRoles'
import { previewCombinationCost } from '@/lib/inventory/previewCombinationCost'

const BodySchema = z.object({
  plant_id: z.string().uuid(),
  combination_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  output_quantity_kg: z.number().nonnegative(),
  inputs: z
    .array(
      z.object({
        material_id: z.string().uuid(),
        quantity_kg: z.number().nonnegative(),
      }),
    )
    .min(1),
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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile || !hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const data = BodySchema.parse(await request.json())

    const admin = createAdminClientForApi()
    const result = await previewCombinationCost(admin, {
      plantId: data.plant_id,
      consumptionDate: data.combination_date,
      inputs: data.inputs,
      outputQuantityKg: data.output_quantity_kg,
    })

    return NextResponse.json({ success: true, data: result })
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
