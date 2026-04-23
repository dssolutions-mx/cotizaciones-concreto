import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

const CloseSchema = z.object({
  resultado: z.enum(['conforme', 'no_conforme', 'condicional']),
  fecha_proxima_verificacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones_generales: z.string().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: completed_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const writeRole = (profile as { role: string } | null)?.role;
    if (!writeRole || !WRITE_ROLES.includes(writeRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const admin = createServiceClient();
    const { data: verif, error: vErr } = await admin
      .from('completed_verificaciones')
      .select('id, estado, instrumento_id')
      .eq('id', completed_id)
      .single();
    if (vErr || !verif) return NextResponse.json({ error: 'Verificación no encontrada' }, { status: 404 });
    if (verif.estado === 'cerrado')
      return NextResponse.json({ error: 'La verificación ya está cerrada' }, { status: 400 });

    const json = await request.json();
    const parsed = CloseSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    // Close the verification — this fires trg_after_completed_verificacion which updates instrumento
    const { data: closed, error: cErr } = await admin
      .from('completed_verificaciones')
      .update({
        estado: 'cerrado',
        resultado: parsed.data.resultado,
        fecha_proxima_verificacion: parsed.data.fecha_proxima_verificacion,
        observaciones_generales: parsed.data.observaciones_generales ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', completed_id)
      .select('id, estado, resultado, fecha_proxima_verificacion')
      .single();

    if (cErr) throw cErr;
    return NextResponse.json({ data: closed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
