import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { VerificacionTemplateSnapshot } from '@/types/ema';
import { validateTemplateForPublish } from '@/lib/ema/templateValidate';
import type { Json } from '@/types/database.types.generated';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

/** POST /api/ema/templates/[id]/publish — snapshot draft → new version, set active */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: template_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Load template
    const { data: template, error: tErr } = await supabase
      .from('verificacion_templates')
      .select('*')
      .eq('id', template_id)
      .single();
    if (tErr || !template) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    if (template.estado === 'archivado')
      return NextResponse.json({ error: 'La plantilla está archivada' }, { status: 400 });

    // Load draft sections + items
    const { data: sections, error: sErr } = await supabase
      .from('verificacion_template_sections')
      .select('*')
      .eq('template_id', template_id)
      .order('orden');
    if (sErr) throw sErr;
    if (!sections || sections.length === 0)
      return NextResponse.json({ error: 'La plantilla no tiene secciones' }, { status: 400 });

    const sectionsWithItems = await Promise.all(
      sections.map(async (sec: any) => {
        const { data: items } = await supabase
          .from('verificacion_template_items')
          .select('*')
          .eq('section_id', sec.id)
          .order('orden');
        return { ...sec, items: items ?? [] };
      })
    );

    const { data: headerFields } = await supabase
      .from('verificacion_template_header_fields')
      .select('*')
      .eq('template_id', template_id)
      .order('orden');

    // Determine next version number
    const { count } = await supabase
      .from('verificacion_template_versions')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', template_id);
    const version_number = (count ?? 0) + 1;

    // Build snapshot
    const snapshot: VerificacionTemplateSnapshot = {
      template: {
        id: template.id,
        codigo: template.codigo,
        nombre: template.nombre,
        norma_referencia: template.norma_referencia,
        descripcion: template.descripcion,
      },
      sections: sectionsWithItems,
      ...(headerFields?.length ? { header_fields: headerFields as VerificacionTemplateSnapshot['header_fields'] } : {}),
    };

    const validation = validateTemplateForPublish(snapshot);
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'La plantilla no cumple validación', details: validation.errors },
        { status: 400 },
      );
    }

    // Insert version
    const { data: version, error: vErr } = await supabase
      .from('verificacion_template_versions')
      .insert({
        template_id,
        version_number,
        snapshot: snapshot as unknown as Json,
        published_by: user.id,
      })
      .select()
      .single();
    if (vErr) throw vErr;

    // Update template: set active_version_id + estado
    const { data: updated, error: uErr } = await supabase
      .from('verificacion_templates')
      .update({
        active_version_id: version.id,
        estado: 'publicado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', template_id)
      .select()
      .single();
    if (uErr) throw uErr;

    return NextResponse.json({ data: { version, template: updated } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
