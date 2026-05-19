import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// ── GET /api/ap/invoices ─────────────────────────────────────────────────────
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
    const supplier_group_id = searchParams.get('supplier_group_id') || undefined
    const status = searchParams.get('status') || undefined
    const include_paid = searchParams.get('include_paid') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('supplier_invoices')
      .select(`
        id, supplier_group_id, plant_id,
        invoice_number, is_internal, invoice_date, due_date,
        currency, vat_rate, subtotal, discount_amount, tax, total,
        retention_isr_rate, retention_isr_amount, retention_iva_rate, retention_iva_amount,
        status, source, document_url, xml_url, notes,
        cfdi_uuid, cfdi_serie, cfdi_folio, cfdi_forma_pago, cfdi_metodo_pago, cfdi_uso,
        cfdi_tipo_comprobante, cfdi_fecha_emision, cfdi_fecha_timbrado,
        cfdi_emisor_rfc, cfdi_receptor_rfc, cfdi_estado_sat, cfdi_estado_checked_at,
        cfdi_capture_mode,
        created_by, created_at,
        supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
        items:supplier_invoice_items(
          id, entry_id, cost_category, description, qty, unit_price, amount,
          entry:material_entries!entry_id(
            id, entry_number, entry_date, received_qty_entered, received_uom,
            unit_price, landed_unit_price, supplier_invoice
          )
        ),
        payable:payables!invoice_id(
          id, status, subtotal, tax, total,
          payments:payments!payable_id(id, payment_date, amount, method, reference)
        ),
        cn_allocations:credit_note_invoice_allocations(
          id, credit_note_id, allocated_subtotal, allocated_tax, allocated_total
        )
      `, { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (plant_id) query = query.eq('plant_id', plant_id)
    if (supplier_group_id) query = query.eq('supplier_group_id', supplier_group_id)
    if (status) {
      query = query.eq('status', status)
    } else if (!include_paid) {
      query = query.in('status', ['open', 'partially_paid'])
    }

    const { data: invoices, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Compute paid_to_date, credit applied, and balance per invoice
    const enriched = (invoices ?? []).map((inv: any) => {
      const payable = Array.isArray(inv.payable) ? inv.payable[0] : inv.payable
      const payments: any[] = payable?.payments ?? []
      const paid_to_date = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
      const cnAllocs: any[] = inv.cn_allocations ?? []
      const credit_applied_subtotal = cnAllocs.reduce((s: number, a: any) => s + Number(a.allocated_subtotal ?? 0), 0)
      const credit_applied_total = cnAllocs.reduce((s: number, a: any) => s + Number(a.allocated_total ?? 0), 0)
      const taxable_base = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
      return {
        ...inv,
        taxable_base,
        payable: payable ?? null,
        paid_to_date,
        credit_applied_subtotal,
        credit_applied_total,
        balance: Number(inv.total) - paid_to_date - credit_applied_total,
        cn_allocations: undefined,
      }
    })

    return NextResponse.json({
      invoices: enriched,
      pagination: { total: count ?? 0, limit, offset, hasMore: (count ?? 0) > offset + limit },
    })
  } catch (err) {
    console.error('/api/ap/invoices GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST /api/ap/invoices ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const {
      supplier_group_id,
      plant_id,
      invoice_number: rawInvoiceNumber,
      is_internal = false,
      invoice_date,
      due_date,
      vat_rate,
      subtotal,
      discount_amount: rawDiscount = 0,
      retention_isr_rate: rawIsrRate = 0,
      retention_iva_rate: rawIvaRetRate = 0,
      source = 'system',
      notes = null,
      document_url = null,
      xml_url = null,
      items = [],
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
      cfdi_capture_mode = 'manual',
    } = body

    if (!supplier_group_id || !plant_id || !invoice_date || !due_date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // CFDI validations
    if (cfdi_capture_mode === 'cfdi') {
      if (!cfdi_uuid || !cfdi_emisor_rfc || !cfdi_receptor_rfc) {
        return NextResponse.json(
          { error: 'Modo CFDI requiere cfdi_uuid, cfdi_emisor_rfc y cfdi_receptor_rfc' },
          { status: 400 },
        )
      }
      // Validate emisor RFC matches the selected supplier group
      const { data: group } = await supabase
        .from('supplier_groups')
        .select('id, rfc')
        .eq('id', supplier_group_id)
        .maybeSingle()
      if (group?.rfc && group.rfc.toUpperCase() !== String(cfdi_emisor_rfc).toUpperCase()) {
        return NextResponse.json(
          { error: `El RFC emisor del CFDI (${cfdi_emisor_rfc}) no coincide con el del grupo de proveedor (${group.rfc})` },
          { status: 400 },
        )
      }
      // Validate receptor RFC matches company RFC
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'company_rfc')
        .maybeSingle()
      const companyRfc = (setting?.value ?? '').trim().toUpperCase()
      if (companyRfc && String(cfdi_receptor_rfc).toUpperCase() !== companyRfc) {
        return NextResponse.json(
          { error: `El RFC receptor del CFDI (${cfdi_receptor_rfc}) no coincide con el RFC de la empresa (${companyRfc})` },
          { status: 400 },
        )
      }
    }
    if (cfdi_uuid) {
      const { data: dup } = await supabase
        .from('supplier_invoices')
        .select('id, invoice_number')
        .eq('cfdi_uuid', cfdi_uuid)
        .maybeSingle()
      if (dup) {
        return NextResponse.json(
          { error: `Este CFDI ya está registrado en la factura ${dup.invoice_number}` },
          { status: 409 },
        )
      }
    }

    // Compute totals server-side from canonical formula
    const discountAmt = Math.round(Number(rawDiscount) * 100) / 100
    const isrRate     = Number(rawIsrRate)
    const ivaRetRate  = Number(rawIvaRetRate)
    const taxableBase = Math.round((Number(subtotal) - discountAmt) * 100) / 100
    const tax         = Math.round(taxableBase * Number(vat_rate) * 100) / 100
    const isrAmt      = Math.round(taxableBase * isrRate * 100) / 100
    // retention_iva_rate is a fraction of taxable base (same as SAT TasaOCuota convention)
    const ivaRetAmt   = Math.round(taxableBase * ivaRetRate * 100) / 100
    const total       = Math.round((taxableBase + tax - isrAmt - ivaRetAmt) * 100) / 100

    // Resolve invoice_number: for internal invoices auto-generate INT-YYYY-NNNNN
    let invoice_number = rawInvoiceNumber?.trim() || ''
    if (is_internal || !invoice_number) {
      const year = new Date().getFullYear()
      const { count } = await supabase
        .from('supplier_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('is_internal', true)
        .gte('created_at', `${year}-01-01`)
      const seq = String((count ?? 0) + 1).padStart(5, '0')
      invoice_number = `INT-${year}-${seq}`
    }

    // Insert invoice
    const { data: invoice, error: invErr } = await supabase
      .from('supplier_invoices')
      .insert({
        supplier_group_id,
        plant_id,
        invoice_number,
        is_internal,
        invoice_date,
        due_date,
        vat_rate: Number(vat_rate),
        subtotal: Number(subtotal),
        discount_amount: discountAmt,
        tax,
        total,
        retention_isr_rate: isrRate,
        retention_isr_amount: isrAmt,
        retention_iva_rate: ivaRetRate,
        retention_iva_amount: ivaRetAmt,
        status: 'open',
        source,
        notes,
        document_url,
        xml_url,
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
        cfdi_capture_mode,
        created_by: user.id,
      })
      .select()
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: invErr?.message ?? 'Error al crear factura' }, { status: 500 })
    }

    // Cross-validate: sum of item amounts must be within $1.00 of declared subtotal.
    // Catches client-side bugs where items don't add up to what was posted.
    if (items.length > 0) {
      const itemsSum = items.reduce((s: number, it: any) => s + Number(it.amount ?? 0), 0)
      if (Math.abs(itemsSum - Number(subtotal)) > 1.00) {
        await supabase.from('supplier_invoices').delete().eq('id', invoice.id)
        return NextResponse.json(
          {
            error: `La suma de las líneas (${itemsSum.toFixed(2)}) no coincide con el subtotal declarado (${Number(subtotal).toFixed(2)}). Diferencia: ${Math.abs(itemsSum - Number(subtotal)).toFixed(2)}`,
          },
          { status: 400 },
        )
      }
    }

    // Insert line items
    if (items.length > 0) {
      const itemRows = items.map((it: any) => ({
        invoice_id: invoice.id,
        entry_id: it.entry_id ?? null,
        cost_category: it.cost_category ?? null,
        description: it.description ?? null,
        qty: it.qty != null ? Number(it.qty) : null,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        amount: Number(it.amount),
      }))
      const { error: itemErr } = await supabase.from('supplier_invoice_items').insert(itemRows)
      if (itemErr) {
        // Roll back invoice (best-effort)
        await supabase.from('supplier_invoices').delete().eq('id', invoice.id)
        return NextResponse.json({ error: itemErr.message }, { status: 500 })
      }
    }

    // Create linked payable for payment tracking.
    // Strategy: prefer group→plant lookup; fall back to supplier_id via first entry_id
    // (handles suppliers with no group_id, e.g. MAPEI).
    const warnings: string[] = []
    let supplierIdForPayable: string | null = null

    if (supplier_group_id) {
      const { data: byGroup } = await supabase
        .from('suppliers')
        .select('id')
        .eq('group_id', supplier_group_id)
        .eq('plant_id', plant_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      supplierIdForPayable = byGroup?.id ?? null
    }

    // Fallback: derive supplier_id from the first entry that has one
    if (!supplierIdForPayable && items.length > 0) {
      const firstEntryId = items.find((it: any) => it.entry_id)?.entry_id
      if (firstEntryId) {
        const { data: entryRow } = await supabase
          .from('material_entries')
          .select('supplier_id, fleet_supplier_id')
          .eq('id', firstEntryId)
          .maybeSingle()
        // Use fleet_supplier_id when all items are fleet cost, otherwise material supplier
        const allFleet = items.length > 0 && items.every((it: any) => it.cost_category === 'fleet')
        supplierIdForPayable = allFleet
          ? (entryRow?.fleet_supplier_id ?? entryRow?.supplier_id ?? null)
          : (entryRow?.supplier_id ?? null)
      }
    }

    if (supplierIdForPayable) {
      const { data: payable, error: payErr } = await supabase
        .from('payables')
        .insert({
          supplier_id: supplierIdForPayable,
          plant_id,
          invoice_id: invoice.id,
          invoice_number,
          invoice_date,
          due_date,
          vat_rate: Number(vat_rate),
          subtotal: Number(subtotal),
          tax,
          total,
          status: 'open',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (payErr) {
        // Payable failure is non-fatal (invoice already committed) but must be surfaced
        console.error('/api/ap/invoices payable creation error:', payErr.message)
        warnings.push(`Factura creada pero no se pudo crear el registro de cuentas por pagar: ${payErr.message}`)
      } else if (payable && items.length > 0) {
        // Create payable_items for each invoice line that has an entry
        const payableItemRows = items
          .filter((it: any) => it.entry_id)
          .map((it: any) => ({
            payable_id: payable.id,
            invoice_id: invoice.id,
            entry_id: it.entry_id,
            amount: Number(it.amount),
            cost_category: it.cost_category ?? 'material',
          }))
        if (payableItemRows.length > 0) {
          const { error: piErr } = await supabase.from('payable_items').insert(payableItemRows)
          if (piErr) {
            console.error('/api/ap/invoices payable_items insert error:', piErr.message)
            warnings.push(`Cuentas por pagar creado pero no se vincularon las líneas: ${piErr.message}`)
          }
        }
      }
    } else {
      warnings.push('No se encontró proveedor activo para crear el registro de cuentas por pagar. Deberá crearse manualmente.')
      console.warn('/api/ap/invoices: could not resolve supplier_id for payable — invoice_id:', invoice.id)
    }

    return NextResponse.json({ invoice, warnings: warnings.length > 0 ? warnings : undefined }, { status: 201 })
  } catch (err) {
    console.error('/api/ap/invoices POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
