import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getConjuntos, getConjuntosWithListCounts, createConjunto } from '@/services/emaInstrumentoService';
import { z } from 'zod';

const MANAGER_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', ...MANAGER_ROLES];

const mes = z.number().int().min(1).max(12).optional().nullable();

const CreateConjuntoSchema = z.object({
  codigo_conjunto: z.string().regex(/^[0-9]{2,3}$/, 'Debe ser NN o NNN (2-3 dígitos)'),
  nombre_conjunto: z.string().min(1).max(200),
  categoria: z.string().min(1).max(100),
  tipo_defecto: z.enum(['A', 'B', 'C']),
  tipo_servicio: z.enum(['calibracion', 'verificacion', 'ninguno']),
  mes_inicio_servicio: mes,
  mes_fin_servicio: mes,
  cadencia_meses: z.number().int().positive().default(12),
  norma_referencia: z.string().optional().nullable(),
  unidad_medicion: z.string().optional().nullable(),
  rango_medicion_tipico: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  business_unit_id: z.string().uuid().optional().nullable(),
  manual_path: z.string().optional().nullable(),
  instrucciones_path: z.string().optional().nullable(),
  documentos_adicionales: z.array(z.object({ nombre: z.string(), path: z.string() })).optional(),
  is_active: z.boolean().optional(),
}).refine((v) => v.tipo_servicio === 'ninguno' || (v.mes_inicio_servicio && v.mes_fin_servicio), {
  message: 'mes_inicio_servicio y mes_fin_servicio son requeridos cuando tipo_servicio ≠ ninguno',
  path: ['mes_fin_servicio'],
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
    const params = {
      business_unit_id: searchParams.get('business_unit_id') ?? undefined,
      is_active: searchParams.get('is_active') === 'false' ? false : true,
    };
    const conjuntos =
      searchParams.get('with_counts') === '1'
        ? await getConjuntosWithListCounts(params)
        : await getConjuntos(params);

    return NextResponse.json({ data: conjuntos });
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
    const parsed = CreateConjuntoSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const conjunto = await createConjunto(parsed.data as any, user.id);
    return NextResponse.json({ data: conjunto }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
