import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { fetchCompanyRfc, compareReceptorRfc } from '@/lib/ap/companyRfc'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

export type ParsedCfdiBulkItem = {
  id: string
  file_name: string
  cfdi: ReturnType<typeof parseCfdiXml>
  receptor_match: 'ok' | 'mismatch' | 'skipped'
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

    const companyRfc = await fetchCompanyRfc(supabase)

    const parsed: ParsedCfdiBulkItem[] = []
    const errors: Array<{ file: string; message: string }> = []
    const skipped_non_invoice: Array<{ file: string; tipo: string; emisor_rfc: string; folio: string | null }> = []

    for (const { name, text } of extracted.entries) {
      try {
        const cfdi = parseCfdiXml(text)

        if (cfdi.tipo_comprobante !== 'I') {
          skipped_non_invoice.push({
            file: name,
            tipo: cfdi.tipo_comprobante,
            emisor_rfc: cfdi.emisor_rfc,
            folio: [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || null,
          })
          continue
        }

        const { receptor_match } = compareReceptorRfc(cfdi.receptor_rfc, companyRfc)

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

    return NextResponse.json({ parsed, errors, skipped_non_invoice, company_rfc: companyRfc })
  } catch (err) {
    console.error('/api/ap/cfdi/parse-bulk POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
