import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getInstrumentos, createInstrumento } from '@/services/emaInstrumentoService';
import { EMA_INSTRUMENTO_MAESTRO_IDS_MAX, type CreateInstrumentoInput } from '@/types/ema';
import { z } from 'zod';

const MANAGER_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', ...MANAGER_ROLES];

const mesSchema = z.number().int().min(1).max(12).optional().nullable();

const CreateInstrumentoSchema = z.object({
  // `codigo` is server-generated via ema_next_instrument_code — never accepted from client.
  nombre: z.string().min(1).max(200),
  conjunto_id: z.string().uuid(),
  tipo: z.enum(['A', 'B', 'C']),
  plant_id: z.string().uuid(),
  numero_serie: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
  modelo_comercial: z.string().optional().nullable(),
  instrumento_maestro_ids: z.array(z.string().uuid()).max(EMA_INSTRUMENTO_MAESTRO_IDS_MAX).optional(),
  mes_inicio_servicio_override: mesSchema,
  mes_fin_servicio_override: mesSchema,
  ubicacion_dentro_planta: z.string().optional().nullable(),
  fecha_alta: z.string().optional().nullable(),
  fecha_baja: z.string().optional().nullable(),
  baja_observaciones: z.string().optional().nullable(),
  fecha_proximo_evento: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role, plant_id').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const instrumentos = await getInstrumentos({
      plant_id: searchParams.get('plant_id') ?? undefined,
      tipo: searchParams.get('tipo') as any ?? undefined,
      estado: searchParams.get('estado') as any ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      conjunto_id: searchParams.get('conjunto_id') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '200'),
    });

    return NextResponse.json({ data: instrumentos });
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
    const parsed = CreateInstrumentoSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const instrumento = await createInstrumento(parsed.data as CreateInstrumentoInput, user.id);
    return NextResponse.json({ data: instrumento }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
