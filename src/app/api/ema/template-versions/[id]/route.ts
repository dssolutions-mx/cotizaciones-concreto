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

    const { data, error: vErr } = await supabase
      .from('verificacion_template_versions')
      .select('id, version_number, snapshot, published_at, template_id')
      .eq('id', id)
      .single();

    if (vErr || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const snap = data.snapshot as Record<string, unknown> | null;
    if (snap && !snap.header_fields && data.template_id) {
      const { data: header_fields } = await supabase
        .from('verificacion_template_header_fields')
        .select('*')
        .eq('template_id', data.template_id)
        .order('orden');
      if (header_fields?.length) {
        return NextResponse.json({
          data: { ...data, snapshot: { ...snap, header_fields } },
        });
      }
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
