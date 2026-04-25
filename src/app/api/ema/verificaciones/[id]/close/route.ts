import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { assertPatronesCumplenParaVerificacionInterna } from '@/lib/ema/verificacionPatronCompliance';
import { persistMetrologiaTurOnVerificationClose } from '@/services/emaMetrologyService';
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
      .select('id, estado, instrumento_id, fecha_verificacion')
      .eq('id', completed_id)
      .single();
    if (vErr || !verif) return NextResponse.json({ error: 'Verificación no encontrada' }, { status: 404 });
    if (verif.estado === 'cerrado')
      return NextResponse.json({ error: 'La verificación ya está cerrada' }, { status: 400 });

    const json = await request.json();
    const parsed = CloseSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { data: instTipo } = await admin
      .from('instrumentos')
      .select('tipo')
      .eq('id', (verif as { instrumento_id: string }).instrumento_id)
      .single();
    if ((instTipo as { tipo?: string } | null)?.tipo === 'C') {
      const { data: mrows, error: mErr } = await admin
        .from('completed_verificacion_maestros')
        .select('maestro_id')
        .eq('completed_id', completed_id);
      if (mErr) throw mErr;
      const maestroIds = (mrows ?? []).map((r: { maestro_id: string }) => r.maestro_id);
      if (maestroIds.length < 1) {
        return NextResponse.json(
          {
            error:
              'No se puede cerrar: la verificación no tiene instrumentos patrón (tipo A) vinculados. Vuelva a abrir o reasigne patrones desde la ficha del instrumento.',
          },
          { status: 400 },
        );
      }
      const fechaVerif = (verif as { fecha_verificacion?: string }).fecha_verificacion
        ?? new Date().toISOString().split('T')[0];
      const patronGate = await assertPatronesCumplenParaVerificacionInterna(admin, maestroIds, fechaVerif);
      if (!patronGate.ok) {
        return NextResponse.json(
          {
            error: patronGate.issues.map((i) => `${i.codigo}: ${i.detalle}`).join(' '),
            issues: patronGate.issues,
          },
          { status: 422 },
        );
      }
    }

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

    try {
      await persistMetrologiaTurOnVerificationClose(admin, completed_id);
    } catch {
      /* no bloquear cierre si la fila metrológica no pudo persistirse */
    }

    return NextResponse.json({ data: closed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
