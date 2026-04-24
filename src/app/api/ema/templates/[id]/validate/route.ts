import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { VerificacionTemplateSnapshot } from '@/types/ema';
import { validateTemplateForPublish } from '@/lib/ema/templateValidate';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

/** POST /api/ema/templates/[id]/validate — dry-run publish validation on current draft */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: template_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { data: template, error: tErr } = await supabase
      .from('verificacion_templates')
      .select('id, codigo, nombre, norma_referencia, descripcion')
      .eq('id', template_id)
      .single();
    if (tErr || !template) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { data: sections } = await supabase
      .from('verificacion_template_sections')
      .select('*')
      .eq('template_id', template_id)
      .order('orden');

    const sectionsWithItems = await Promise.all(
      (sections ?? []).map(async (sec: any) => {
        const { data: items } = await supabase
          .from('verificacion_template_items')
          .select('*')
          .eq('section_id', sec.id)
          .order('orden');
        return { ...sec, items: items ?? [] };
      }),
    );

    const { data: headerFields } = await supabase
      .from('verificacion_template_header_fields')
      .select('*')
      .eq('template_id', template_id)
      .order('orden');

    const snapshot: VerificacionTemplateSnapshot = {
      template,
      sections: sectionsWithItems,
      ...(headerFields?.length ? { header_fields: headerFields as VerificacionTemplateSnapshot['header_fields'] } : {}),
    };

    const validation = validateTemplateForPublish(snapshot);
    return NextResponse.json(validation);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
