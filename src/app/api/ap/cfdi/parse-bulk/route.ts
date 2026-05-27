import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

export type ParsedCfdiBulkItem = {
  id: string
  file_name: string
  cfdi: ReturnType<typeof parseCfdiXml>
  receptor_match: 'ok' | 'mismatch' | 'company_rfc_not_set'
  company_rfc: string | null
  supplier_group: { id: string; name: string; rfc: string | null } | null
  duplicate_invoice: { id: string; invoice_number: string } | null
}

// POST /api/ap/cfdi/parse-bulk — multipart zip_file, xml_file, or xml_files[]
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
    const extracted = await extractXmlFromFormData(form)
    if ('error' in extracted) {
      return NextResponse.json({ error: extracted.error }, { status: 400 })
    }

    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'company_rfc')
      .maybeSingle()
    const companyRfc = (setting?.value ?? '').trim().toUpperCase()

    const parsed: ParsedCfdiBulkItem[] = []
    const errors: Array<{ file: string; message: string }> = []

    for (const { name, text } of extracted.entries) {
      try {
        const cfdi = parseCfdiXml(text)

        if (cfdi.tipo_comprobante !== 'I') {
          const tipoLabel =
            cfdi.tipo_comprobante === 'P' ? 'complemento de pago'
              : cfdi.tipo_comprobante === 'E' ? 'nota de crédito'
                : `tipo ${cfdi.tipo_comprobante}`
          errors.push({ file: name, message: `Solo se aceptan facturas de ingreso (tipo I); este es ${tipoLabel}` })
          continue
        }

        let receptor_match: 'ok' | 'mismatch' | 'company_rfc_not_set' = 'ok'
        if (!companyRfc) {
          receptor_match = 'company_rfc_not_set'
        } else if (cfdi.receptor_rfc !== companyRfc) {
          receptor_match = 'mismatch'
        }

        const { data: matchingGroup } = await supabase
          .from('supplier_groups')
          .select('id, name, rfc')
          .eq('rfc', cfdi.emisor_rfc)
          .eq('is_active', true)
          .maybeSingle()

        const { data: existingInvoice } = await supabase
          .from('supplier_invoices')
          .select('id, invoice_number')
          .eq('cfdi_uuid', cfdi.uuid)
          .maybeSingle()

        parsed.push({
          id: cfdi.uuid,
          file_name: name,
          cfdi,
          receptor_match,
          company_rfc: companyRfc || null,
          supplier_group: matchingGroup ?? null,
          duplicate_invoice: existingInvoice ?? null,
        })
      } catch (err) {
        const msg = err instanceof CfdiParseError ? err.message : 'XML inválido o no es CFDI'
        errors.push({ file: name, message: msg })
      }
    }

    return NextResponse.json({ parsed, errors })
  } catch (err) {
    console.error('/api/ap/cfdi/parse-bulk POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
