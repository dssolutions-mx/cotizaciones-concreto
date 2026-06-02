import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  evidenciaStorageDeleteTargets,
  evidenciaStoragePath,
  evidenciaStorageUploadAttempts,
  isEnsayoImageFile,
  isEnsayoSr3File,
  isStorageNotFoundError,
} from '@/lib/quality/ensayoEvidence'

const NO_STORE = { 'Cache-Control': 'no-store' as const }
const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN']
const MAX_BYTES = 10 * 1024 * 1024

async function uploadToStorage(
  admin: ReturnType<typeof createAdminClientForApi>,
  path: string,
  file: File
): Promise<{ ok: true; dbPath: string } | { ok: false; error: string }> {
  const attempts = evidenciaStorageUploadAttempts(path)

  let lastError = 'No se pudo subir el archivo'
  for (const { bucket, storagePath, dbPath } of attempts) {
    const { error } = await admin.storage.from(bucket).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (!error) {
      return { ok: true, dbPath }
    }
    lastError = error.message || lastError
    const msg = error.message || ''
    if (!isStorageNotFoundError(msg)) {
      return { ok: false, error: msg }
    }
  }
  return { ok: false, error: lastError }
}

async function removeEvidenciaFromStorage(
  admin: ReturnType<typeof createAdminClientForApi>,
  dbPath: string
): Promise<void> {
  for (const { bucket, storagePath } of evidenciaStorageDeleteTargets(dbPath)) {
    const { error } = await admin.storage.from(bucket).remove([storagePath])
    if (!error) return
    if (!isStorageNotFoundError(error.message || '')) {
      console.warn(`[ensayo evidencias DELETE] storage ${bucket}:`, error.message)
    }
  }
}

async function authorizeEvidenciaWrite(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }),
    }
  }

  const { data: profile, error: profileError } = await authClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !WRITE_ROLES.includes(profile.role as string)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403, headers: NO_STORE }
      ),
    }
  }

  if (isUsingFallbackEnv) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500, headers: NO_STORE }
      ),
    }
  }

  return { ok: true, userId: user.id }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ensayoId } = await params
    if (!ensayoId) {
      return NextResponse.json({ error: 'Missing ensayo id' }, { status: 400, headers: NO_STORE })
    }

    const auth = await authorizeEvidenciaWrite()
    if (!auth.ok) return auth.response

    const formData = await request.formData()
    const file = formData.get('file')
    const kindRaw = String(formData.get('kind') || 'photo')
    const kind = kindRaw === 'machine' ? 'machine' : 'photo'

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400, headers: NO_STORE })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo excede ${MAX_BYTES / (1024 * 1024)} MB` },
        { status: 400, headers: NO_STORE }
      )
    }

    if (kind === 'photo' && !isEnsayoImageFile(file)) {
      return NextResponse.json({ error: 'Tipo de imagen no permitido' }, { status: 400, headers: NO_STORE })
    }
    if (kind === 'machine' && !isEnsayoSr3File(file)) {
      return NextResponse.json({ error: 'Solo se permiten archivos .sr3' }, { status: 400, headers: NO_STORE })
    }

    const admin = createAdminClientForApi()
    const { data: ensayo, error: ensayoError } = await admin
      .from('ensayos')
      .select('id')
      .eq('id', ensayoId)
      .maybeSingle()

    if (ensayoError || !ensayo) {
      return NextResponse.json({ error: 'Ensayo no encontrado' }, { status: 404, headers: NO_STORE })
    }

    const storagePath = evidenciaStoragePath(ensayoId, file, kind)
    const uploadResult = await uploadToStorage(admin, storagePath, file)
    if (!uploadResult.ok) {
      console.error('[ensayo evidencias POST] storage:', uploadResult.error)
      return NextResponse.json({ error: uploadResult.error }, { status: 502, headers: NO_STORE })
    }

    const tipoArchivo =
      file.type || (kind === 'machine' ? 'application/octet-stream' : 'image/jpeg')

    const { data: evidencia, error: dbError } = await admin
      .from('evidencias')
      .insert({
        ensayo_id: ensayoId,
        path: uploadResult.dbPath,
        nombre_archivo: file.name,
        tipo_archivo: tipoArchivo,
        tamano_kb: Math.max(1, Math.round(file.size / 1024)),
        created_by: auth.userId,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[ensayo evidencias POST] insert:', dbError)
      return NextResponse.json({ error: 'Error al registrar evidencia' }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ evidencia }, { headers: NO_STORE })
  } catch (e) {
    console.error('[ensayo evidencias POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ensayoId } = await params
    if (!ensayoId) {
      return NextResponse.json({ error: 'Missing ensayo id' }, { status: 400, headers: NO_STORE })
    }

    const evidenciaId = request.nextUrl.searchParams.get('evidencia_id')?.trim()
    if (!evidenciaId) {
      return NextResponse.json({ error: 'Se requiere evidencia_id' }, { status: 400, headers: NO_STORE })
    }

    const auth = await authorizeEvidenciaWrite()
    if (!auth.ok) return auth.response

    const admin = createAdminClientForApi()
    const { data: evidencia, error: findError } = await admin
      .from('evidencias')
      .select('id, path')
      .eq('id', evidenciaId)
      .eq('ensayo_id', ensayoId)
      .maybeSingle()

    if (findError || !evidencia) {
      return NextResponse.json({ error: 'Evidencia no encontrada' }, { status: 404, headers: NO_STORE })
    }

    const dbPath = evidencia.path as string
    if (dbPath) {
      await removeEvidenciaFromStorage(admin, dbPath)
    }

    const { error: deleteError } = await admin.from('evidencias').delete().eq('id', evidenciaId)

    if (deleteError) {
      console.error('[ensayo evidencias DELETE] db:', deleteError)
      return NextResponse.json({ error: 'Error al eliminar evidencia' }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (e) {
    console.error('[ensayo evidencias DELETE]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
