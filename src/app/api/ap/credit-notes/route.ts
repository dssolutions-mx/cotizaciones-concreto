import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { propagateCreditToEntry, buildProportionalItemAllocations } from '@/lib/ap/creditPropagation'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']
const WRITE_ROLES   = ['EXECUTIVE', 'ADMIN_OPERATIONS']

// ── GET /api/ap/credit-notes?supplier_group_id=…&plant_id=… ──────────────────
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
    const supplier_group_id = searchParams.get('supplier_group_id')
    const plant_id          = searchParams.get('plant_id')

    let query = supabase
      .from('invoice_credit_notes')
      .select(`
        id, supplier_group_id, plant_id,
        credit_number, credit_date, reason,
        amount, tax_amount, total, vat_rate, status,
        notes, applied_by, created_at,
        cfdi_uuid, cfdi_serie, cfdi_folio, cfdi_tipo_comprobante,
        cfdi_emisor_rfc, cfdi_relacionado_uuid, cfdi_capture_mode,
        cfdi_estado_sat, cfdi_estado_checked_at,
        invoice_allocations:credit_note_invoice_allocations(
          id, invoice_id, allocated_subtotal, allocated_tax, allocated_total,
          invoice:supplier_invoices!invoice_id(
            id, invoice_number, subtotal, total, status
          ),
          item_allocations:invoice_credit_note_allocations(
            id, invoice_item_id, allocated_amount
          )
        )
      `)
      .order('credit_date', { ascending: false })

    if (supplier_group_id) query = query.eq('supplier_group_id', supplier_group_id)
    if (plant_id)          query = query.eq('plant_id', plant_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ credit_notes: data ?? [] })
  } catch (err) {
    console.error('GET /api/ap/credit-notes error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST /api/ap/credit-notes ─────────────────────────────────────────────────
// Body:
// {
//   supplier_group_id, plant_id,
//   credit_number?, credit_date, reason, notes?,
//   amount,       // total CN subtotal across all invoices
//   vat_rate?,    // defaults to 0.16
//   invoice_allocations: [
//     {
//       invoice_id,
//       allocated_subtotal,
//       item_allocations?: [{ invoice_item_id, allocated_amount }]
//     }
//   ]
// }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const {
      supplier_group_id,
      plant_id,
      credit_number,
      credit_date,
      reason,
      notes,
      amount,
      vat_rate = 0.16,
      invoice_allocations,
      // CFDI fields (optional)
      cfdi_uuid = null,
      cfdi_serie = null,
      cfdi_folio = null,
      cfdi_forma_pago = null,
      cfdi_metodo_pago = null,
      cfdi_uso = null,
      cfdi_tipo_comprobante = null,
      cfdi_fecha_emision = null,
      cfdi_fecha_timbrado = null,
      cfdi_emisor_rfc = null,
      cfdi_receptor_rfc = null,
      cfdi_relacionado_uuid = null,
      cfdi_capture_mode = 'manual',
    } = body

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!supplier_group_id || !plant_id || !credit_date || !reason || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Campos requeridos: supplier_group_id, plant_id, credit_date, reason, amount' },
        { status: 400 },
      )
    }
    if (!Array.isArray(invoice_allocations) || invoice_allocations.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos una factura en invoice_allocations' },
        { status: 400 },
      )
    }

    // CFDI validations
    if (cfdi_capture_mode === 'cfdi') {
      if (!cfdi_uuid || !cfdi_emisor_rfc) {
        return NextResponse.json(
          { error: 'Modo CFDI requiere cfdi_uuid y cfdi_emisor_rfc' },
          { status: 400 },
        )
      }
      if (cfdi_tipo_comprobante && cfdi_tipo_comprobante !== 'E') {
        return NextResponse.json(
          { error: 'El CFDI debe ser de tipo Egreso (E) para una nota de crédito' },
          { status: 400 },
        )
      }
    }
    if (cfdi_uuid) {
      const { data: dup } = await supabase
        .from('invoice_credit_notes')
        .select('id, credit_number')
        .eq('cfdi_uuid', cfdi_uuid)
        .maybeSingle()
      if (dup) {
        return NextResponse.json(
          { error: `Este CFDI ya está registrado en la NC ${dup.credit_number ?? dup.id}` },
          { status: 409 },
        )
      }
    }

    // Σ allocated_subtotal must equal amount (±0.01)
    const allocSum = invoice_allocations.reduce(
      (s: number, a: any) => s + Number(a.allocated_subtotal ?? 0),
      0,
    )
    if (Math.abs(allocSum - Number(amount)) > 0.01) {
      return NextResponse.json(
        { error: `La suma de asignaciones (${allocSum}) no coincide con el monto del crédito (${amount})` },
        { status: 400 },
      )
    }

    // ── Validate each invoice ─────────────────────────────────────────────────
    const invoiceIds: string[] = invoice_allocations.map((a: any) => a.invoice_id)

    const { data: invoices, error: invErr } = await supabase
      .from('supplier_invoices')
      .select(`
        id, supplier_group_id, subtotal, discount_amount, vat_rate, status,
        items:supplier_invoice_items(id, entry_id, amount, cost_category)
      `)
      .in('id', invoiceIds)

    if (invErr || !invoices || invoices.length !== invoiceIds.length) {
      return NextResponse.json({ error: 'Una o más facturas no encontradas' }, { status: 404 })
    }

    // All invoices must belong to the same supplier group and not be void
    for (const inv of invoices) {
      if ((inv as any).supplier_group_id !== supplier_group_id) {
        return NextResponse.json(
          { error: `Factura ${inv.id} no pertenece al grupo de proveedor indicado` },
          { status: 400 },
        )
      }
      if ((inv as any).status === 'void') {
        return NextResponse.json(
          { error: `Factura ${inv.id} está anulada y no puede recibir notas de crédito` },
          { status: 400 },
        )
      }
    }

    // Per-invoice: existing credits + new allocation must not exceed taxable_base
    const { data: existingInvAllocs } = await supabase
      .from('credit_note_invoice_allocations')
      .select('invoice_id, allocated_subtotal')
      .in('invoice_id', invoiceIds)

    for (const alloc of invoice_allocations) {
      const inv = invoices.find((i: any) => i.id === alloc.invoice_id) as any
      const taxableBase = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
      const alreadyApplied = (existingInvAllocs ?? [])
        .filter((a: any) => a.invoice_id === alloc.invoice_id)
        .reduce((s: number, a: any) => s + Number(a.allocated_subtotal), 0)
      if (alreadyApplied + Number(alloc.allocated_subtotal) > taxableBase + 0.01) {
        return NextResponse.json(
          {
            error: `El crédito para la factura ${inv.invoice_number ?? inv.id} (${alreadyApplied + Number(alloc.allocated_subtotal)}) excede la base gravable (${taxableBase})`,
          },
          { status: 400 },
        )
      }

      // Validate per-item allocations if provided
      if (alloc.item_allocations?.length > 0) {
        const itemSum = alloc.item_allocations.reduce(
          (s: number, a: any) => s + Number(a.allocated_amount ?? 0),
          0,
        )
        if (Math.abs(itemSum - Number(alloc.allocated_subtotal)) > 0.01) {
          return NextResponse.json(
            {
              error: `La suma de asignaciones por línea para la factura ${inv.id} (${itemSum}) no coincide con el monto asignado (${alloc.allocated_subtotal})`,
            },
            { status: 400 },
          )
        }
      }
    }

    // ── Writes ────────────────────────────────────────────────────────────────
    let admin: ReturnType<typeof createServiceClient>
    try { admin = createServiceClient() } catch {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 503 })
    }

    const taxAmount = Math.round(Number(amount) * Number(vat_rate) * 100) / 100

    // 1. Insert credit note
    const { data: creditNote, error: cnErr } = await admin
      .from('invoice_credit_notes')
      .insert({
        supplier_group_id,
        plant_id,
        credit_number: credit_number?.trim() || null,
        credit_date,
        reason,
        amount: Number(amount),
        tax_amount: taxAmount,
        total: Number(amount) + taxAmount,
        vat_rate: Number(vat_rate),
        status: 'open',
        notes: notes?.trim() || null,
        applied_by: user.id,
        cfdi_uuid: cfdi_uuid || null,
        cfdi_serie: cfdi_serie || null,
        cfdi_folio: cfdi_folio || null,
        cfdi_forma_pago: cfdi_forma_pago || null,
        cfdi_metodo_pago: cfdi_metodo_pago || null,
        cfdi_uso: cfdi_uso || null,
        cfdi_tipo_comprobante: cfdi_tipo_comprobante || null,
        cfdi_fecha_emision: cfdi_fecha_emision || null,
        cfdi_fecha_timbrado: cfdi_fecha_timbrado || null,
        cfdi_emisor_rfc: cfdi_emisor_rfc || null,
        cfdi_receptor_rfc: cfdi_receptor_rfc || null,
        cfdi_relacionado_uuid: cfdi_relacionado_uuid || null,
        cfdi_capture_mode,
      })
      .select()
      .single()

    if (cnErr || !creditNote) {
      return NextResponse.json({ error: cnErr?.message ?? 'Error al crear nota de crédito' }, { status: 500 })
    }

    // 2. Insert invoice-level allocations and per-item allocations
    for (const alloc of invoice_allocations) {
      const inv = invoices.find((i: any) => i.id === alloc.invoice_id) as any
      const allocTax = Math.round(Number(alloc.allocated_subtotal) * Number(inv.vat_rate) * 100) / 100

      const { data: invAlloc, error: invAllocErr } = await admin
        .from('credit_note_invoice_allocations')
        .insert({
          credit_note_id: creditNote.id,
          invoice_id: alloc.invoice_id,
          allocated_subtotal: Number(alloc.allocated_subtotal),
          allocated_tax: allocTax,
        })
        .select('id')
        .single()

      if (invAllocErr || !invAlloc) {
        console.error('invoice allocation error:', invAllocErr)
        continue
      }

      // Build or use item-level allocations
      const items: Array<{ id: string; amount: number }> = (inv.items ?? []).map((i: any) => ({
        id: i.id,
        amount: Number(i.amount),
      }))

      const itemAllocs: Array<{ invoice_item_id: string; allocated_amount: number }> =
        alloc.item_allocations?.length > 0
          ? alloc.item_allocations
          : buildProportionalItemAllocations(items, Number(alloc.allocated_subtotal))

      if (itemAllocs.length > 0) {
        await admin.from('invoice_credit_note_allocations').insert(
          itemAllocs.map((a) => ({
            credit_note_id: creditNote.id,
            invoice_allocation_id: invAlloc.id,
            invoice_item_id: a.invoice_item_id,
            allocated_amount: a.allocated_amount,
          })),
        )
      }

      // 3. Propagate landed_unit_price for each material/fleet item (best-effort)
      for (const itemAlloc of itemAllocs) {
        const item = (inv.items ?? []).find((i: any) => i.id === itemAlloc.invoice_item_id)
        if (!item?.entry_id) continue
        await propagateCreditToEntry(
          admin,
          item.id,
          Number(item.amount),
          item.cost_category,
          item.entry_id,
        ).catch((e) => console.error('propagateCreditToEntry error:', e))
      }

      // 4. Update invoice status if fully credited
      const { data: currentAllocs } = await admin
        .from('credit_note_invoice_allocations')
        .select('allocated_subtotal')
        .eq('invoice_id', alloc.invoice_id)

      const totalCredited = (currentAllocs ?? []).reduce(
        (s: number, a: any) => s + Number(a.allocated_subtotal),
        0,
      )
      const taxableBase = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)

      if (totalCredited >= taxableBase - 0.01) {
        await admin.from('supplier_invoices').update({ status: 'paid' }).eq('id', alloc.invoice_id)
        await admin.from('payables').update({ status: 'paid' }).eq('invoice_id', alloc.invoice_id)
      }
    }

    // 5. Update CN status based on total allocated
    const totalAllocated = invoice_allocations.reduce(
      (s: number, a: any) => s + Number(a.allocated_subtotal),
      0,
    )
    const cnStatus = Math.abs(totalAllocated - Number(amount)) <= 0.01
      ? 'fully_applied'
      : 'partially_applied'

    await admin
      .from('invoice_credit_notes')
      .update({ status: cnStatus })
      .eq('id', creditNote.id)

    return NextResponse.json({ credit_note: { ...creditNote, status: cnStatus } }, { status: 201 })
  } catch (err) {
    console.error('POST /api/ap/credit-notes error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
