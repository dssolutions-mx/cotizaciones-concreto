import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'ADMIN', 'ADMIN_OPERATIONS'];

async function auth(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null };
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  return { user, profile };
}

/** GET /api/ema/templates/[id] — full template with draft sections + items */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { profile } = await auth(supabase);
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { data: template, error: tErr } = await supabase
      .from('verificacion_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (tErr || !template) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { data: sections, error: sErr } = await supabase
      .from('verificacion_template_sections')
      .select('*')
      .eq('template_id', id)
      .order('orden');
    if (sErr) throw sErr;

    const sectionsWithItems = await Promise.all(
      (sections ?? []).map(async (sec: any) => {
        const { data: items } = await supabase
          .from('verificacion_template_items')
          .select('*')
          .eq('section_id', sec.id)
          .order('orden');
        return { ...sec, items: items ?? [] };
      })
    );

    let active_version = null;
    if (template.active_version_id) {
      const { data: ver } = await supabase
        .from('verificacion_template_versions')
        .select('id, version_number, published_at, snapshot')
        .eq('id', template.active_version_id)
        .single();
      active_version = ver;
    }

    const { count: versions_count } = await supabase
      .from('verificacion_template_versions')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', id);

    return NextResponse.json({
      data: { ...template, sections: sectionsWithItems, active_version, versions_count: versions_count ?? 0 },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const UpdateTemplateSchema = z.object({
  nombre: z.string().min(1).optional(),
  norma_referencia: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  estado: z.enum(['borrador', 'publicado', 'archivado']).optional(),
});

/** PATCH /api/ema/templates/[id] — update template metadata */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = UpdateTemplateSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { data, error } = await supabase
      .from('verificacion_templates')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
