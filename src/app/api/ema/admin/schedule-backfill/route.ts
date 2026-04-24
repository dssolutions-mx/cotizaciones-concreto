import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { refreshEmaComplianceAndPrograma } from '@/services/emaProgramaService';
import { z } from 'zod';

const ADMIN_ROLES = ['EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const MAX_UPDATES = 500;

const BodySchema = z.object({
  updates: z
    .array(
      z.object({
        instrumento_id: z.string().uuid(),
        fecha_proximo_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1)
    .max(MAX_UPDATES),
});

/**
 * Apply reviewed schedule dates (e.g. from `scripts/ema/audit_inventory_csv_schedule.py` → proposed_updates).
 * Does not guess matches — caller must send explicit instrument UUIDs + ISO dates.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createServiceClient();
    const { updates } = parsed.data;
    let applied = 0;
    const failures: { instrumento_id: string; message: string }[] = [];

    for (const u of updates) {
      const { error } = await admin
        .from('instrumentos')
        .update({ fecha_proximo_evento: u.fecha_proximo_evento, updated_at: new Date().toISOString() })
        .eq('id', u.instrumento_id);
      if (error) {
        failures.push({ instrumento_id: u.instrumento_id, message: error.message });
      } else {
        applied += 1;
      }
    }

    const refresh = await refreshEmaComplianceAndPrograma(null);

    return NextResponse.json({
      data: {
        applied,
        failed: failures.length,
        failures,
        compliance_refresh: refresh,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
