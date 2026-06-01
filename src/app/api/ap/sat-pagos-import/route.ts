import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { parsedCfdiToSatRow } from '@/lib/sat/satCfdiRow'
import { buildRepPaymentPreview } from '@/lib/sat/repPayments'
import type { ParsedCfdi } from '@/types/finance'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

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
    const { entries, source } = extracted

    let admin: ReturnType<typeof createServiceClient>
    try {
      admin = createServiceClient()
    } catch {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 503 })
    }

    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'company_rfc')
      .maybeSingle()
    const companyRfc = (setting?.value ?? '').trim().toUpperCase()

    const importSource = source === 'zip' ? 'manual_zip' : 'manual_xml'
    const parsedRep: ParsedCfdi[] = []
    let imported = 0
    let skipped = 0
    const errors: Array<{ file: string; message: string }> = []
    const skipped_details: Array<{ file: string; reason: string }> = []

    for (const { name, text } of entries) {
      try {
        const cfdi = parseCfdiXml(text)
        cfdi.uuid = normalizeCfdiUuid(cfdi.uuid) ?? cfdi.uuid

        if (cfdi.tipo_comprobante !== 'P') {
          skipped++
          skipped_details.push({ file: name, reason: `No es complemento de pago (tipo ${cfdi.tipo_comprobante})` })
          continue
        }

        if (cfdi.pagos_doctos.length === 0) {
          errors.push({ file: name, message: 'REP sin documentos relacionados' })
          continue
        }

        const row = parsedCfdiToSatRow(cfdi, user.id, importSource)
        row.uuid = normalizeCfdiUuid(row.uuid) ?? row.uuid
        const { error: upsertErr } = await admin
          .from('sat_cfdi_recibidos')
          .upsert(row, { onConflict: 'uuid', ignoreDuplicates: false })

        if (upsertErr) {
          errors.push({ file: name, message: upsertErr.message })
        } else {
          imported++
          parsedRep.push(cfdi)
        }
      } catch (err) {
        const msg = err instanceof CfdiParseError ? err.message : 'XML inválido o no es CFDI'
        errors.push({ file: name, message: msg })
      }
    }

    const preview = await buildRepPaymentPreview(supabase, parsedRep, { companyRfc })

    return NextResponse.json({
      imported,
      skipped,
      skipped_details,
      preview,
      errors,
      company_rfc: companyRfc || null,
    })
  } catch (err) {
    console.error('POST /api/ap/sat-pagos-import error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
