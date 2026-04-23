/**
 * POST /api/ema/conjuntos/batch — same contract as instrumentos batch:
 * HTTP 200 + `{ ok, summary, results[] }`, max 100 ids (`EMA_CONJUNTO_BATCH_MAX`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { batchUpdateConjuntos, EMA_CONJUNTO_BATCH_MAX } from '@/services/emaInstrumentoService';
import { EMA_CONJUNTO_UPDATE_ROLES } from '@/lib/ema/emaWorkspaceRoles';
import type { UserRole } from '@/store/auth/types';
import { z } from 'zod';

const mes = z.number().int().min(1).max(12).nullable().optional();

const patchSchema = z
  .object({
    nombre_conjunto: z.string().min(1).max(200).optional(),
    categoria: z.string().min(1).max(100).optional(),
    tipo_defecto: z.enum(['A', 'B', 'C']).optional(),
    tipo_servicio: z.enum(['calibracion', 'verificacion', 'ninguno']).optional(),
    mes_inicio_servicio: mes,
    mes_fin_servicio: mes,
    cadencia_meses: z.number().int().positive().optional(),
    norma_referencia: z.string().max(500).nullable().optional(),
    unidad_medicion: z.string().max(80).nullable().optional(),
    rango_medicion_tipico: z.string().max(200).nullable().optional(),
    descripcion: z.string().max(4000).nullable().optional(),
    is_active: z.boolean().optional(),
    manual_path: z.string().nullable().optional(),
    instrucciones_path: z.string().nullable().optional(),
    business_unit_id: z.string().uuid().nullable().optional(),
  })
  .strict();

const bodySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(EMA_CONJUNTO_BATCH_MAX),
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
    if (!role || !EMA_CONJUNTO_UPDATE_ROLES.includes(role as UserRole)) {
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
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length > EMA_CONJUNTO_BATCH_MAX) {
      return NextResponse.json(
        { error: `Máximo ${EMA_CONJUNTO_BATCH_MAX} conjuntos por lote` },
        { status: 400 },
      );
    }

    const results = await batchUpdateConjuntos(uniqueIds, patch);
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
