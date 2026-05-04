import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canAccessAllInventoryPlants, canCompleteEntryPricingReview } from '@/lib/auth/inventoryRoles'

/**
 * Re-derive material line amount (MXN) from unit_price and received quantities (same as PUT payables).
 */
function computeMaterialAmountFromEntryRow(result: Record<string, unknown>): number {
  if (result.total_cost != null && result.total_cost !== '') {
    return Number(result.total_cost)
  }
  const up = Number(result.unit_price || 0)
  if (result.received_uom === 'm3') {
    const kg = Number(result.received_qty_kg ?? result.quantity_received ?? 0)
    return up * kg
  }
  const nativeQty = result.received_qty_entered ?? result.quantity_received ?? 0
  return up * Number(nativeQty)
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entryId } = await context.params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }
    if (!canCompleteEntryPricingReview(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para resincronizar contabilidad' }, { status: 403 })
    }

    let entryQuery = supabase.from('material_entries').select('*').eq('id', entryId).single()
    if (!canAccessAllInventoryPlants(profile.role)) {
      if (!profile.plant_id) {
        return NextResponse.json({ error: 'Usuario sin planta' }, { status: 403 })
      }
      entryQuery = supabase
        .from('material_entries')
        .select('*')
        .eq('id', entryId)
        .eq('plant_id', profile.plant_id)
        .single()
    }

    const { data: beforeRow, error: loadErr } = await entryQuery
    if (loadErr || !beforeRow) {
      return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
    }

    const merged = { ...beforeRow } as Record<string, unknown>
    const newTotal = computeMaterialAmountFromEntryRow(merged)

    const { data: updated, error: updErr } = await supabase
      .from('material_entries')
      .update({
        total_cost: Number(newTotal.toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .select()
      .single()

    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message ?? 'No se pudo actualizar' }, { status: 500 })
    }

    const result = updated as Record<string, unknown>
    let threeWayWarnings: string[] = []

    try {
      let vatRate = 0.16
      const { data: plantRow } = await supabase
        .from('plants')
        .select('id, business_unit_id')
        .eq('id', result.plant_id as string)
        .single()
      if (plantRow?.business_unit_id) {
        const { data: buRow } = await supabase
          .from('business_units')
          .select('iva_rate')
          .eq('id', plantRow.business_unit_id)
          .single()
        if (buRow?.iva_rate != null) {
          vatRate = buRow.iva_rate as unknown as number
        }
      }
      if (result.supplier_id) {
        const { data: agreementVat } = await supabase
          .from('supplier_agreements')
          .select('vat_rate')
          .eq('supplier_id', result.supplier_id as string)
          .eq('is_service', false)
          .eq('material_id', result.material_id as string)
          .is('effective_to', null)
          .limit(1)
          .maybeSingle()
        if (agreementVat?.vat_rate != null) {
          vatRate = Number(agreementVat.vat_rate)
        }
      }

      const upsertPayable = async (
        supplierId: string,
        plantId: string,
        invoiceNumber: string,
        dueDate?: string,
        entryIdInner?: string
      ) => {
        const payload: Record<string, unknown> = {
          supplier_id: supplierId,
          plant_id: plantId,
          invoice_number: invoiceNumber,
          vat_rate: vatRate,
          currency: 'MXN',
        }
        if (dueDate) payload.due_date = dueDate
        if (entryIdInner) payload.entry_id = entryIdInner

        const { data: payableRows, error: payableErr } = await supabase
          .from('payables')
          .upsert(payload, { onConflict: 'supplier_id,plant_id,invoice_number' })
          .select()
        if (payableErr) throw new Error(`CXP: ${payableErr.message}`)
        const payable = Array.isArray(payableRows) ? payableRows[0] : payableRows
        return payable.id as string
      }

      const amountMaterial = computeMaterialAmountFromEntryRow(result)

      if (result.supplier_id && result.supplier_invoice && amountMaterial > 0) {
        const materialPayableId = await upsertPayable(
          result.supplier_id as string,
          result.plant_id as string,
          result.supplier_invoice as string,
          result.ap_due_date_material as string | undefined,
          result.id as string
        )
        const materialItemPayload: Record<string, unknown> = {
          payable_id: materialPayableId,
          entry_id: result.id,
          amount: amountMaterial,
          cost_category: 'material',
        }
        if (result.po_item_id) materialItemPayload.po_item_id = result.po_item_id
        const { error: itemErr } = await supabase
          .from('payable_items')
          .upsert(materialItemPayload, { onConflict: 'entry_id,cost_category' })
        if (itemErr) throw new Error(itemErr.message)
      }

      if (
        result.fleet_supplier_id &&
        result.fleet_cost &&
        Number(result.fleet_cost) > 0 &&
        result.fleet_invoice
      ) {
        const fleetPayableId = await upsertPayable(
          result.fleet_supplier_id as string,
          result.plant_id as string,
          result.fleet_invoice as string,
          result.ap_due_date_fleet as string | undefined,
          result.id as string
        )
        const { error: fleetItemErr } = await supabase.from('payable_items').upsert(
          {
            payable_id: fleetPayableId,
            entry_id: result.id,
            amount: result.fleet_cost,
            cost_category: 'fleet',
          },
          { onConflict: 'entry_id,cost_category' }
        )
        if (fleetItemErr) throw new Error(fleetItemErr.message)
      }

      for (const pid of []) {
        void pid
      }
    } catch (apErr) {
      console.error('resync-accounting AP:', apErr)
      return NextResponse.json(
        {
          success: false,
          error: apErr instanceof Error ? apErr.message : 'Error al sincronizar CXP',
        },
        { status: 500 }
      )
    }

    const totalCostBefore =
      beforeRow.total_cost != null ? Number(beforeRow.total_cost) : null
    const totalCostAfter = result.total_cost != null ? Number(result.total_cost) : null

    return NextResponse.json({
      success: true,
      data: updated,
      summary: {
        total_cost_before: totalCostBefore,
        total_cost_after: totalCostAfter,
      },
      warnings: threeWayWarnings.length ? threeWayWarnings : undefined,
    })
  } catch (e) {
    console.error('POST resync-accounting', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    )
  }
}
