import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UpsertReplicasPayloadSchema } from '@/lib/ema/uncertaintyReplicaPayload';
import { upsertReplicas } from '@/services/emaUncertaintyService';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

export async function PUT(
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
    const body = await request.json();
    const parsed = UpsertReplicasPayloadSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fieldErrors = Object.entries(flat.fieldErrors)
        .flatMap(([k, msgs]) => (msgs ?? []).map((m) => `${k}: ${m}`));
      const message =
        fieldErrors.length > 0
          ? fieldErrors.slice(0, 5).join(' · ')
          : 'Datos de réplicas inválidos';
      return NextResponse.json({ error: message, details: flat }, { status: 422 });
    }

    const replicas = await upsertReplicas(id, parsed.data);
    return NextResponse.json({ data: replicas });
  } catch (err) {
    console.error('[PUT /api/ema/uncertainty/studies/[id]/replicas]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
