import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];
const READ_ROLES = [...WRITE_ROLES, 'ADMIN_OPERATIONS'];

const CreateVerifSchema = z.object({
  fecha_verificacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  instrumento_maestro_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().optional(),
  condiciones_ambientales: z.object({
    temperatura: z.string().optional(),
    humedad: z.string().optional(),
    lugar: z.string().optional(),
  }).nullable().optional(),
});

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

    // Query completed_verificaciones with template version + creator info
    const { data: rows, error: qErr } = await supabase
      .from('completed_verificaciones')
      .select(`
        id, fecha_verificacion, fecha_proxima_verificacion, resultado, estado, created_at,
        template_version:verificacion_template_versions!completed_verificaciones_template_version_id_fkey (
          version_number,
          template:verificacion_templates!verificacion_template_versions_template_id_fkey (
            codigo
          )
        ),
        creator:user_profiles!completed_verificaciones_created_by_fkey (
          full_name
        )
      `)
      .eq('instrumento_id', id)
      .order('fecha_verificacion', { ascending: false })
      .limit(50);

    if (qErr) throw qErr;

    const cards = (rows ?? []).map((r: any) => ({
      id: r.id,
      fecha_verificacion: r.fecha_verificacion,
      fecha_proxima_verificacion: r.fecha_proxima_verificacion,
      resultado: r.resultado,
      estado: r.estado,
      created_at: r.created_at,
      template_codigo: r.template_version?.template?.codigo ?? '—',
      template_version_number: r.template_version?.version_number ?? 1,
      created_by_name: r.creator?.full_name ?? null,
    }));

    return NextResponse.json({ data: cards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: instrumento_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = CreateVerifSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    // Get the instrument to find its conjunto
    const { data: instrumento, error: iErr } = await supabase
      .from('instrumentos')
      .select('id, conjunto_id')
      .eq('id', instrumento_id)
      .single();
    if (iErr || !instrumento) return NextResponse.json({ error: 'Instrumento no encontrado' }, { status: 404 });
    if (!instrumento.conjunto_id)
      return NextResponse.json({ error: 'El instrumento no tiene conjunto asignado' }, { status: 400 });

    // Resolve plantilla: if template_id provided, validate it belongs to the conjunto.
    // Otherwise: if there's exactly one publicada plantilla on the conjunto, auto-select.
    // If there are multiple, return PLANTILLA_REQUIRED with candidates.
    let template: { id: string; active_version_id: string | null; estado: string } | null = null;

    if (parsed.data.template_id) {
      const { data: t, error: tErr } = await supabase
        .from('verificacion_templates')
        .select('id, active_version_id, estado, conjunto_id')
        .eq('id', parsed.data.template_id)
        .single();
      if (tErr || !t) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
      if (t.conjunto_id !== instrumento.conjunto_id)
        return NextResponse.json({ error: 'La plantilla no pertenece al conjunto del instrumento' }, { status: 400 });
      if (t.estado !== 'publicado' || !t.active_version_id)
        return NextResponse.json({ error: 'La plantilla no tiene versión publicada' }, { status: 400 });
      template = t;
    } else {
      const { data: candidates, error: cErr } = await supabase
        .from('verificacion_templates')
        .select('id, codigo, nombre, norma_referencia, active_version_id, estado')
        .eq('conjunto_id', instrumento.conjunto_id)
        .eq('estado', 'publicado')
        .order('codigo');
      if (cErr) throw cErr;
      const publicadas = (candidates ?? []).filter((t: any) => t.active_version_id);
      if (publicadas.length === 0)
        return NextResponse.json({ error: 'No hay plantilla publicada para este conjunto' }, { status: 400 });
      if (publicadas.length > 1) {
        return NextResponse.json({
          error: 'Debe seleccionar una plantilla',
          code: 'PLANTILLA_REQUIRED',
          candidates: publicadas.map((t: any) => ({
            id: t.id,
            codigo: t.codigo,
            nombre: t.nombre,
            norma_referencia: t.norma_referencia,
          })),
        }, { status: 400 });
      }
      template = publicadas[0];
    }

    if (!template.active_version_id)
      return NextResponse.json({ error: 'La plantilla no tiene versión publicada' }, { status: 400 });

    const { data: verif, error: vErr } = await supabase
      .from('completed_verificaciones')
      .insert({
        instrumento_id,
        template_version_id: template.active_version_id,
        instrumento_maestro_id: parsed.data.instrumento_maestro_id ?? null,
        fecha_verificacion: parsed.data.fecha_verificacion ?? new Date().toISOString().split('T')[0],
        resultado: 'pendiente',
        estado: 'en_proceso',
        condiciones_ambientales: parsed.data.condiciones_ambientales ?? null,
        created_by: user.id,
      })
      .select('id, fecha_verificacion, resultado, estado, template_version_id')
      .single();

    if (vErr) throw vErr;
    return NextResponse.json({ data: verif }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
