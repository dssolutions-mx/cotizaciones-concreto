import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildInvoiceTotalsFromBody,
  deriveInvoiceSource,
  normalizeInvoiceItems,
} from '@/lib/ap/normalizeInvoicePayload'
import { fetchCompanyRfc } from '@/lib/ap/companyRfc'
import { roundMoney } from '@/lib/ap/invoiceTotals'
import { mapSupplierInvoiceDbError } from '@/lib/ap/mapSupplierInvoiceDbError'

function dbError(
  message: string,
  code?: string | null,
  status = 500,
): CreateSupplierInvoiceResult {
  return { ok: false, error: mapSupplierInvoiceDbError(message, code), status }
}

export type CreateSupplierInvoiceInput = {
  supplier_group_id: string
  plant_id: string
  invoice_number?: string
  is_internal?: boolean
  invoice_date: string
  due_date: string
  vat_rate: number
  subtotal: number
  discount_amount?: number
  retention_isr_rate?: number
  retention_iva_rate?: number
  retentions?: unknown
  source?: string
  notes?: string | null
  document_url?: string | null
  xml_url?: string | null
  items?: unknown[]
  cfdi_uuid?: string | null
  cfdi_serie?: string | null
  cfdi_folio?: string | null
  cfdi_forma_pago?: string | null
  cfdi_metodo_pago?: string | null
  cfdi_uso?: string | null
  cfdi_tipo_comprobante?: string | null
  cfdi_fecha_emision?: string | null
  cfdi_fecha_timbrado?: string | null
  cfdi_emisor_rfc?: string | null
  cfdi_receptor_rfc?: string | null
  cfdi_capture_mode?: string
}

export type CreateSupplierInvoiceResult =
  | { ok: true; invoice: Record<string, unknown>; warnings: string[] }
  | { ok: false; error: string; status: number }

export async function createSupplierInvoice(
  supabase: SupabaseClient,
  userId: string,
  body: CreateSupplierInvoiceInput,
): Promise<CreateSupplierInvoiceResult> {
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
    retentions: rawRetentions,
    source: clientSource,
    notes = null,
    document_url = null,
    xml_url = null,
    items = [],
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
    return { ok: false, error: 'Faltan campos requeridos', status: 400 }
  }

  if (cfdi_capture_mode === 'cfdi') {
    if (!cfdi_uuid || !cfdi_emisor_rfc || !cfdi_receptor_rfc) {
      return {
        ok: false,
        error: 'Modo CFDI requiere cfdi_uuid, cfdi_emisor_rfc y cfdi_receptor_rfc',
        status: 400,
      }
    }
    const { data: group } = await supabase
      .from('supplier_groups')
      .select('id, rfc')
      .eq('id', supplier_group_id)
      .maybeSingle()
    if (group?.rfc && group.rfc.toUpperCase() !== String(cfdi_emisor_rfc).toUpperCase()) {
      return {
        ok: false,
        error: `El RFC emisor del CFDI (${cfdi_emisor_rfc}) no coincide con el del grupo de proveedor (${group.rfc})`,
        status: 400,
      }
    }
    const companyRfc = await fetchCompanyRfc(supabase)
    if (companyRfc && String(cfdi_receptor_rfc).toUpperCase() !== companyRfc) {
      return {
        ok: false,
        error: `El RFC receptor del CFDI (${cfdi_receptor_rfc}) no coincide con el RFC de la empresa (${companyRfc})`,
        status: 400,
      }
    }
  }

  if (cfdi_uuid) {
    const { data: dup } = await supabase
      .from('supplier_invoices')
      .select('id, invoice_number')
      .eq('cfdi_uuid', cfdi_uuid)
      .maybeSingle()
    if (dup) {
      return {
        ok: false,
        error: `Este CFDI ya está registrado en la factura ${dup.invoice_number}`,
        status: 409,
      }
    }
  }

  const { items: normalizedItems, error: itemsError } = normalizeInvoiceItems(items)
  if (itemsError) {
    return { ok: false, error: itemsError, status: 400 }
  }

  const itemsSum = normalizedItems.reduce((s, it) => s + it.amount, 0)
  const declaredSubtotal = roundMoney(Number(subtotal))
  if (Math.abs(itemsSum - declaredSubtotal) > 1.0) {
    return {
      ok: false,
      error: `La suma de las líneas (${itemsSum.toFixed(2)}) no coincide con el subtotal declarado (${declaredSubtotal.toFixed(2)})`,
      status: 400,
    }
  }

  const entryIds = [
    ...new Set(normalizedItems.filter(it => it.entry_id).map(it => it.entry_id as string)),
  ]
  const warnings: string[] = []

  const entryLineKeys = new Set<string>()
  for (const it of normalizedItems) {
    if (!it.entry_id) continue
    const key = `${it.entry_id}:${it.cost_category}`
    if (entryLineKeys.has(key)) {
      return {
        ok: false,
        error:
          'La factura repite la misma recepción en la misma categoría (material o flete). Revise las líneas.',
        status: 400,
      }
    }
    entryLineKeys.add(key)
  }

  if (entryIds.length > 0) {
    const { data: alreadyInvoiced, error: linkedErr } = await supabase
      .from('supplier_invoice_items')
      .select(
        'entry_id, cost_category, invoice:supplier_invoices(invoice_number), entry:material_entries(entry_number)',
      )
      .in('entry_id', entryIds)
      .eq('line_source', 'entry')

    if (linkedErr) {
      return dbError(linkedErr.message, linkedErr.code)
    }

    const conflicts = (alreadyInvoiced ?? []).filter((row) =>
      normalizedItems.some(
        (it) =>
          it.entry_id === row.entry_id
          && it.cost_category === (row.cost_category === 'fleet' ? 'fleet' : 'material'),
      ),
    )
    if (conflicts.length > 0) {
      const labels = [
        ...new Set(
          conflicts.map((row) => {
            const entry = row.entry as { entry_number?: string } | null
            const inv = row.invoice as { invoice_number?: string } | null
            const en = entry?.entry_number ?? row.entry_id?.slice(0, 8) ?? '?'
            const cat = row.cost_category === 'fleet' ? 'flete' : 'material'
            const invNo = inv?.invoice_number
            return invNo ? `${en} (${cat}, factura ${invNo})` : `${en} (${cat})`
          }),
        ),
      ].slice(0, 5)
      const extra =
        labels.length < conflicts.length ? ` y ${conflicts.length - labels.length} más` : ''
      return {
        ok: false,
        error: `Recepción ya facturada: ${labels.join(', ')}${extra}. Actualice la lista de entradas sin factura.`,
        status: 409,
      }
    }
  }

  if (entryIds.length > 0) {
    const { data: entryRows, error: entErr } = await supabase
      .from('material_entries')
      .select('id, plant_id, total_cost, fleet_cost')
      .in('id', entryIds)
    if (entErr) {
      return dbError(entErr.message, entErr.code)
    }
    const byId = new Map((entryRows ?? []).map(e => [e.id, e]))
    for (const it of normalizedItems) {
      if (!it.entry_id) continue
      const row = byId.get(it.entry_id)
      if (!row) {
        return { ok: false, error: `Entrada no encontrada: ${it.entry_id}`, status: 400 }
      }
      if (row.plant_id !== plant_id) {
        return {
          ok: false,
          error: `La entrada ${it.entry_id} pertenece a otra planta`,
          status: 400,
        }
      }
      const expected =
        it.cost_category === 'fleet'
          ? Number(row.fleet_cost ?? 0)
          : Number(row.total_cost ?? 0)
      if (expected > 0 && Math.abs(it.amount - expected) > 1.0) {
        warnings.push(
          `Línea ${it.description ?? it.entry_id}: monto ${it.amount.toFixed(2)} difiere del registrado ${expected.toFixed(2)}`,
        )
      }
    }
  }

  const invoiceSource =
    clientSource && ['system', 'historical', 'mixed'].includes(clientSource)
      ? clientSource
      : deriveInvoiceSource(normalizedItems)

  const totalsBody = {
    ...body,
    discount_amount: rawDiscount,
    retention_isr_rate: rawIsrRate,
    retention_iva_rate: rawIvaRetRate,
    retentions: rawRetentions,
    vat_rate,
  }
  const {
    discountAmt,
    taxableBase,
    tax,
    total,
    retention_isr_rate: isrRate,
    retention_isr_amount: isrAmt,
    retention_iva_rate: ivaRetRate,
    retention_iva_amount: ivaRetAmt,
    retentionRows,
  } = buildInvoiceTotalsFromBody(totalsBody, declaredSubtotal)

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
  } else {
    const { data: dupFolio } = await supabase
      .from('supplier_invoices')
      .select('id, invoice_number')
      .eq('supplier_group_id', supplier_group_id)
      .eq('plant_id', plant_id)
      .eq('invoice_number', invoice_number)
      .maybeSingle()
    if (dupFolio) {
      return {
        ok: false,
        error: `Ya existe la factura ${dupFolio.invoice_number} para este proveedor en esta planta.`,
        status: 409,
      }
    }
  }

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
      subtotal: declaredSubtotal,
      discount_amount: discountAmt,
      tax,
      total,
      retention_isr_rate: isrRate,
      retention_isr_amount: isrAmt,
      retention_iva_rate: ivaRetRate,
      retention_iva_amount: ivaRetAmt,
      status: 'open',
      source: invoiceSource,
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
      created_by: userId,
    })
    .select()
    .single()

  if (invErr || !invoice) {
    return dbError(invErr?.message ?? 'Error al crear factura', invErr?.code)
  }

  if (normalizedItems.length > 0) {
    const itemRows = normalizedItems.map(it => ({
      invoice_id: invoice.id,
      entry_id: it.entry_id,
      line_source: it.line_source,
      manual_reason: it.manual_reason,
      cost_category: it.cost_category,
      description: it.description,
      qty: it.qty,
      unit_price: it.unit_price,
      amount: it.amount,
    }))
    const { error: itemErr } = await supabase.from('supplier_invoice_items').insert(itemRows)
    if (itemErr) {
      await supabase.from('supplier_invoices').delete().eq('id', invoice.id)
      return dbError(itemErr.message, itemErr.code)
    }
  }

  if (retentionRows.length > 0) {
    const retentionInserts = retentionRows.map((r, idx) => ({
      invoice_id: invoice.id,
      impuesto_sat: r.impuesto_sat,
      label: r.label ?? null,
      base_amount: r.base_amount ?? taxableBase,
      rate: r.rate ?? null,
      amount: r.amount,
      sort_order: r.sort_order ?? idx,
    }))
    const { error: retErr } = await supabase
      .from('supplier_invoice_retentions')
      .insert(retentionInserts)
    if (retErr) {
      await supabase.from('supplier_invoices').delete().eq('id', invoice.id)
      return dbError(retErr.message, retErr.code)
    }
  }

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

  if (!supplierIdForPayable && normalizedItems.length > 0) {
    const firstEntryId = normalizedItems.find(it => it.entry_id)?.entry_id
    if (firstEntryId) {
      const { data: entryRow } = await supabase
        .from('material_entries')
        .select('supplier_id, fleet_supplier_id')
        .eq('id', firstEntryId)
        .maybeSingle()
      const allFleet =
        normalizedItems.length > 0 &&
        normalizedItems.every(it => it.cost_category === 'fleet')
      supplierIdForPayable = allFleet
        ? (entryRow?.fleet_supplier_id ?? entryRow?.supplier_id ?? null)
        : (entryRow?.supplier_id ?? null)
    }
  }

  if (supplierIdForPayable) {
    const { data: payableRows, error: payErr } = await supabase
      .from('payables')
      .upsert(
        {
          supplier_id: supplierIdForPayable,
          plant_id,
          invoice_id: invoice.id,
          invoice_number,
          invoice_date,
          due_date,
          vat_rate: Number(vat_rate),
          subtotal: declaredSubtotal,
          tax,
          total,
          status: 'open',
          created_by: userId,
        },
        { onConflict: 'supplier_id,plant_id,invoice_number' },
      )
      .select('id')

    const payable = Array.isArray(payableRows) ? payableRows[0] : payableRows

    if (payErr || !payable) {
      console.error('createSupplierInvoice payable error:', payErr?.message)
      warnings.push(
        `Factura creada pero no se pudo vincular cuentas por pagar: ${mapSupplierInvoiceDbError(payErr?.message ?? 'error desconocido', payErr?.code)}`,
      )
    } else if (normalizedItems.length > 0) {
      const payableItemRows = normalizedItems
        .filter(it => it.entry_id)
        .map(it => ({
          payable_id: payable.id,
          invoice_id: invoice.id,
          entry_id: it.entry_id,
          amount: it.amount,
          cost_category: it.cost_category,
        }))
      if (payableItemRows.length > 0) {
        const { error: piErr } = await supabase
          .from('payable_items')
          .upsert(payableItemRows, { onConflict: 'entry_id,cost_category' })
        if (piErr) {
          console.error('createSupplierInvoice payable_items error:', piErr.message)
          warnings.push(
            `Factura creada; CXP parcial: ${mapSupplierInvoiceDbError(piErr.message, piErr.code)}`,
          )
        }
      }
    }
  } else {
    warnings.push('No se encontró proveedor activo para crear el registro de cuentas por pagar.')
  }

  return { ok: true, invoice, warnings }
}
