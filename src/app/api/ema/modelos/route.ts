import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getModelos, createModelo } from '@/services/emaInstrumentoService';
import { z } from 'zod';

const MANAGER_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', ...MANAGER_ROLES];

const CreateModeloSchema = z.object({
  nombre_modelo: z.string().min(1).max(200),
  categoria: z.string().min(1).max(100),
  tipo_defecto: z.enum(['A', 'B', 'C']),
  periodo_calibracion_dias: z.number().int().positive(),
  norma_referencia: z.string().optional().nullable(),
  unidad_medicion: z.string().optional().nullable(),
  rango_medicion_tipico: z.string().optional().nullable(),
  descripcion: z.string().optional(),
  business_unit_id: z.string().uuid().optional().nullable(),
  manual_path: z.string().optional().nullable(),
  instrucciones_path: z.string().optional().nullable(),
  documentos_adicionales: z.array(z.object({ nombre: z.string(), path: z.string() })).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const modelos = await getModelos({
      business_unit_id: searchParams.get('business_unit_id') ?? undefined,
      is_active: searchParams.get('is_active') === 'false' ? false : true,
    });

    return NextResponse.json({ data: modelos });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !MANAGER_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = CreateModeloSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const modelo = await createModelo(parsed.data as any, user.id);
    return NextResponse.json({ data: modelo }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
