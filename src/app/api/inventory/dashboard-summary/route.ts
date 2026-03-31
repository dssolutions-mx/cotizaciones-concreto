import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DashboardMaterialSummary, MaterialHealth } from '@/types/inventoryDashboard';
import { hasInventoryStandardAccess, isGlobalInventoryRole } from '@/lib/auth/inventoryRoles';

function computeHealth(
  stock: number,
  reorderPoint: number | null,
  alerts: DashboardMaterialSummary['active_alerts']
): { health: MaterialHealth; fill_ratio: number } {
  const hasPendingConfirmation = alerts.some((a) => a.status === 'pending_confirmation');
  const hasAnyActive = alerts.length > 0;

  if (reorderPoint == null || reorderPoint <= 0) {
    if (hasPendingConfirmation) return { health: 'critical', fill_ratio: 0.5 };
    if (hasAnyActive) return { health: 'warning', fill_ratio: 0.5 };
    return { health: 'unknown', fill_ratio: 0.5 };
  }

  const ratio = stock / reorderPoint;
  const fill_ratio = Math.min(Math.max(ratio / 1.5, 0), 1);

  if (stock < reorderPoint || hasPendingConfirmation) {
    return { health: 'critical', fill_ratio };
  }
  if (stock < reorderPoint * 1.15 || hasAnyActive) {
    return { health: 'warning', fill_ratio };
  }
  return { health: 'healthy', fill_ratio };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const canView =
      hasInventoryStandardAccess(profile.role) || profile.role === 'ADMINISTRATIVE';
    if (!canView) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let plantId = searchParams.get('plant_id') || profile.plant_id;

    if (!isGlobalInventoryRole(profile.role) && plantId !== profile.plant_id) {
      plantId = profile.plant_id;
    }

    if (!plantId) {
      return NextResponse.json({ error: 'Planta no especificada' }, { status: 400 });
    }

    const activeAlertStatuses = [
      'pending_confirmation',
      'confirmed',
      'pending_validation',
      'validated',
      'pending_po',
      'po_linked',
      'delivery_scheduled',
      'delivered',
    ] as const;

    const [invRes, cfgRes, alertsRes] = await Promise.all([
      supabase
        .from('material_inventory')
        .select(`
          material_id,
          current_stock,
          material:materials(id, material_name, category, unit_of_measure, is_active)
        `)
        .eq('plant_id', plantId)
        .eq('material.is_active', true),
      supabase
        .from('material_reorder_config')
        .select('id, material_id, reorder_point_kg, reorder_qty_kg, is_active')
        .eq('plant_id', plantId)
        .eq('is_active', true),
      supabase
        .from('material_alerts')
        .select('id, material_id, alert_number, status, confirmation_deadline')
        .eq('plant_id', plantId)
        .in('status', [...activeAlertStatuses]),
    ]);

    if (invRes.error) {
      console.error('dashboard-summary inventory:', invRes.error);
      return NextResponse.json(
        { success: false, error: invRes.error.message },
        { status: 500 }
      );
    }

    if (cfgRes.error) {
      console.error('dashboard-summary config:', cfgRes.error);
    }
    if (alertsRes.error) {
      console.error('dashboard-summary alerts:', alertsRes.error);
    }

    const configByMaterial = new Map<string, { id: string; reorder_point_kg: number; reorder_qty_kg: number | null }>();
    for (const row of cfgRes.data || []) {
      configByMaterial.set(row.material_id, {
        id: row.id,
        reorder_point_kg: Number(row.reorder_point_kg),
        reorder_qty_kg: row.reorder_qty_kg != null ? Number(row.reorder_qty_kg) : null,
      });
    }

    const alertsByMaterial = new Map<string, DashboardMaterialSummary['active_alerts']>();
    for (const a of alertsRes.data || []) {
      const list = alertsByMaterial.get(a.material_id) || [];
      list.push({
        id: a.id,
        alert_number: a.alert_number,
        status: a.status,
        confirmation_deadline: a.confirmation_deadline,
      });
      alertsByMaterial.set(a.material_id, list);
    }

    const materials: DashboardMaterialSummary[] = (invRes.data || [])
      .filter((row: any) => row.material?.is_active !== false)
      .map((row: any) => {
      const mat = Array.isArray(row.material) ? row.material[0] : row.material;
      const materialId = row.material_id as string;
      const stock = Number(row.current_stock ?? 0);
      const cfg = configByMaterial.get(materialId);
      const reorderPoint = cfg?.reorder_point_kg ?? null;
      const alerts = alertsByMaterial.get(materialId) || [];
      const { health, fill_ratio } = computeHealth(stock, reorderPoint, alerts);

      return {
        material_id: materialId,
        material_name: mat?.material_name ?? 'Material',
        category: mat?.category ?? null,
        unit_of_measure: mat?.unit_of_measure ?? null,
        current_stock_kg: stock,
        reorder_point_kg: reorderPoint,
        reorder_qty_kg: cfg?.reorder_qty_kg ?? null,
        reorder_config_id: cfg?.id ?? null,
        health,
        fill_ratio,
        active_alerts: alerts,
      };
    });

    materials.sort((a, b) => a.material_name.localeCompare(b.material_name, 'es'));

    const pendingConfirmationCount = materials.reduce(
      (n, m) => n + m.active_alerts.filter((a) => a.status === 'pending_confirmation').length,
      0
    );

    return NextResponse.json({
      success: true,
      plant_id: plantId,
      materials,
      summary: {
        material_count: materials.length,
        pending_confirmation_alerts: pendingConfirmationCount,
        critical_count: materials.filter((m) => m.health === 'critical').length,
        warning_count: materials.filter((m) => m.health === 'warning').length,
      },
    });
  } catch (error) {
    console.error('GET /api/inventory/dashboard-summary error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
