import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';
import { hasInventoryStandardAccess, isGlobalInventoryRole } from '@/lib/auth/inventoryRoles';

const BodySchema = z.object({
  remision_ids: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * POST /api/inventory/fifo/batch
 * Run FIFO cost allocation for many remisiones (e.g. after Arkik import).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    if (!hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const { remision_ids } = BodySchema.parse(body);

    const { data: remisionRows, error: remErr } = await supabase
      .from('remisiones')
      .select('id, plant_id')
      .in('id', remision_ids);

    if (remErr) {
      return NextResponse.json({ error: remErr.message }, { status: 500 });
    }

    const foundIds = new Set((remisionRows || []).map((r) => r.id));
    const missing = remision_ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Algunas remisiones no existen', missing_ids: missing },
        { status: 400 }
      );
    }

    // Plant scoping: non-global users may only process remisiones in their plant (or BU)
    if (!isGlobalInventoryRole(profile.role) && profile.plant_id) {
      const foreign = (remisionRows || []).filter((r) => r.plant_id !== profile.plant_id);
      if (foreign.length > 0) {
        return NextResponse.json(
          { error: 'No puede procesar remisiones de otra planta' },
          { status: 403 }
        );
      }
    }

    const results: Array<{
      remision_id: string;
      success: boolean;
      allocationsCreated: number;
      errors?: Array<{ remisionMaterialId: string; materialId: string; error: string }>;
      skipped?: Array<{ remisionMaterialId: string; materialId: string; reason: string }>;
    }> = [];

    for (const rid of remision_ids) {
      try {
        const r = await autoAllocateRemisionFIFO(rid, user.id);
        results.push({
          remision_id: rid,
          success: r.success,
          allocationsCreated: r.allocationsCreated,
          errors: r.errors.length ? r.errors : undefined,
          skipped: r.skipped.length ? r.skipped : undefined,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        results.push({
          remision_id: rid,
          success: false,
          allocationsCreated: 0,
          errors: [{ remisionMaterialId: '', materialId: '', error: msg }],
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Payload inválido', details: error.flatten() },
        { status: 400 }
      );
    }
    console.error('[fifo/batch]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
