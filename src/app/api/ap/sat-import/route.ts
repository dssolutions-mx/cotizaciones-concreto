import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import JSZip from 'jszip'

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
    const zipFile = form.get('zip_file')
    const xmlFile = form.get('xml_file')

    if (!zipFile && !xmlFile) {
      return NextResponse.json({ error: 'Se requiere zip_file o xml_file' }, { status: 400 })
    }

    // Collect (filename, xmlText) pairs to process
    const entries: Array<{ name: string; text: string }> = []

    if (zipFile instanceof File) {
      const buffer = await zipFile.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      for (const [name, entry] of Object.entries(zip.files)) {
        if (!name.toLowerCase().endsWith('.xml') || entry.dir) continue
        const text = await entry.async('string')
        entries.push({ name, text })
      }
    } else if (xmlFile instanceof File) {
      entries.push({ name: xmlFile.name, text: await xmlFile.text() })
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No se encontraron archivos XML en el ZIP' }, { status: 400 })
    }

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

        const row = {
          uuid: cfdi.uuid,
          receptor_rfc: cfdi.receptor_rfc,
          emisor_rfc: cfdi.emisor_rfc,
          emisor_nombre: cfdi.emisor_nombre,
          serie: cfdi.serie,
          folio: cfdi.folio,
          fecha_emision: cfdi.fecha_emision,
          fecha_timbrado: cfdi.fecha_timbrado,
          tipo_comprobante: cfdi.tipo_comprobante,
          subtotal: cfdi.subtotal,
          descuento: cfdi.descuento,
          total: cfdi.total,
          iva_trasladado: cfdi.iva_trasladado,
          isr_retenido: cfdi.isr_retenido,
          iva_retenido: cfdi.iva_retenido,
          metodo_pago: cfdi.metodo_pago,
          forma_pago: cfdi.forma_pago,
          uso_cfdi: cfdi.uso_cfdi,
          moneda: cfdi.moneda,
          tipo_cambio: cfdi.tipo_cambio,
          cfdi_relacionados: cfdi.cfdi_relacionados.length > 0 ? cfdi.cfdi_relacionados : null,
          pagos_doctos: cfdi.pagos_doctos.length > 0 ? cfdi.pagos_doctos : null,
          estado_sat: 'vigente',
          imported_by: user.id,
          source: zipFile instanceof File ? 'manual_zip' : 'manual_xml',
        }

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
