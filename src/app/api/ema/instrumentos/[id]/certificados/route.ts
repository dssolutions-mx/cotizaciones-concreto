import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCertificadosByInstrumento, createCertificado } from '@/services/emaInstrumentoService';
import {
  calibrationCertificateObjectExists,
  createCalibrationCertificateSignedUrl,
  isAppGeneratedCalibrationCertificatePath,
  isSafeCalibrationStoragePath,
  normalizeCalibrationArchivoPath,
} from '@/lib/ema/calibrationCertificateStorage';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

const CondicionesAmbientalesSchema = z.object({
  temperatura: z.string().optional(),
  humedad: z.string().optional(),
  presion: z.string().optional(),
}).optional().nullable();

const CreateCertSchema = z.object({
  numero_certificado: z.string().optional().nullable(),
  laboratorio_externo: z.string().min(1),
  acreditacion_laboratorio: z.string().optional().nullable(),
  metodo_calibracion: z.string().optional().nullable(),
  fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  archivo_path: z.string().min(1),
  archivo_nombre_original: z.string().max(512).optional().nullable(),
  incertidumbre_expandida: z.number().positive().optional().nullable(),
  incertidumbre_unidad: z.string().optional().nullable(),
  factor_cobertura: z.number().positive().optional().nullable(),
  rango_medicion: z.string().optional().nullable(),
  condiciones_ambientales: CondicionesAmbientalesSchema,
  tecnico_responsable: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const readRole = (profile as { role: string } | null)?.role;
    if (!readRole || !READ_ROLES.includes(readRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const certs = await getCertificadosByInstrumento(id);
    const withPdf = await Promise.all(
      certs.map(async (c) => {
        const pdf_url = await createCalibrationCertificateSignedUrl(supabase, c.archivo_path, 3600);
        return { ...c, pdf_url };
      }),
    );
    return NextResponse.json({ data: withPdf });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const writeRole = (profile as { role: string } | null)?.role;
    if (!writeRole || !WRITE_ROLES.includes(writeRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = CreateCertSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const archivoNorm = normalizeCalibrationArchivoPath(parsed.data.archivo_path);
    if (!archivoNorm || !isSafeCalibrationStoragePath(archivoNorm)) {
      return NextResponse.json(
        { error: 'La ruta del archivo no es válida. Use únicamente «Subir PDF» en la aplicación.' },
        { status: 400 },
      );
    }
    if (!isAppGeneratedCalibrationCertificatePath(id, archivoNorm)) {
      return NextResponse.json(
        {
          error:
            'Solo se aceptan PDF subidos desde esta pantalla (botón Subir PDF). No se permiten rutas escritas a mano ni pegadas desde el panel de administración.',
        },
        { status: 400 },
      );
    }
    const exists = await calibrationCertificateObjectExists(supabase, archivoNorm);
    if (!exists) {
      return NextResponse.json(
        {
          error:
            'No se encontró el PDF adjunto. Suba de nuevo el archivo con «Subir PDF» y vuelva a intentar.',
        },
        { status: 400 },
      );
    }

    const cert = await createCertificado(
      { ...parsed.data, archivo_path: archivoNorm, instrumento_id: id } as any,
      user.id,
    );
    return NextResponse.json({ data: cert }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
