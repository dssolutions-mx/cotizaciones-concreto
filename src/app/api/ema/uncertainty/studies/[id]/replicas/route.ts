import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { upsertReplicas } from '@/services/emaUncertaintyService';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

const ReplicaSchema = z.object({
  orden: z.number().int().min(1),
  operator_id: z.string().uuid().nullable().optional(),
  instrumento_id: z.string().uuid().nullable().optional(),
  raw_values_json: z.record(z.number()),
  computed_value: z.number().nullable().optional(),
});

const UpsertReplicasSchema = z.object({
  replicas: z.array(ReplicaSchema).min(1),
});

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
    const parsed = UpsertReplicasSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    const replicas = await upsertReplicas(id, parsed.data);
    return NextResponse.json({ data: replicas });
  } catch (err) {
    console.error('[PUT /api/ema/uncertainty/studies/[id]/replicas]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
