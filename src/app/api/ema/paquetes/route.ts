import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPaquetes, createPaquete } from '@/services/emaInstrumentoService';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const READ_ROLES = ['LABORATORY', ...WRITE_ROLES];

const CreatePaqueteSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional().nullable(),
  tipo_prueba: z.string().optional().nullable(),
  business_unit_id: z.string().uuid().optional().nullable(),
  plant_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  instrumentos: z.array(z.object({
    instrumento_id: z.string().uuid(),
    orden: z.number().int().optional(),
    is_required: z.boolean().optional(),
  })).optional(),
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
    const paquetes = await getPaquetes({
      plant_id: searchParams.get('plant_id') ?? undefined,
      business_unit_id: searchParams.get('business_unit_id') ?? undefined,
      is_active: searchParams.get('is_active') !== 'false',
    });

    return NextResponse.json({ data: paquetes });
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
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = CreatePaqueteSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { instrumentos, ...paqueteData } = parsed.data;
    const paquete = await createPaquete(paqueteData as any, instrumentos ?? [], user.id);
    return NextResponse.json({ data: paquete }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
