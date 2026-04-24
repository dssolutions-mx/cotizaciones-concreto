import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

async function auth(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null };
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  return { user, profile };
}

const PatchItemSchema = z.object({
  tipo: z.enum(['medicion', 'booleano', 'numero', 'texto', 'calculado', 'referencia_equipo']).optional(),
  punto: z.string().min(1).optional(),
  valor_esperado: z.number().nullable().optional(),
  tolerancia: z.number().nullable().optional(),
  tolerancia_tipo: z.enum(['absoluta', 'porcentual', 'rango']).optional(),
  tolerancia_min: z.number().nullable().optional(),
  tolerancia_max: z.number().nullable().optional(),
  unidad: z.string().nullable().optional(),
  formula: z.string().nullable().optional(),
  requerido: z.boolean().optional(),
  observacion_prompt: z.string().nullable().optional(),
  orden: z.number().int().optional(),
  primitive: z.enum(['numero', 'booleano', 'texto']).optional(),
  item_role: z
    .enum([
      'input_medicion',
      'input_numero',
      'input_booleano',
      'input_texto',
      'input_referencia',
      'derivado',
      'reference_point',
    ])
    .optional(),
  variable_name: z.string().nullable().optional(),
  pass_fail_rule: z.any().optional(),
  contributes_to_cumple: z.boolean().optional(),
  depends_on: z.array(z.string()).optional(),
});

/** PATCH /api/ema/templates/[id]/sections/[sid]/items/[iid] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string; iid: string }> }) {
  try {
    const { iid } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = PatchItemSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    if (parsed.data.tipo === 'referencia_equipo') {
      return NextResponse.json(
        {
          error:
            'No se puede cambiar un ítem a «referencia_equipo»: use «texto» para campos libres; la trazabilidad de patrones es por FK en verificaciones tipo C.',
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('verificacion_template_items')
      .update({ ...parsed.data })
      .eq('id', iid)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/ema/templates/[id]/sections/[sid]/items/[iid] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sid: string; iid: string }> }) {
  try {
    const { iid } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { error } = await supabase
      .from('verificacion_template_items')
      .delete()
      .eq('id', iid);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
