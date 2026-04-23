import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

async function getAuthAndRole(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null };
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  return { user, profile };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { profile } = await getAuthAndRole(supabase);
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { data: template, error: tErr } = await supabase
      .from('verificacion_templates')
      .select('id, codigo, nombre, norma_referencia, descripcion, estado, active_version_id, created_at, updated_at')
      .eq('conjunto_id', id)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!template) return NextResponse.json({ data: null });

    let active_version = null;
    if (template.active_version_id) {
      const { data: ver } = await supabase
        .from('verificacion_template_versions')
        .select('id, version_number, published_at')
        .eq('id', template.active_version_id)
        .single();
      active_version = ver;
    }

    const sectionsRes = await supabase
      .from('verificacion_template_sections')
      .select('id')
      .eq('template_id', template.id);

    const sectionIds = sectionsRes.data?.map((s: { id: string }) => s.id) ?? [];
    let items_count = 0;
    if (sectionIds.length > 0) {
      const { count } = await supabase
        .from('verificacion_template_items')
        .select('id', { count: 'exact', head: true })
        .in('section_id', sectionIds);
      items_count = count ?? 0;
    }

    return NextResponse.json({ data: { ...template, active_version, items_count } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const CreateTemplateSchema = z.object({
  codigo: z.string().min(1).max(40),
  nombre: z.string().min(1),
  norma_referencia: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: conjunto_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await getAuthAndRole(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = CreateTemplateSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    // Only one template per conjunto
    const { data: existing } = await supabase
      .from('verificacion_templates')
      .select('id')
      .eq('conjunto_id', conjunto_id)
      .maybeSingle();
    if (existing)
      return NextResponse.json({ error: 'El conjunto ya tiene una plantilla' }, { status: 409 });

    const { data, error } = await supabase
      .from('verificacion_templates')
      .insert({
        conjunto_id,
        codigo: parsed.data.codigo,
        nombre: parsed.data.nombre,
        norma_referencia: parsed.data.norma_referencia ?? null,
        descripcion: parsed.data.descripcion ?? null,
        estado: 'borrador',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
