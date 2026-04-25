import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { getCertificadosByInstrumento, createCertificado } from '@/services/emaInstrumentoService';
import {
  calibrationCertificateObjectExists,
  createCalibrationCertificateSignedUrl,
  isAppGeneratedCalibrationCertificatePath,
  isSafeCalibrationStoragePath,
  normalizeCalibrationArchivoPath,
} from '@/lib/ema/calibrationCertificateStorage';
import { z } from 'zod';
import { EMA_CERTIFICADO_WRITE_ROLES } from '@/lib/ema/emaCertificadoWriteRoles';
import type { UserRole } from '@/store/auth/types';

const WRITE_ROLES = EMA_CERTIFICADO_WRITE_ROLES;
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

const CondicionesAmbientalesSchema = z.object({
  temperatura: z.string().optional(),
  humedad: z.string().optional(),
  presion: z.string().optional(),
}).optional().nullable();

const CreateCertSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    if (data.fecha_vencimiento < data.fecha_emision) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha de vencimiento debe ser igual o posterior a la fecha de emisión del certificado.',
        path: ['fecha_vencimiento'],
      });
    }
    const u = data.incertidumbre_expandida;
    if (u != null) {
      if (!data.incertidumbre_unidad?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Si indica U, debe especificar la unidad (p. ej. mm, °C, kN).',
          path: ['incertidumbre_unidad'],
        });
      }
      const k = data.factor_cobertura;
      if (k == null || k < 1 || k > 10) {
        ctx.addIssue({
          code: 'custom',
          message: 'Indique el factor de cobertura k (típico 2; valores permitidos entre 1 y 10).',
          path: ['factor_cobertura'],
        });
      }
    }
  });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { searchParams } = new URL(req.url);
    const vigenteParam = searchParams.get('vigente');
    const vigente = vigenteParam === 'true' || vigenteParam === '1';
    const limitRaw = searchParams.get('limit');
    const limitParsed = limitRaw != null ? parseInt(limitRaw, 10) : NaN;
    const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : undefined;

    const certs = await getCertificadosByInstrumento(id, { vigente, limit });
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
    if (!writeRole || !WRITE_ROLES.includes(writeRole as UserRole))
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

    const admin = createServiceClient();
    const { data: instTipo } = await admin.from('instrumentos').select('tipo').eq('id', id).maybeSingle();
    const tipo = (instTipo as { tipo?: string } | null)?.tipo;
    if (tipo === 'A' || tipo === 'B') {
      const u = parsed.data.incertidumbre_expandida;
      const unit = parsed.data.incertidumbre_unidad?.trim();
      const k = parsed.data.factor_cobertura;
      if (u == null || !(u > 0)) {
        return NextResponse.json(
          {
            error:
              'Para instrumentos tipo A o B debe registrar la incertidumbre expandida U del certificado (valor numérico > 0), conforme al reporte de resultados del laboratorio.',
          },
          { status: 400 },
        );
      }
      if (!unit) {
        return NextResponse.json(
          { error: 'Indique la unidad de la incertidumbre U (debe coincidir con el certificado).' },
          { status: 400 },
        );
      }
      if (k == null || k < 1 || k > 10) {
        return NextResponse.json(
          { error: 'Indique el factor de cobertura k del certificado (típico 2; entre 1 y 10).' },
          { status: 400 },
        );
      }
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
