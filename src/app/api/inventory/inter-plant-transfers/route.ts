import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendInterPlantTransferEmail } from '@/lib/inventory/notifyInterPlantTransferEmail'
import { hasInventoryStandardAccess } from '@/lib/auth/inventoryRoles'

const BodySchema = z.object({
  from_plant_id: z.string().uuid(),
  to_plant_id: z.string().uuid(),
  material_id: z.string().uuid(),
  quantity_kg: z.number().positive(),
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

    const { data: profile, error: pe } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single()
    if (pe || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (!hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = BodySchema.parse(body)

    if (data.from_plant_id === data.to_plant_id) {
      return NextResponse.json({ error: 'Planta origen y destino deben ser distintas' }, { status: 400 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('create_inter_plant_material_transfer', {
      p_from_plant_id: data.from_plant_id,
      p_to_plant_id: data.to_plant_id,
      p_material_id: data.material_id,
      p_quantity_kg: data.quantity_kg,
      p_transfer_date: data.transfer_date,
      p_notes: data.notes ?? null,
      p_user_id: user.id,
    })

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message || 'Error al registrar transferencia' },
        { status: 400 }
      )
    }

    const j = (result as { transfer_id?: string }) || {}
    const transferId = j.transfer_id
    if (transferId) {
      const { data: row } = await supabase
        .from('inter_plant_material_transfers')
        .select('from_plant_id, to_plant_id, material_id, quantity_kg, transfer_date, notes')
        .eq('id', transferId)
        .single()

      if (row) {
        const [fromP, toP, mat] = await Promise.all([
          supabase.from('plants').select('name').eq('id', row.from_plant_id).single(),
          supabase.from('plants').select('name').eq('id', row.to_plant_id).single(),
          supabase.from('materials').select('material_name').eq('id', row.material_id).single(),
        ])

        const fromName = fromP.data?.name ?? 'Origen'
        const toName = toP.data?.name ?? 'Destino'
        const matName = mat.data?.material_name ?? 'Material'

        try {
          await sendInterPlantTransferEmail({
            transferId: String(transferId),
            fromPlantName: fromName,
            toPlantName: toName,
            materialName: matName,
            quantityKg: Number(row.quantity_kg),
            transferDate: row.transfer_date,
            notes: row.notes ?? data.notes,
          })
        } catch (e) {
          console.error('[inter-plant-transfer] email failed', e)
          // Non-fatal: transfer already committed
        }
      }
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos', details: e.flatten() }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
