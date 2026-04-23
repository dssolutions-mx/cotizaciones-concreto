import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  CALIBRATION_CERTIFICATES_BUCKET,
  normalizeCalibrationArchivoPath,
} from '@/lib/ema/calibrationCertificateStorage';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

const MAX_BYTES = 10 * 1024 * 1024;

/** Browsers / OS often send empty type or octet-stream for PDFs; trust extension + magic bytes. */
function isAcceptableCalibrationPdf(file: File): boolean {
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.pdf')) return false;
  const t = (file.type || '').toLowerCase();
  if (
    t === 'application/pdf' ||
    t === 'application/x-pdf' ||
    t === 'application/acrobat' ||
    t === 'applications/vnd.pdf' ||
    t === 'text/pdf' ||
    t === 'application/octet-stream' ||
    t === ''
  ) {
    return true;
  }
  return false;
}

async function fileHeaderIsPdf(file: File): Promise<boolean> {
  try {
    const buf = await file.slice(0, 5).arrayBuffer();
    const u = new Uint8Array(buf);
    if (u.length < 4) return false;
    return u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: instrumentoId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const role = (profile as { role: string } | null)?.role;
    if (!role || !WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { data: inst, error: instError } = await supabase
      .from('instrumentos')
      .select('id')
      .eq('id', instrumentoId)
      .maybeSingle();
    if (instError || !inst) {
      return NextResponse.json({ error: 'Instrumento no encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Archivo es requerido' }, { status: 400 });
    }
    if (!isAcceptableCalibrationPdf(file)) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF (.pdf). Si su archivo es PDF, renómbrelo con extensión .pdf.' },
        { status: 400 },
      );
    }
    if (!(await fileHeaderIsPdf(file))) {
      return NextResponse.json(
        { error: 'El archivo no es un PDF válido (cabecera %PDF no detectada).' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 10MB' }, { status: 400 });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 12);
    const objectKey = `${instrumentoId}/certificados/${timestamp}_${randomString}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(CALIBRATION_CERTIFICATES_BUCKET)
      .upload(objectKey, file, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('EMA calibration upload error:', uploadError);
      return NextResponse.json(
        { error: `Error al subir certificado: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const normalized = normalizeCalibrationArchivoPath(objectKey);
    return NextResponse.json({
      data: {
        archivo_path: normalized,
        original_name: file.name || null,
      },
      message: 'PDF subido correctamente',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
