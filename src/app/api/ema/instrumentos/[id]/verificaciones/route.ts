import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getVerificacionesByInstrumento, createVerificacion, getInstrumentoById } from '@/services/emaInstrumentoService';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];
const READ_ROLES = [...WRITE_ROLES, 'ADMIN_OPERATIONS'];

const LecturaSchema = z.object({
  punto: z.string().min(1),
  lectura_maestro: z.number(),
  lectura_trabajo: z.number(),
  desviacion: z.number(),
  unidad: z.string().min(1),
});

const CreateVerifSchema = z.object({
  instrumento_maestro_id: z.string().uuid(),
  fecha_verificacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_proxima_verificacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resultado: z.enum(['conforme', 'no_conforme', 'condicional']),
  lecturas: z.array(LecturaSchema).optional().default([]),
  criterio_aceptacion: z.string().optional().nullable(),
  condiciones_ambientales: z.object({
    temperatura: z.string().optional(),
    humedad: z.string().optional(),
  }).optional().nullable(),
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
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const verifs = await getVerificacionesByInstrumento(id);
    return NextResponse.json({ data: verifs });
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
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Ensure instrument is Type C
    const instrumento = await getInstrumentoById(id);
    if (!instrumento) return NextResponse.json({ error: 'Instrumento no encontrado' }, { status: 404 });
    if (instrumento.tipo !== 'C')
      return NextResponse.json({ error: 'Solo instrumentos Tipo C tienen verificaciones internas' }, { status: 400 });

    const json = await request.json();
    const parsed = CreateVerifSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const verif = await createVerificacion(
      { ...parsed.data, instrumento_id: id } as any,
      user.id,
    );
    return NextResponse.json({ data: verif }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
