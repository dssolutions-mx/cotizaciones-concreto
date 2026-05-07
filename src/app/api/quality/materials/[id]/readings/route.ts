import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

async function assertQualityRole(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  if (!supabase) throw new Error('no client')
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['QUALITY_TEAM', 'EXECUTIVE'].includes(profile.role)) return null
  return user
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createServerSupabaseClient()
    if (!supabase) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { id: materialId } = await params
    const user = await assertQualityRole(supabase)
    if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { data: material } = await supabase
      .from('materials')
      .select('id, category, plant_id')
      .eq('id', materialId)
      .single()
    if (!material) return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    // Parse reading fields
    const readingDate = formData.get('reading_date') as string
    const lote = formData.get('lote') as string | null
    const tecnico = formData.get('tecnico') as string | null
    const notes = formData.get('notes') as string | null
    const plantId = (formData.get('plant_id') as string | null) ?? material.plant_id

    const toNum = (key: string) => {
      const v = formData.get(key)
      return v != null && v !== '' ? parseFloat(v as string) : null
    }
    const toInt = (key: string) => {
      const v = formData.get(key)
      return v != null && v !== '' ? parseInt(v as string, 10) : null
    }

    if (!readingDate) {
      return NextResponse.json({ error: 'Fecha de lectura requerida' }, { status: 400 })
    }

    // Cemento and aditivo require a certificate
    if (['cemento', 'aditivo'].includes(material.category) && !file) {
      return NextResponse.json({ error: 'Certificado PDF requerido para este material' }, { status: 400 })
    }

    let certificateId: string | null = null

    if (file) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 })
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'El archivo excede 10MB' }, { status: 400 })
      }

      const timestamp = Date.now()
      const rand = Math.random().toString(36).substring(2, 10)
      const fileName = `${plantId ?? 'general'}/certificates/${materialId}_${timestamp}_${rand}.pdf`

      const { error: uploadError } = await supabase.storage
        .from('material-certificates')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        return NextResponse.json({ error: `Error al subir PDF: ${uploadError.message}` }, { status: 500 })
      }

      const { data: certRecord, error: certErr } = await supabase
        .from('material_certificates')
        .insert({
          material_id: materialId,
          file_name: fileName,
          original_name: file.name,
          file_path: fileName,
          file_size: file.size,
          certificate_type: 'lectura_propiedad',
          notes: notes ?? null,
          uploaded_by: user.id,
        })
        .select('id')
        .single()

      if (certErr || !certRecord) {
        // Clean up uploaded file
        await supabase.storage.from('material-certificates').remove([fileName])
        return NextResponse.json({ error: 'Error al guardar certificado' }, { status: 500 })
      }
      certificateId = certRecord.id
    }

    const { data: reading, error: insertErr } = await supabase
      .from('material_property_readings')
      .insert({
        material_id: materialId,
        plant_id: plantId,
        reading_date: readingDate,
        // Cemento
        resistencia_compresion: toNum('resistencia_compresion'),
        tiempo_fraguado_inicial: toInt('tiempo_fraguado_inicial'),
        tiempo_fraguado_final: toInt('tiempo_fraguado_final'),
        // Aditivo
        ph: toNum('ph'),
        densidad_aditivo: toNum('densidad_aditivo'),
        // Agregados
        peso_volumetrico_suelto: toNum('peso_volumetrico_suelto'),
        peso_volumetrico_compactado: toNum('peso_volumetrico_compactado'),
        densidad_agregado: toNum('densidad_agregado'),
        absorcion: toNum('absorcion'),
        modulo_finura: toNum('modulo_finura'),
        perdida_lavado: toNum('perdida_lavado'),
        // Metadata
        source: 'manual',
        certificate_id: certificateId,
        lote: lote || null,
        tecnico: tecnico || null,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertErr) {
      // Clean up certificate if reading insert fails
      if (certificateId) {
        await supabase.from('material_certificates').delete().eq('id', certificateId)
      }
      return NextResponse.json({ error: `Error al guardar lectura: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, reading })
  } catch (err) {
    console.error('[readings POST]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createServerSupabaseClient()
    if (!supabase) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { id: materialId } = await params
    const user = await assertQualityRole(supabase)
    if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const readingId = searchParams.get('reading_id')
    if (!readingId) return NextResponse.json({ error: 'reading_id requerido' }, { status: 400 })

    const { data: reading } = await supabase
      .from('material_property_readings')
      .select('id, certificate_id, source, material_id, certificate:certificate_id(file_path)')
      .eq('id', readingId)
      .eq('material_id', materialId)
      .single()

    if (!reading) return NextResponse.json({ error: 'Lectura no encontrada' }, { status: 404 })
    if (reading.source !== 'manual') {
      return NextResponse.json({ error: 'Solo se pueden eliminar lecturas manuales' }, { status: 400 })
    }

    const { error: delErr } = await supabase
      .from('material_property_readings')
      .delete()
      .eq('id', readingId)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Clean up certificate file if exists
    if (reading.certificate_id) {
      const cert = reading.certificate as { file_path?: string } | null
      if (cert?.file_path) {
        await supabase.storage.from('material-certificates').remove([cert.file_path])
      }
      await supabase.from('material_certificates').delete().eq('id', reading.certificate_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[readings DELETE]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
