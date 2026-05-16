import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

// POST /api/ap/cfdi/parse — multipart/form-data with xml_file
// Returns parsed CFDI metadata for prefilling. No DB writes.
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

    // Validate receptor RFC against company_rfc setting
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'company_rfc')
      .maybeSingle()
    const companyRfc = (setting?.value ?? '').trim().toUpperCase()
    let receptor_match: 'ok' | 'mismatch' | 'company_rfc_not_set' = 'ok'
    if (!companyRfc) {
      receptor_match = 'company_rfc_not_set'
    } else if (parsed.receptor_rfc !== companyRfc) {
      receptor_match = 'mismatch'
    }

    // Try to find existing supplier_group by emisor RFC
    const { data: matchingGroup } = await supabase
      .from('supplier_groups')
      .select('id, name, rfc')
      .eq('rfc', parsed.emisor_rfc)
      .eq('is_active', true)
      .maybeSingle()

    // Check whether this UUID is already attached to a supplier_invoice
    const { data: existingInvoice } = await supabase
      .from('supplier_invoices')
      .select('id, invoice_number')
      .eq('cfdi_uuid', parsed.uuid)
      .maybeSingle()

    return NextResponse.json({
      cfdi: parsed,
      receptor_match,
      company_rfc: companyRfc || null,
      supplier_group: matchingGroup ?? null,
      duplicate_invoice: existingInvoice ?? null,
      file_name: file.name,
      file_size: file.size,
    })
  } catch (err) {
    console.error('/api/ap/cfdi/parse POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
