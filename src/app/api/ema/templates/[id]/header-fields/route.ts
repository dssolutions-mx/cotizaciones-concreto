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

const HeaderFieldSchema = z.object({
  field_key: z.string().min(1),
  label: z.string().min(1),
  source: z.enum(['instrumento', 'manual']),
  variable_name: z.string().nullable().optional(),
  orden: z.number().int().optional(),
});

/** POST /api/ema/templates/[id]/header-fields */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: template_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = HeaderFieldSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    let orden = parsed.data.orden;
    if (orden == null) {
      const { count } = await supabase
        .from('verificacion_template_header_fields')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template_id);
      orden = (count ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from('verificacion_template_header_fields')
      .insert({
        template_id,
        orden,
        field_key: parsed.data.field_key,
        label: parsed.data.label,
        source: parsed.data.source,
        variable_name: parsed.data.variable_name ?? parsed.data.field_key,
        formula: null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
