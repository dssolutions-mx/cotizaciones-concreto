import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { saveMuestreoInstrumentos, getInstrumentosByMuestreo, validateInstrumentos } from '@/services/emaInstrumentoService';
import { z } from 'zod';

const ALLOWED_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

const InstrumentoSnapshotSchema = z.object({
  instrumento_id: z.string().uuid(),
  paquete_id: z.string().uuid().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

const RequestSchema = z.object({
  instrumentos: z.array(InstrumentoSnapshotSchema),
});

/** GET — list instruments used in a muestreo */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const instrumentos = await getInstrumentosByMuestreo(params.id);
    return NextResponse.json({ data: instrumentos });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST — save instrument snapshots for a muestreo (called after muestreo creation) */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { instrumentos } = parsed.data;

    // Check EMA config: if bloquear_vencidos is enabled, validate states
    const validation = await validateInstrumentos(instrumentos.map(i => i.instrumento_id));
    if (validation.blocked) {
      return NextResponse.json({
        error: `Instrumentos vencidos bloqueados por configuración EMA: ${validation.vencidos.map(v => v.codigo).join(', ')}`,
        vencidos: validation.vencidos,
      }, { status: 422 });
    }

    const savedCount = await saveMuestreoInstrumentos(params.id, instrumentos);
    return NextResponse.json({ data: { saved: savedCount } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
