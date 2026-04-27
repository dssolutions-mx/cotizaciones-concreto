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

const PatchSectionSchema = z.object({
  titulo: z.string().min(1).optional(),
  descripcion: z.string().nullable().optional(),
  repetible: z.boolean().optional(),
  repeticiones_default: z.number().int().min(1).max(10).optional(),
  layout: z.enum(['linear', 'instrument_grid', 'reference_series']).optional(),
  instances_config: z.record(z.string(), z.any()).optional(),
  series_config: z.record(z.string(), z.any()).optional(),
  orden: z.number().int().optional(),
  repetition_conformity_policy: z.enum(['all_reps_must_pass', 'aggregate_then_evaluate']).optional(),
});

/** PATCH /api/ema/templates/[id]/sections/[sid] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const { sid } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = PatchSectionSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { data, error } = await supabase
      .from('verificacion_template_sections')
      .update({ ...parsed.data })
      .eq('id', sid)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/ema/templates/[id]/sections/[sid] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const { sid } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { error } = await supabase
      .from('verificacion_template_sections')
      .delete()
      .eq('id', sid);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
