import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: conjunto_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Get all instruments in this conjunto
    const { data: instrs } = await supabase
      .from('instrumentos')
      .select('id, codigo, nombre, tipo')
      .eq('conjunto_id', conjunto_id);

    if (!instrs || instrs.length === 0) return NextResponse.json({ data: [] });

    const instrIds = instrs.map((i: any) => i.id);

    const { data: rows, error: qErr } = await supabase
      .from('completed_verificaciones')
      .select(`
        id, instrumento_id, fecha_verificacion, fecha_proxima_verificacion,
        resultado, estado, created_at,
        template_version:verificacion_template_versions!completed_verificaciones_template_version_id_fkey (
          version_number,
          template:verificacion_templates!verificacion_template_versions_template_id_fkey (codigo, nombre)
        ),
        creator:user_profiles!completed_verificaciones_created_by_fkey (full_name)
      `)
      .in('instrumento_id', instrIds)
      .order('fecha_verificacion', { ascending: false })
      .limit(200);

    if (qErr) throw qErr;

    const instrMap = Object.fromEntries(instrs.map((i: any) => [i.id, i]));

    const data = (rows ?? []).map((r: any) => ({
      id: r.id,
      instrumento_id: r.instrumento_id,
      instrumento_codigo: instrMap[r.instrumento_id]?.codigo ?? '—',
      instrumento_nombre: instrMap[r.instrumento_id]?.nombre ?? '—',
      instrumento_tipo: instrMap[r.instrumento_id]?.tipo ?? 'B',
      fecha_verificacion: r.fecha_verificacion,
      fecha_proxima_verificacion: r.fecha_proxima_verificacion,
      resultado: r.resultado,
      estado: r.estado,
      created_at: r.created_at,
      template_codigo: r.template_version?.template?.codigo ?? '—',
      template_version_number: r.template_version?.version_number ?? 1,
      created_by_name: r.creator?.full_name ?? null,
    }));

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
