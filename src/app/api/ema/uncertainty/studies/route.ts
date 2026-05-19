import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listStudies, createStudy } from '@/services/emaUncertaintyService';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

const CreateStudySchema = z.object({
  measurand_id: z.string().uuid(),
  plant_id: z.string().uuid().nullable().optional(),
  fecha_estudio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const measurandId = request.nextUrl.searchParams.get('measurand_id') ?? undefined;
    const studies = await listStudies(measurandId);
    return NextResponse.json({ data: studies });
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/studies]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
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

    const body = await request.json();
    const parsed = CreateStudySchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    const study = await createStudy(parsed.data);
    return NextResponse.json(study, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ema/uncertainty/studies]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
