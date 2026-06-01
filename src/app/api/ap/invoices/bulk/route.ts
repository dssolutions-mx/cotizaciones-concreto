import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSupplierInvoice, type CreateSupplierInvoiceInput } from '@/lib/ap/createSupplierInvoice'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

type BulkAssignmentPayload = CreateSupplierInvoiceInput & { entry_id?: string }

// POST /api/ap/invoices/bulk — create multiple supplier invoices from pre-built payloads
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
    const { plant_id, assignments } = body as {
      plant_id?: string
      assignments?: BulkAssignmentPayload[]
    }

    if (!plant_id || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: 'Se requiere plant_id y assignments[]' }, { status: 400 })
    }

    const batchError = validateBulkAssignments(assignments, plant_id)
    if (batchError) {
      return NextResponse.json({ error: batchError }, { status: 400 })
    }

    const created: Array<{ entry_id: string; invoice_id: string; invoice_number: string }> = []
    const failed: Array<{ entry_id: string; error: string }> = []
    const warnings: Array<{ entry_id: string; messages: string[] }> = []

    for (const assignment of assignments) {
      const entryId = assignment.entry_id ?? 'unknown'
      if (assignment.plant_id !== plant_id) {
        failed.push({ entry_id: entryId, error: 'Planta no coincide con el lote' })
        continue
      }

      const result = await createSupplierInvoice(supabase, user.id, assignment)
      if (!result.ok) {
        failed.push({ entry_id: entryId, error: result.error })
        continue
      }

      created.push({
        entry_id: entryId,
        invoice_id: String(result.invoice.id),
        invoice_number: String(result.invoice.invoice_number),
      })
      if (result.warnings.length > 0) {
        warnings.push({ entry_id: entryId, messages: result.warnings })
      }
    }

    return NextResponse.json({ created, failed, warnings })
  } catch (err) {
    console.error('/api/ap/invoices/bulk POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

function validateBulkAssignments(assignments: BulkAssignmentPayload[], plant_id: string): string | null {
  const cfdiUuids = new Map<string, string>()
  const folioKeys = new Map<string, string>()

  for (const a of assignments) {
    const entryId = a.entry_id ?? 'unknown'
    if (a.plant_id !== plant_id) {
      return `La recepción ${entryId} no pertenece a la planta del lote`
    }

    const uuid = normalizeCfdiUuid(a.cfdi_uuid)
    if (uuid) {
      const prev = cfdiUuids.get(uuid)
      if (prev) {
        return `El CFDI ${uuid} está asignado a más de una recepción en este lote`
      }
      cfdiUuids.set(uuid, entryId)
    }

    const invNo = a.invoice_number?.trim()
    const supplierId = a.supplier_group_id
    if (invNo && supplierId) {
      const key = `${supplierId}|${plant_id}|${invNo.toUpperCase()}`
      const prev = folioKeys.get(key)
      if (prev) {
        return `El número de factura ${invNo} está repetido en este lote (proveedor duplicado)`
      }
      folioKeys.set(key, entryId)
    }
  }

  return null
}
