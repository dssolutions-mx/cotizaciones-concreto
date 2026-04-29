import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';

/** PostgREST returns SETOF uuid as an array of { fn_fifo_auto_allocate_candidates: uuid } rows. */
function parseFifoCandidateRpcRows(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const row of data) {
    if (typeof row === 'string') {
      out.push(row);
    } else if (row && typeof row === 'object' && 'fn_fifo_auto_allocate_candidates' in row) {
      const v = (row as { fn_fifo_auto_allocate_candidates: string }).fn_fifo_auto_allocate_candidates;
      if (v) out.push(String(v));
    }
  }
  return out;
}

/**
 * GET /api/cron/fifo-auto-allocate
 *
 * HTTP endpoint for FIFO automation — **not** scheduled on Vercel. Schedule only in
 * **Supabase** (pg_cron → Edge Function or pg_net → this URL), same pattern as
 * `supabase/functions/daily-compliance-check` → Next API.
 *
 * Selects concrete remisiones whose effective creation time is older than
 * FIFO_CRON_MIN_AGE_HOURS (default 48) and that still have material lines without
 * fifo_allocated_at.
 *
 * Auth: Bearer FIFO_CRON_SECRET or CRON_SECRET (same pattern as compliance cron).
 *
 * Env:
 *   FIFO_CRON_SECRET or CRON_SECRET — required in production
 *   FIFO_ALLOCATION_ACTOR_USER_ID — user_profiles.id used as created_by on allocations (system actor)
 *   FIFO_CRON_MIN_AGE_HOURS — default 48
 *   FIFO_CRON_MAX_REMISIONES — default 100 (max remisiones per run)
 */
export async function GET(request: Request) {
  try {
    const secret =
      process.env.FIFO_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
    const auth = request.headers.get('authorization');
    const headerSecret = request.headers.get('x-fifo-cron-secret');

    const okSecret =
      secret &&
      (auth === `Bearer ${secret}` ||
        (headerSecret && headerSecret === secret));

    if (!secret || !okSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorId = process.env.FIFO_ALLOCATION_ACTOR_USER_ID?.trim();
    if (!actorId) {
      console.error('[cron/fifo-auto-allocate] Missing FIFO_ALLOCATION_ACTOR_USER_ID');
      return NextResponse.json(
        {
          error:
            'FIFO_ALLOCATION_ACTOR_USER_ID must be set (user_profiles.id used as FIFO audit actor)',
        },
        { status: 500 }
      );
    }

    const minAge = Number(process.env.FIFO_CRON_MIN_AGE_HOURS ?? '48');
    const maxRemisiones = Math.min(
      500,
      Math.max(1, Number(process.env.FIFO_CRON_MAX_REMISIONES ?? '100'))
    );

    const supabase = createServiceClient();

    const { data: candidateRows, error: rpcErr } = await supabase.rpc(
      'fn_fifo_auto_allocate_candidates',
      {
        p_limit: maxRemisiones,
        p_min_age_hours: Number.isFinite(minAge) ? minAge : 48,
      }
    );

    if (rpcErr) {
      console.error('[cron/fifo-auto-allocate] RPC', rpcErr);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    const remisionIds = parseFifoCandidateRpcRows(candidateRows);

    const results: Array<{
      remision_id: string;
      success: boolean;
      allocations_created: number;
      error?: string;
    }> = [];

    for (const rid of remisionIds) {
      try {
        const r = await autoAllocateRemisionFIFO(rid, actorId, { supabase });
        results.push({
          remision_id: rid,
          success: r.success,
          allocations_created: r.allocationsCreated,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        results.push({
          remision_id: rid,
          success: false,
          allocations_created: 0,
          error: msg,
        });
      }
    }

    const allocated = results.filter((x) => x.success).length;

    return NextResponse.json({
      ok: true,
      min_age_hours: minAge,
      candidates: remisionIds.length,
      processed: results.length,
      succeeded: allocated,
      results,
    });
  } catch (e: unknown) {
    console.error('[cron/fifo-auto-allocate]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
