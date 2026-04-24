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

const ItemSchema = z.object({
  tipo: z.enum(['medicion', 'booleano', 'numero', 'texto', 'calculado', 'referencia_equipo']),
  punto: z.string().min(1),
  valor_esperado: z.number().nullable().optional(),
  tolerancia: z.number().nullable().optional(),
  tolerancia_tipo: z.enum(['absoluta', 'porcentual', 'rango']).default('absoluta'),
  tolerancia_min: z.number().nullable().optional(),
  tolerancia_max: z.number().nullable().optional(),
  unidad: z.string().nullable().optional(),
  formula: z.string().nullable().optional(),
  requerido: z.boolean().default(true),
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

/** POST /api/ema/templates/[id]/sections/[sid]/items */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const { sid: section_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = ItemSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    if (parsed.data.tipo === 'referencia_equipo') {
      return NextResponse.json(
        {
          error:
            'El tipo «referencia_equipo» ya no se admite en ítems nuevos: la trazabilidad de patrones es por instrumentos tipo A vinculados al tipo C y por el inicio de la verificación. Use «texto» si necesita un campo documental libre.',
        },
        { status: 400 },
      );
    }

    let orden = parsed.data.orden;
    if (orden == null) {
      const { count } = await supabase
        .from('verificacion_template_items')
        .select('id', { count: 'exact', head: true })
        .eq('section_id', section_id);
      orden = (count ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from('verificacion_template_items')
      .insert({
        section_id,
        tipo: parsed.data.tipo,
        punto: parsed.data.punto,
        valor_esperado: parsed.data.valor_esperado ?? null,
        tolerancia: parsed.data.tolerancia ?? null,
        tolerancia_tipo: parsed.data.tolerancia_tipo,
        tolerancia_min: parsed.data.tolerancia_min ?? null,
        tolerancia_max: parsed.data.tolerancia_max ?? null,
        unidad: parsed.data.unidad ?? null,
        formula: parsed.data.formula ?? null,
        requerido: parsed.data.requerido,
        observacion_prompt: parsed.data.observacion_prompt ?? null,
        orden,
        primitive: parsed.data.primitive ?? null,
        item_role: parsed.data.item_role ?? null,
        variable_name: parsed.data.variable_name ?? null,
        pass_fail_rule: parsed.data.pass_fail_rule ?? null,
        contributes_to_cumple: parsed.data.contributes_to_cumple ?? null,
        depends_on: parsed.data.depends_on ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
