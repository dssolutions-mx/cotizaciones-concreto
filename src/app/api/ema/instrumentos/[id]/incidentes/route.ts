import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getIncidentesByInstrumento,
  createIncidente,
  resolverIncidente,
} from '@/services/emaInstrumentoService';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];
const READ_ROLES = [...WRITE_ROLES, 'ADMIN_OPERATIONS'];

const CreateIncidenteSchema = z.object({
  tipo: z.enum(['dano_fisico', 'perdida', 'mal_funcionamiento', 'desviacion_lectura', 'otro']),
  severidad: z.enum(['baja', 'media', 'alta', 'critica']),
  descripcion: z.string().min(1),
  fecha_incidente: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  evidencia_paths: z.array(z.string()).optional(),
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

    const incidentes = await getIncidentesByInstrumento(params.id);
    return NextResponse.json({ data: incidentes });
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

    // Special action: resolve incident
    if (json.action === 'resolver') {
      if (!json.resolucion) return NextResponse.json({ error: 'Resolución requerida' }, { status: 400 });
      const resolved = await resolverIncidente(json.incidente_id, json.resolucion, user.id);
      return NextResponse.json({ data: resolved });
    }

    const parsed = CreateIncidenteSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const incidente = await createIncidente(
      { ...parsed.data, instrumento_id: params.id } as any,
      user.id,
    );
    return NextResponse.json({ data: incidente }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
