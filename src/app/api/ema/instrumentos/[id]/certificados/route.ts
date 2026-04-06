import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCertificadosByInstrumento, createCertificado } from '@/services/emaInstrumentoService';
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
  incertidumbre_expandida: z.number().positive().optional().nullable(),
  incertidumbre_unidad: z.string().optional().nullable(),
  factor_cobertura: z.number().positive().optional().nullable(),
  rango_medicion: z.string().optional().nullable(),
  condiciones_ambientales: CondicionesAmbientalesSchema,
  tecnico_responsable: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const certs = await getCertificadosByInstrumento(params.id);
    return NextResponse.json({ data: certs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = CreateCertSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const cert = await createCertificado(
      { ...parsed.data, instrumento_id: params.id } as any,
      user.id,
    );
    return NextResponse.json({ data: cert }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
