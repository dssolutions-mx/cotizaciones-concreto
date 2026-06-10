import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasInventoryStandardAccess, isGlobalInventoryRole } from '@/lib/auth/inventoryRoles';
import { MaterialAlertService } from '@/services/materialAlertService';
import { searchPoItems } from '@/lib/procurement/searchPoItems';
import type { AlertStatus } from '@/types/alerts';

const DOSIFICADOR_ALERT_STATUSES: AlertStatus[] = ['po_linked', 'delivery_scheduled'];
const STANDARD_ALERT_STATUSES: AlertStatus[] = [
  'delivery_scheduled',
  'po_linked',
  'validated',
  'pending_po',
];

/**
 * GET /api/inventory/entry-form-context
 * Batched context for material entry form: stock, fulfillment alerts, and open PO lines.
 */
export async function GET(request: NextRequest) {
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
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('material_id');
    let plantId = searchParams.get('plant_id') || profile.plant_id;
    const supplierId = searchParams.get('supplier_id') || undefined;

    if (!materialId) {
      return NextResponse.json({ error: 'material_id es requerido' }, { status: 400 });
    }

    if (!isGlobalInventoryRole(profile.role) && plantId !== profile.plant_id) {
      plantId = profile.plant_id;
    }

    if (!plantId) {
      return NextResponse.json({ error: 'Planta no especificada' }, { status: 400 });
    }

    const isDosificador = profile.role === 'DOSIFICADOR';
    const alertStatuses = isDosificador ? DOSIFICADOR_ALERT_STATUSES : STANDARD_ALERT_STATUSES;
    const alertService = new MaterialAlertService();

    const [inventoryRes, alerts, poItems] = await Promise.all([
      supabase
        .from('material_inventory')
        .select('current_stock')
        .eq('plant_id', plantId)
        .eq('material_id', materialId)
        .maybeSingle(),
      alertService.getAlerts({
        plant_id: plantId,
        material_id: materialId,
        status: alertStatuses,
      }),
      isDosificador
        ? Promise.resolve([])
        : searchPoItems(supabase, {
            plant_id: plantId,
            material_id: materialId,
            supplier_id: supplierId,
            is_service: false,
            restrict_plant_id:
              profile.role === 'PLANT_MANAGER' ? profile.plant_id : undefined,
          }),
    ]);

    if (inventoryRes.error) {
      return NextResponse.json(
        { success: false, error: inventoryRes.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      current_stock: Number(inventoryRes.data?.current_stock ?? 0),
      fulfillment_alerts: alerts,
      po_items: poItems,
    });
  } catch (error) {
    console.error('GET /api/inventory/entry-form-context error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
