import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { parsedCfdiToSatRow } from '@/lib/sat/satCfdiRow'
import { buildRepPaymentPreview } from '@/lib/sat/repPayments'
import type { ParsedCfdi } from '@/types/finance'
import JSZip from 'jszip'

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
    const zipFile = form.get('zip_file')
    const xmlFile = form.get('xml_file')

    if (!zipFile && !xmlFile) {
      return NextResponse.json({ error: 'Se requiere zip_file o xml_file' }, { status: 400 })
    }

    const entries: Array<{ name: string; text: string }> = []
    if (zipFile instanceof File) {
      const buffer = await zipFile.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      for (const [name, entry] of Object.entries(zip.files)) {
        if (!name.toLowerCase().endsWith('.xml') || entry.dir) continue
        entries.push({ name, text: await entry.async('string') })
      }
    } else if (xmlFile instanceof File) {
      entries.push({ name: xmlFile.name, text: await xmlFile.text() })
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No se encontraron archivos XML en el ZIP' }, { status: 400 })
    }

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

    const source = zipFile instanceof File ? 'manual_zip' : 'manual_xml'
    const parsedRep: ParsedCfdi[] = []
    let imported = 0
    let skipped = 0
    const errors: Array<{ file: string; message: string }> = []

    for (const { name, text } of entries) {
      try {
        const cfdi = parseCfdiXml(text)

        if (companyRfc && cfdi.receptor_rfc !== companyRfc) {
          skipped++
          continue
        }

        if (cfdi.tipo_comprobante !== 'P') {
          skipped++
          continue
        }

        if (cfdi.pagos_doctos.length === 0) {
          errors.push({ file: name, message: 'REP sin documentos relacionados' })
          continue
        }

        const row = parsedCfdiToSatRow(cfdi, user.id, source)
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

    const preview = await buildRepPaymentPreview(supabase, parsedRep)

    return NextResponse.json({ imported, skipped, preview, errors })
  } catch (err) {
    console.error('POST /api/ap/sat-pagos-import error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
