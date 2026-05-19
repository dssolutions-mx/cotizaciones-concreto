import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { publishStudy, validatePublishPreflight } from '@/services/emaUncertaintyService';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

const PublishSchema = z.object({
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** GET — returns preflight validation status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const preflight = await validatePublishPreflight(id);
    return NextResponse.json(preflight);
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/studies/[id]/publish]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** POST — finalizes the study */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = PublishSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    const result = await publishStudy(id, user.id, parsed.data.valid_until);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[POST /api/ema/uncertainty/studies/[id]/publish]', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
