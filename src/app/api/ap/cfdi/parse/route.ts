import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { fetchCompanyRfc, compareReceptorRfc } from '@/lib/ap/companyRfc'
import {
  lookupCreditNoteDuplicates,
  lookupSupplierInvoiceDuplicates,
} from '@/lib/ap/cfdiImportReview'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

// POST /api/ap/cfdi/parse — multipart: xml_file, optional plant_id, optional supplier_group_id
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('xml_file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Se requiere un archivo xml_file' }, { status: 400 })
    }
    const plantId = String(form.get('plant_id') ?? '').trim() || null
    const supplierGroupId = String(form.get('supplier_group_id') ?? '').trim() || null
    const xmlText = await file.text()

    let parsed
    try {
      parsed = parseCfdiXml(xmlText)
    } catch (err) {
      if (err instanceof CfdiParseError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 })
      }
      throw err
    }

    const companyRfc = await fetchCompanyRfc(supabase)
    const { receptor_match } = compareReceptorRfc(parsed.receptor_rfc, companyRfc)

    const { data: matchingGroup } = await supabase
      .from('supplier_groups')
      .select('id, name, rfc')
      .eq('rfc', parsed.emisor_rfc)
      .eq('is_active', true)
      .maybeSingle()

    const groupId = supplierGroupId ?? matchingGroup?.id ?? null

    const invoiceDups = await lookupSupplierInvoiceDuplicates(supabase, {
      cfdiUuid: parsed.uuid,
      supplierGroupId: groupId,
      plantId,
      cfdi: parsed,
    })

    const folio =
      [parsed.serie, parsed.folio].filter(Boolean).join('-') || parsed.uuid.slice(0, 8)
    const creditDups =
      parsed.tipo_comprobante === 'E'
        ? await lookupCreditNoteDuplicates(supabase, {
            cfdiUuid: parsed.uuid,
            supplierGroupId: groupId,
            plantId,
            creditNumber: folio,
          })
        : { by_uuid: null, by_folio: null }

    return NextResponse.json({
      cfdi: parsed,
      receptor_match,
      company_rfc: companyRfc || null,
      supplier_group: matchingGroup ?? null,
      duplicate_invoice: invoiceDups.by_uuid
        ? { id: invoiceDups.by_uuid.id, invoice_number: invoiceDups.by_uuid.document_number }
        : null,
      duplicate_invoice_folio: invoiceDups.by_folio
        ? { id: invoiceDups.by_folio.id, invoice_number: invoiceDups.by_folio.document_number }
        : null,
      duplicate_credit_note: creditDups.by_uuid
        ? { id: creditDups.by_uuid.id, credit_number: creditDups.by_uuid.document_number }
        : null,
      duplicate_credit_note_folio: creditDups.by_folio
        ? { id: creditDups.by_folio.id, credit_number: creditDups.by_folio.document_number }
        : null,
      already_registered:
        Boolean(invoiceDups.by_uuid ?? invoiceDups.by_folio)
        || Boolean(creditDups.by_uuid ?? creditDups.by_folio),
      file_name: file.name,
      file_size: file.size,
    })
  } catch (err) {
    console.error('/api/ap/cfdi/parse POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
