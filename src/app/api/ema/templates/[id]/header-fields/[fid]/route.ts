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

const PatchHeaderFieldSchema = z.object({
  field_key: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  source: z.enum(['instrumento', 'manual']).optional(),
  variable_name: z.string().nullable().optional(),
  orden: z.number().int().optional(),
});

/** PATCH /api/ema/templates/[id]/header-fields/[fid] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; fid: string }> }) {
  try {
    const { fid } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = PatchHeaderFieldSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const update = {
      ...parsed.data,
      variable_name: parsed.data.variable_name ?? parsed.data.field_key,
      ...(parsed.data.source ? { formula: null } : {}),
    };

    const { data, error } = await supabase
      .from('verificacion_template_header_fields')
      .update(update)
      .eq('id', fid)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/ema/templates/[id]/header-fields/[fid] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; fid: string }> }) {
  try {
    const { fid } = await params;
    const supabase = await createServerSupabaseClient();
    const { user, profile } = await auth(supabase);
    if (!user || !profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { error } = await supabase
      .from('verificacion_template_header_fields')
      .delete()
      .eq('id', fid);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
