import { NextRequest, NextResponse } from 'next/server';
import { inventoryRoleKey } from '@/lib/auth/inventoryRoles';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';

type ReplayBody = {
  mode: 'day' | 'range';
  date?: string;
  from?: string;
  to?: string;
  plant_id?: string | null;
};

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseBody(json: unknown): { ok: true; body: ReplayBody } | { ok: false; error: string } {
  if (!json || typeof json !== 'object') {
    return { ok: false, error: 'Cuerpo JSON inválido' };
  }
  const o = json as Record<string, unknown>;
  const mode = o.mode;
  if (mode !== 'day' && mode !== 'range') {
    return { ok: false, error: 'mode debe ser "day" o "range"' };
  }
  const plant_id =
    o.plant_id === null || o.plant_id === undefined || o.plant_id === ''
      ? null
      : typeof o.plant_id === 'string'
        ? o.plant_id
        : null;

  if (mode === 'day') {
    const date = typeof o.date === 'string' ? o.date : '';
    if (!isIsoDate(date)) {
      return { ok: false, error: 'date requerida (YYYY-MM-DD) para mode=day' };
    }
    return { ok: true, body: { mode: 'day', date, plant_id } };
  }

  const from = typeof o.from === 'string' ? o.from : '';
  const to = typeof o.to === 'string' ? o.to : '';
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return { ok: false, error: 'from y to requeridos (YYYY-MM-DD) para mode=range' };
  }
  if (from > to) {
    return { ok: false, error: 'from no puede ser posterior a to' };
  }
  return { ok: true, body: { mode: 'range', from, to, plant_id } };
}

/**
 * POST /api/finanzas/fifo-closure/replay
 * EXECUTIVE only. Re-ejecuta autoAllocateRemisionFIFO para remisiones CONCRETO en el rango.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || inventoryRoleKey(profile.role) !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Solo ejecutivos pueden ejecutar cierre FIFO masivo.' }, { status: 403 });
    }

    let parsed: ReplayBody;
    try {
      const json = await request.json();
      const r = parseBody(json);
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 400 });
      }
      parsed = r.body;
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const dateFrom = parsed.mode === 'day' ? parsed.date! : parsed.from!;
    const dateTo = parsed.mode === 'day' ? parsed.date! : parsed.to!;

    let q = supabase
      .from('remisiones')
      .select('id')
      .eq('tipo_remision', 'CONCRETO')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: true });

    if (parsed.plant_id) {
      q = q.eq('plant_id', parsed.plant_id);
    }

    const { data: rows, error: qErr } = await q;
    if (qErr) {
      console.error('[fifo-closure/replay] remisiones query', qErr);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const ids = (rows ?? []).map((r) => r.id);
    let ok = 0;
    let fail = 0;
    const failuresSample: Array<{ remision_id: string; message: string }> = [];

    for (const rid of ids) {
      try {
        const result = await autoAllocateRemisionFIFO(rid, user.id, { supabase });
        if (result.success) {
          ok++;
        } else {
          fail++;
          if (failuresSample.length < 25) {
            failuresSample.push({
              remision_id: rid,
              message: JSON.stringify({ errors: result.errors, skipped: result.skipped }),
            });
          }
        }
      } catch (e) {
        fail++;
        const message = e instanceof Error ? e.message : String(e);
        if (failuresSample.length < 25) {
          failuresSample.push({ remision_id: rid, message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      ok,
      fail,
      total: ids.length,
      dateFrom,
      dateTo,
      remisionIdsProcessed: ids,
      failuresSample,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[fifo-closure/replay]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
