import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  hasInventoryStandardAccess,
  isGlobalInventoryRole,
  canAccessAllInventoryPlants,
} from '@/lib/auth/inventoryRoles';
import {
  applyArkikConsumptionSync,
  previewArkikConsumptionSync,
  previewArkikConsumptionQtyUpdates,
  type ArkikConsumoSyncApplyItem,
} from '@/lib/inventory/arkikConsumptionSync';
import type { ArkikConsumoRemisionOnlyExcelRow } from '@/lib/inventory/arkikConsumoRemisionComparator';

const SYNC_WRITE_ROLES = new Set([
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
  'DOSIFICADOR',
  'ADMIN',
]);

async function profileCanAccessPlant(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  profile: { role: string; plant_id?: string | null; business_unit_id?: string | null },
  plantId: string
): Promise<boolean> {
  if (isGlobalInventoryRole(profile.role) || canAccessAllInventoryPlants(profile.role)) {
    return true;
  }
  if (profile.plant_id && profile.plant_id === plantId) return true;
  if (profile.business_unit_id) {
    const { data: pl } = await supabase
      .from('plants')
      .select('business_unit_id')
      .eq('id', plantId)
      .single();
    return pl?.business_unit_id === profile.business_unit_id;
  }
  return false;
}

function normalizeRole(role: string): string {
  return role.trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * POST /api/production-control/arkik-consumption-sync
 * Body:
 *   preview: { plant_id, date_from, date_to, only_excel, qty_diff? }
 *   apply:   { plant_id, items[], run_fifo? }
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

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    if (!hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    const body = await request.json();
    const action = String(body.action ?? 'preview').trim();
    const plantId = String(body.plant_id ?? '').trim();

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id es requerido' }, { status: 400 });
    }

    const canAccess = await profileCanAccessPlant(supabase, profile, plantId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Sin acceso a esta planta' }, { status: 403 });
    }

    if (action === 'preview') {
      const dateFrom = String(body.date_from ?? '').trim();
      const dateTo = String(body.date_to ?? '').trim();
      if (!dateFrom || !dateTo) {
        return NextResponse.json({ error: 'date_from y date_to son requeridos' }, { status: 400 });
      }

      const onlyExcel = (body.only_excel ?? []) as ArkikConsumoRemisionOnlyExcelRow[];
      const qtyDiff = (body.qty_diff ?? []) as Array<{
        material: string;
        remision: string;
        remision_raw: string;
        cantidad_excel: number;
        unit_arkik: string;
        cantidad_real_db: number;
        diferencia: number;
      }>;

      const [insertPreview, qtyPreview] = await Promise.all([
        previewArkikConsumptionSync(supabase, plantId, dateFrom, dateTo, onlyExcel),
        previewArkikConsumptionQtyUpdates(supabase, plantId, dateFrom, dateTo, qtyDiff),
      ]);

      const readyInsert = insertPreview.filter((r) => r.sync_status === 'ready_insert').length;
      const readyUpdate = qtyPreview.filter((r) => r.sync_status === 'ready_update').length;

      return NextResponse.json({
        success: true,
        insert_preview: insertPreview,
        qty_update_preview: qtyPreview,
        summary: {
          ready_insert: readyInsert,
          ready_update: readyUpdate,
          missing_remision: insertPreview.filter((r) => r.sync_status === 'missing_remision').length,
          missing_material: insertPreview.filter((r) => r.sync_status === 'missing_material').length,
        },
      });
    }

    if (action === 'apply') {
      if (!SYNC_WRITE_ROLES.has(normalizeRole(profile.role))) {
        return NextResponse.json({ error: 'Sin permisos para registrar consumos' }, { status: 403 });
      }

      const items = (body.items ?? []) as ArkikConsumoSyncApplyItem[];
      if (items.length === 0) {
        return NextResponse.json({ error: 'items es requerido' }, { status: 400 });
      }
      if (items.length > 500) {
        return NextResponse.json({ error: 'Máximo 500 registros por solicitud' }, { status: 400 });
      }

      const runFifo = body.run_fifo !== false;
      const result = await applyArkikConsumptionSync(supabase, plantId, user.id, items, {
        runFifo,
      });

      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 });
  } catch (error) {
    console.error('arkik-consumption-sync POST:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
