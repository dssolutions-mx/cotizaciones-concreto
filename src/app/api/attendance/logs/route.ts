import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServerClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function POST(request: Request) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: userData, error: userErr } = await serverClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const supabase = getServerClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const selectedDate = formData.get('selected_date') as string | null
    const plantId = formData.get('plant_id') as string | null
    const attestationText = formData.get('attestation_text') as string | null
    const attestationHash = formData.get('attestation_hash') as string | null

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    if (!selectedDate) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })
    if (!attestationText || !attestationHash) return NextResponse.json({ error: 'Atestación requerida' }, { status: 400 })

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo supera 10MB' }, { status: 400 })
    }

    const allowed = new Set([
      'text/csv',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])
    const nameLower = (file.name || '').toLowerCase()
    const extAllowed = ['.csv', '.pdf', '.jpg', '.jpeg', '.png', '.xls', '.xlsx', '.xlsm', '.xlsb']
    const hasAllowedExt = extAllowed.some(ext => nameLower.endsWith(ext))
    if (!allowed.has(file.type) && !hasAllowedExt) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    const timestamp = Date.now()
    const originalName = file.name
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin'
    const folder = `${plantId || 'general'}/daily_logs`
    const fileName = `${timestamp}_${Math.random().toString(36).slice(2)}.${ext}`
    const filePath = `${folder}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('attendance-logs')
      .upload(filePath, bytes, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Error subiendo archivo', details: uploadError.message }, { status: 500 })
    }

    const uploadedBy: string = userData.user.id

    const { data: insertData, error: insertError } = await supabase
      .from('attendance_log_uploads')
      .insert({
        plant_id: plantId || null,
        selected_date: selectedDate,
        file_name: fileName,
        original_name: originalName,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: uploadedBy,
        attested_by: uploadedBy,
        attestation_text: attestationText,
        attestation_hash: attestationHash,
        attested_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      // Best-effort cleanup in storage
      await supabase.storage.from('attendance-logs').remove([filePath])
      return NextResponse.json({ error: 'Error registrando metadata', details: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ data: insertData })
  } catch (error: any) {
    return NextResponse.json({ error: 'Error inesperado', details: String(error?.message || error) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: userData, error: userErr } = await serverClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const supabase = getServerClient()
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '50')
    const selectedDate = searchParams.get('selected_date')
    const plantId = searchParams.get('plant_id')
    const search = searchParams.get('search')

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase.from('v_attendance_log_uploads').select('*', { count: 'exact' })
    if (selectedDate) query = query.eq('selected_date', selectedDate)
    if (plantId) query = query.eq('plant_id', plantId)
    if (search) query = query.ilike('original_name', `%${search}%`)

    query = query.order('uploaded_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ error: 'Error obteniendo lista', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Error inesperado', details: String(error?.message || error) }, { status: 500 })
  }
}

// DELETE is intentionally disabled for audit integrity
export async function DELETE() {
  return NextResponse.json({ error: 'Eliminación no permitida' }, { status: 405 })
}


