/**
 * POST /api/ema/instrumentos/batch
 *
 * Contract (see todo batch-api-contract):
 * - HTTP **200** with JSON body on completed request (including partial per-id failures).
 *   We intentionally do **not** use 207 so clients can treat non-2xx as transport/auth errors only.
 * - Max **100** ids per request (`EMA_INSTRUMENT_BATCH_MAX` in service).
 * - Body: `{ ids: string[], patch: UpdateInstrumentoInput }` with at least one patch key.
 * - Response: `{ ok: true, summary: { success, failed }, results: { id, success, error? }[] }`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { batchUpdateInstrumentos, EMA_INSTRUMENT_BATCH_MAX } from '@/services/emaInstrumentoService';
import { EMA_INSTRUMENTO_MAESTRO_IDS_MAX } from '@/types/ema';
import { EMA_INSTRUMENT_UPDATE_ROLES } from '@/lib/ema/emaWorkspaceRoles';
import type { UserRole } from '@/store/auth/types';
import { z } from 'zod';

const mes = z.number().int().min(1).max(12).nullable().optional();

const patchSchema = z
  .object({
    nombre: z.string().min(1).max(200).optional(),
    tipo: z.enum(['A', 'B', 'C']).optional(),
    instrumento_maestro_ids: z.array(z.string().uuid()).max(EMA_INSTRUMENTO_MAESTRO_IDS_MAX).nullable().optional(),
    plant_id: z.string().uuid().optional(),
    numero_serie: z.string().max(120).nullable().optional(),
    marca: z.string().max(120).nullable().optional(),
    modelo_comercial: z.string().max(200).nullable().optional(),
    mes_inicio_servicio_override: mes,
    mes_fin_servicio_override: mes,
    ubicacion_dentro_planta: z.string().max(500).nullable().optional(),
    fecha_proximo_evento: z.string().nullable().optional(),
    notas: z.string().max(4000).nullable().optional(),
  })
  .strict();

const bodySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(EMA_INSTRUMENT_BATCH_MAX),
    patch: patchSchema,
  })
  .refine((b) => Object.keys(b.patch).length > 0, { message: 'patch vacío', path: ['patch'] });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile as { role: string } | null)?.role;
    if (!role || !EMA_INSTRUMENT_UPDATE_ROLES.includes(role as UserRole)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { ids, patch } = parsed.data;
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length > EMA_INSTRUMENT_BATCH_MAX) {
      return NextResponse.json(
        { error: `Máximo ${EMA_INSTRUMENT_BATCH_MAX} instrumentos por lote` },
        { status: 400 },
      );
    }

    const results = await batchUpdateInstrumentos(uniqueIds, patch);
    const success = results.filter((r) => r.success).length;
    const failed = results.length - success;

    return NextResponse.json({
      ok: true,
      summary: { success, failed, total: results.length },
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    if (msg.includes('Máximo')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
