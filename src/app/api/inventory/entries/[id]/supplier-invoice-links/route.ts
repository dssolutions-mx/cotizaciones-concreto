import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canAccessAllInventoryPlants, canCompleteEntryPricingReview } from '@/lib/auth/inventoryRoles'
import { AP_INVOICE_WRITE_ROLES } from '@/lib/ap/apInvoiceRoles'
import { deleteSupplierInvoiceItems } from '@/lib/ap/deleteSupplierInvoiceItems'

function canManageEntryInvoiceLinks(role: string | undefined): boolean {
  if (!role) return false
  const key = role.trim().toUpperCase().replace(/\s+/g, '_')
  return (
    canCompleteEntryPricingReview(role)
    || (AP_INVOICE_WRITE_ROLES as readonly string[]).includes(key)
  )
}

// ── GET /api/inventory/entries/[id]/supplier-invoice-links ───────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: entryId } = await params
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
    if (!profile || !canManageEntryInvoiceLinks(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    let entryQuery = supabase.from('material_entries').select('id, plant_id, entry_number').eq('id', entryId)
    if (!canAccessAllInventoryPlants(profile.role)) {
      if (!profile.plant_id) {
        return NextResponse.json({ error: 'Usuario sin planta' }, { status: 403 })
      }
      entryQuery = entryQuery.eq('plant_id', profile.plant_id)
    }
    const { data: entry, error: entryErr } = await entryQuery.maybeSingle()
    if (entryErr || !entry) {
      return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
    }

    const { data: links, error: linkErr } = await supabase
      .from('supplier_invoice_items')
      .select(`
        id, cost_category, amount, line_source,
        invoice:supplier_invoices!invoice_id(
          id, invoice_number, invoice_date, status, total, plant_id,
          supplier_group:supplier_groups!supplier_group_id(id, name)
        )
      `)
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true })

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    return NextResponse.json({ entry_id: entryId, entry_number: entry.entry_number, links: links ?? [] })
  } catch (err) {
    console.error('GET supplier-invoice-links error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/inventory/entries/[id]/supplier-invoice-links?item_id= ───────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: entryId } = await params
    const itemId = request.nextUrl.searchParams.get('item_id')
    const costCategory = request.nextUrl.searchParams.get('cost_category')

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
    if (!profile || !canManageEntryInvoiceLinks(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    let entryQuery = supabase.from('material_entries').select('id, plant_id, entry_number').eq('id', entryId)
    if (!canAccessAllInventoryPlants(profile.role)) {
      if (!profile.plant_id) {
        return NextResponse.json({ error: 'Usuario sin planta' }, { status: 403 })
      }
      entryQuery = entryQuery.eq('plant_id', profile.plant_id)
    }
    const { data: entry, error: entryErr } = await entryQuery.maybeSingle()
    if (entryErr || !entry) {
      return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
    }

    let itemIds: string[] = []
    if (itemId) {
      itemIds = [itemId]
    } else if (costCategory === 'material' || costCategory === 'fleet') {
      const { data: rows, error: rowsErr } = await supabase
        .from('supplier_invoice_items')
        .select('id')
        .eq('entry_id', entryId)
        .eq('cost_category', costCategory)
      if (rowsErr) {
        return NextResponse.json({ error: rowsErr.message }, { status: 500 })
      }
      itemIds = (rows ?? []).map(r => r.id as string)
    } else {
      return NextResponse.json(
        { error: 'Indique item_id o cost_category (material|fleet)' },
        { status: 400 },
      )
    }

    if (itemIds.length === 0) {
      return NextResponse.json({ error: 'No hay factura vinculada para quitar' }, { status: 404 })
    }

    const { data: items, error: itemsErr } = await supabase
      .from('supplier_invoice_items')
      .select('id, invoice_id')
      .in('id', itemIds)
      .eq('entry_id', entryId)

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: 'Línea de factura no encontrada para esta entrada' }, { status: 404 })
    }

    const byInvoice = new Map<string, string[]>()
    for (const row of items) {
      const invId = row.invoice_id as string
      const list = byInvoice.get(invId) ?? []
      list.push(row.id as string)
      byInvoice.set(invId, list)
    }

    const results: Array<{
      invoice_id: string
      deleted_item_ids: string[]
      invoice_deleted: boolean
    }> = []

    for (const [invoiceId, ids] of byInvoice) {
      const delResult = await deleteSupplierInvoiceItems(supabase, invoiceId, ids)
      if (!delResult.ok) {
        return NextResponse.json({ error: delResult.error }, { status: delResult.status })
      }
      results.push({
        invoice_id: invoiceId,
        deleted_item_ids: delResult.deletedItemIds,
        invoice_deleted: delResult.invoiceDeleted,
      })
    }

    return NextResponse.json({
      success: true,
      entry_id: entryId,
      results,
    })
  } catch (err) {
    console.error('DELETE supplier-invoice-links error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
