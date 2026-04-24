import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EMA_CERTIFICADO_WRITE_ROLES } from '@/lib/ema/emaCertificadoWriteRoles'
import type { UserRole } from '@/store/auth/types'
import { updateCertificadoDocumento } from '@/services/emaInstrumentoService'
import {
  calibrationCertificateObjectExists,
  createCalibrationCertificateSignedUrl,
  isAppGeneratedCalibrationCertificatePath,
  isSafeCalibrationStoragePath,
  normalizeCalibrationArchivoPath,
} from '@/lib/ema/calibrationCertificateStorage'
import { z } from 'zod'

const PatchDocumentSchema = z.object({
  archivo_path: z.string().min(1),
  archivo_nombre_original: z.string().max(512).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> },
) {
  try {
    const { id: instrumentoId, certId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    const writeRole = (profile as { role: string } | null)?.role
    if (!writeRole || !EMA_CERTIFICADO_WRITE_ROLES.includes(writeRole as UserRole)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const json = await request.json()
    const parsed = PatchDocumentSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const archivoNorm = normalizeCalibrationArchivoPath(parsed.data.archivo_path)
    if (!archivoNorm || !isSafeCalibrationStoragePath(archivoNorm)) {
      return NextResponse.json(
        { error: 'La ruta del archivo no es válida. Use únicamente «Subir PDF» en la aplicación.' },
        { status: 400 },
      )
    }
    if (!isAppGeneratedCalibrationCertificatePath(instrumentoId, archivoNorm)) {
      return NextResponse.json(
        {
          error:
            'Solo se aceptan PDF subidos desde la pantalla (botón Subir PDF). No se permiten rutas escritas a mano.',
        },
        { status: 400 },
      )
    }
    const exists = await calibrationCertificateObjectExists(supabase, archivoNorm)
    if (!exists) {
      return NextResponse.json(
        {
          error: 'No se encontró el PDF en almacén. Suba de nuevo el archivo e intente otra vez.',
        },
        { status: 400 },
      )
    }

    const cert = await updateCertificadoDocumento(instrumentoId, certId, {
      archivo_path: archivoNorm,
      archivo_nombre_original: parsed.data.archivo_nombre_original?.trim() || null,
    })
    if (!cert) {
      return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 })
    }
    const pdf_url = await createCalibrationCertificateSignedUrl(supabase, cert.archivo_path, 3600)
    return NextResponse.json({ data: { ...cert, pdf_url } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
