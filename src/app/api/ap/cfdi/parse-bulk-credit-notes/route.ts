import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { fetchCompanyRfc, compareReceptorRfc } from '@/lib/ap/companyRfc'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'
import { buildCreditNoteBulkPreview } from '@/lib/ap/creditNoteBulk'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

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
    const plantId = form.get('plant_id')
    const plantFilter = typeof plantId === 'string' && plantId ? plantId : null

    const parsedItems: Array<{ file_name: string; cfdi: ReturnType<typeof parseCfdiXml> }> = []
    const errors: Array<{ file: string; message: string }> = []
    const skipped_non_credit: Array<{ file: string; tipo: string; emisor_rfc: string; folio: string | null }> = []

    for (const { name, text } of extracted.entries) {
      try {
        const cfdi = parseCfdiXml(text)
        cfdi.uuid = normalizeCfdiUuid(cfdi.uuid) ?? cfdi.uuid

        if (cfdi.tipo_comprobante !== 'E') {
          skipped_non_credit.push({
            file: name,
            tipo: cfdi.tipo_comprobante,
            emisor_rfc: cfdi.emisor_rfc,
            folio: [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || null,
          })
          continue
        }

        const { receptor_match } = compareReceptorRfc(cfdi.receptor_rfc, companyRfc)
        if (receptor_match === 'mismatch') {
          errors.push({ file: name, message: `RFC receptor no coincide (${cfdi.receptor_rfc})` })
          continue
        }

        parsedItems.push({ file_name: name, cfdi })
      } catch (err) {
        const msg = err instanceof CfdiParseError ? err.message : 'XML inválido'
        errors.push({ file: name, message: msg })
      }
    }

    const preview = await buildCreditNoteBulkPreview(supabase, parsedItems, {
      companyRfc,
      plantId: plantFilter,
    })

    return NextResponse.json({
      preview,
      errors,
      skipped_non_credit,
      company_rfc: companyRfc,
    })
  } catch (err) {
    console.error('/api/ap/cfdi/parse-bulk-credit-notes POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
