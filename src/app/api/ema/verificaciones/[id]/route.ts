import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];
const READ_ROLES = [...WRITE_ROLES, 'ADMIN_OPERATIONS'];

const PatchSchema = z.object({
  resultado: z.enum(['conforme', 'no_conforme', 'condicional', 'pendiente']).optional(),
  fecha_proxima_verificacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  condiciones_ambientales: z.object({
    temperatura: z.string().optional(),
    humedad: z.string().optional(),
    lugar: z.string().optional(),
  }).nullable().optional(),
  observaciones_generales: z.string().nullable().optional(),
  instrumento_maestro_id: z.string().uuid().nullable().optional(),
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

    const admin = createServiceClient();
    const { data: verif, error: vErr } = await admin
      .from('completed_verificaciones')
      .select('*')
      .eq('id', id)
      .single();
    if (vErr || !verif) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Load snapshot from template version
    const { data: version } = await admin
      .from('verificacion_template_versions')
      .select('version_number, snapshot, published_at')
      .eq('id', verif.template_version_id)
      .single();

    // Load measurements
    const { data: measurements } = await admin
      .from('completed_verificacion_measurements')
      .select('*')
      .eq('completed_id', id)
      .order('section_repeticion');

    // Load instrument info
    const { data: instrumento } = await admin
      .from('instrumentos')
      .select('id, codigo, nombre, tipo, estado, conjunto_id')
      .eq('id', verif.instrumento_id)
      .single();

    // Load creator profile
    let created_by_profile = null;
    if (verif.created_by) {
      const { data: cp } = await admin
        .from('user_profiles')
        .select('id, full_name')
        .eq('id', verif.created_by)
        .single();
      created_by_profile = cp;
    }

    return NextResponse.json({
      data: {
        ...verif,
        snapshot: version?.snapshot ?? null,
        template_version_number: version?.version_number ?? null,
        measurements: measurements ?? [],
        evidencias: [],
        signatures: [],
        issues: [],
        instrumento,
        created_by_profile,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const admin = createServiceClient();
    const { data: updated, error: uErr } = await admin
      .from('completed_verificaciones')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, resultado, estado, fecha_proxima_verificacion, condiciones_ambientales, observaciones_generales')
      .single();

    if (uErr) throw uErr;
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
