import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { EMA_VERIFICACION_READ_ROLES } from '@/lib/ema/emaVerificacionApiRoles';
import { EMA_BULK_VERIFICACION_PRINT_MAX } from '@/lib/ema/bulkVerificacionPrint';
import { fetchCompletedVerificacionesDetalle } from '@/lib/ema/fetchCompletedVerificacionDetalle';
import { z } from 'zod';

const BodySchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(EMA_BULK_VERIFICACION_PRINT_MAX),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    const readRole = (profile as { role: string } | null)?.role;
    if (!readRole || !EMA_VERIFICACION_READ_ROLES.includes(readRole as (typeof EMA_VERIFICACION_READ_ROLES)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const admin = createServiceClient();
    const data = await fetchCompletedVerificacionesDetalle(admin, parsed.data.ids);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    if (message.startsWith('Verificación no encontrada')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
