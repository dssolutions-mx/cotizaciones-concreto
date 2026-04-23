import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { data: template, error: tErr } = await supabase
      .from('verificacion_templates')
      .select('id, codigo, nombre, norma_referencia, descripcion, estado, active_version_id, created_at, updated_at')
      .eq('conjunto_id', id)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!template) return NextResponse.json({ data: null });

    // Get active version metadata separately
    let active_version = null;
    if (template.active_version_id) {
      const { data: ver } = await supabase
        .from('verificacion_template_versions')
        .select('id, version_number, published_at')
        .eq('id', template.active_version_id)
        .single();
      active_version = ver;
    }

    // Count total items across draft sections
    const { count: items_count } = await supabase
      .from('verificacion_template_items')
      .select('id', { count: 'exact', head: true })
      .in(
        'section_id',
        (await supabase
          .from('verificacion_template_sections')
          .select('id')
          .eq('template_id', template.id)
        ).data?.map((s: { id: string }) => s.id) ?? []
      );

    return NextResponse.json({
      data: { ...template, active_version, items_count: items_count ?? 0 },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
