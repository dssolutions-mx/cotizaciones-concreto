import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'ADMIN', 'ADMIN_OPERATIONS'];

async function auth(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null };
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  return { user, profile };
}

const SectionSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  repetible: z.boolean().default(false),
  repeticiones_default: z.number().int().min(1).max(10).default(1),
  orden: z.number().int().optional(),
});

/** POST /api/ema/templates/[id]/sections */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: template_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = SectionSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    // Determine next orden
    let orden = parsed.data.orden;
    if (orden == null) {
      const { count } = await supabase
        .from('verificacion_template_sections')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template_id);
      orden = (count ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from('verificacion_template_sections')
      .insert({
        template_id,
        titulo: parsed.data.titulo,
        descripcion: parsed.data.descripcion ?? null,
        repetible: parsed.data.repetible,
        repeticiones_default: parsed.data.repeticiones_default,
        orden,
        evidencia_config: {},
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: { ...data, items: [] } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
