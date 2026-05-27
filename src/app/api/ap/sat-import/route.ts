import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { parsedCfdiToSatRow } from '@/lib/sat/satCfdiRow'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

// POST /api/ap/sat-import — multipart with zip_file or xml_file
// Parses each XML, upserts into sat_cfdi_recibidos keyed by UUID.
// Returns { imported, skipped, errors: [{ file, message }] }
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
    try { admin = createServiceClient() } catch {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 503 })
    }

    // Get company RFC for receptor validation
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'company_rfc')
      .maybeSingle()
    const companyRfc = (setting?.value ?? '').trim().toUpperCase()

    let imported = 0
    let skipped = 0
    const errors: Array<{ file: string; message: string }> = []

    for (const { name, text } of entries) {
      try {
        const cfdi = parseCfdiXml(text)

        // Only import CFDIs directed to the company
        if (companyRfc && cfdi.receptor_rfc !== companyRfc) {
          skipped++
          continue
        }

        const row = parsedCfdiToSatRow(
          cfdi,
          user.id,
          source === 'zip' ? 'manual_zip' : 'manual_xml',
        )

        const { error: upsertErr } = await admin
          .from('sat_cfdi_recibidos')
          .upsert(row, { onConflict: 'uuid', ignoreDuplicates: false })

        if (upsertErr) {
          errors.push({ file: name, message: upsertErr.message })
        } else {
          imported++
        }
      } catch (err) {
        const msg = err instanceof CfdiParseError ? err.message : 'XML inválido o no es CFDI'
        errors.push({ file: name, message: msg })
      }
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (err) {
    console.error('POST /api/ap/sat-import error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
