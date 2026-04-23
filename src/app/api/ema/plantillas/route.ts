import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

/** GET /api/ema/plantillas — all plantillas across all conjuntos, enriched for the index UI */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { data: templates, error: tErr } = await supabase
      .from('verificacion_templates')
      .select(`
        id, codigo, nombre, norma_referencia, descripcion, estado, active_version_id,
        conjunto_id, created_at, updated_at,
        conjunto:conjuntos_herramientas!verificacion_templates_conjunto_id_fkey (
          codigo_conjunto, nombre_conjunto
        )
      `)
      .order('codigo');

    if (tErr) throw tErr;
    if (!templates || templates.length === 0) return NextResponse.json({ data: [] });

    const activeVersionIds = templates.map((t: any) => t.active_version_id).filter(Boolean);
    const versionMap = new Map<string, { id: string; version_number: number; published_at: string }>();
    if (activeVersionIds.length > 0) {
      const { data: versions } = await supabase
        .from('verificacion_template_versions')
        .select('id, version_number, published_at')
        .in('id', activeVersionIds);
      for (const v of versions ?? []) versionMap.set(v.id, v);
    }

    const tIds = templates.map((t: any) => t.id);
    const { data: sections } = await supabase
      .from('verificacion_template_sections')
      .select('id, template_id')
      .in('template_id', tIds);
    const sectionsByTpl = new Map<string, string[]>();
    for (const s of sections ?? []) {
      const arr = sectionsByTpl.get((s as any).template_id) ?? [];
      arr.push((s as any).id);
      sectionsByTpl.set((s as any).template_id, arr);
    }

    const allSectionIds = (sections ?? []).map((s: any) => s.id);
    const itemsBySection = new Map<string, number>();
    if (allSectionIds.length > 0) {
      const { data: items } = await supabase
        .from('verificacion_template_items')
        .select('id, section_id')
        .in('section_id', allSectionIds);
      for (const it of items ?? []) {
        const sid = (it as any).section_id;
        itemsBySection.set(sid, (itemsBySection.get(sid) ?? 0) + 1);
      }
    }

    const data = templates.map((t: any) => {
      const sids = sectionsByTpl.get(t.id) ?? [];
      const items_count = sids.reduce((sum, sid) => sum + (itemsBySection.get(sid) ?? 0), 0);
      return {
        id: t.id,
        codigo: t.codigo,
        nombre: t.nombre,
        norma_referencia: t.norma_referencia,
        descripcion: t.descripcion,
        estado: t.estado,
        conjunto_id: t.conjunto_id,
        conjunto_codigo: t.conjunto?.codigo_conjunto ?? null,
        conjunto_nombre: t.conjunto?.nombre_conjunto ?? null,
        active_version: t.active_version_id ? versionMap.get(t.active_version_id) ?? null : null,
        items_count,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
