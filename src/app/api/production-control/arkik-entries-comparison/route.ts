import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  hasInventoryStandardAccess,
  isGlobalInventoryRole,
  canAccessAllInventoryPlants,
} from '@/lib/auth/inventoryRoles';
import { parseArkikMaterialMovementsBuffer } from '@/lib/inventory/arkikMaterialMovementsParser';
import {
  compareArkikEntries,
  buildArkikReconciliationResult,
} from '@/lib/inventory/arkikEntriesComparator';
import { compareArkikConsumosSinRemision } from '@/lib/inventory/arkikConsumoComparator';
import { compareArkikRegresoProveedor } from '@/lib/inventory/arkikRegresoProveedorComparator';
import { fetchMaterialEntriesForArkikComparison } from '@/lib/inventory/fetchMaterialEntriesForArkikComparison';
import { fetchMaterialAdjustmentsForArkikComparison } from '@/lib/inventory/fetchMaterialAdjustmentsForArkikComparison';
import { fetchMaterialUomHintsByCode } from '@/lib/inventory/fetchMaterialUomHintsForArkik';
import { applyArkikQuantityConversion } from '@/lib/inventory/arkikApplyQuantityConversion';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_RANGE_DAYS = 366;

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

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

/**
 * POST /api/production-control/arkik-entries-comparison
 * FormData: arkik_file, plant_id, date_from, date_to (YYYY-MM-DD)
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

    const formData = await request.formData();
    const file = formData.get('arkik_file');
    const plantId = String(formData.get('plant_id') ?? '').trim();
    const dateFrom = String(formData.get('date_from') ?? '').trim();
    const dateTo = String(formData.get('date_to') ?? '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo Arkik es requerido' }, { status: 400 });
    }
    if (!plantId || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'plant_id, date_from y date_to son requeridos' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return NextResponse.json({ error: 'Fechas inválidas (use YYYY-MM-DD)' }, { status: 400 });
    }
    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: 'La fecha inicial no puede ser mayor que la final' },
        { status: 400 }
      );
    }
    if (daysBetweenInclusive(dateFrom, dateTo) > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `El rango máximo es ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }

    const lowerName = file.name.toLowerCase();
    if (
      !lowerName.endsWith('.xls') &&
      !lowerName.endsWith('.xlsx') &&
      !lowerName.endsWith('.csv')
    ) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos .xls, .xlsx o .csv' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'El archivo excede 50 MB' }, { status: 400 });
    }

    const canAccess = await profileCanAccessPlant(supabase, profile, plantId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Sin acceso a esta planta' }, { status: 403 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseArkikMaterialMovementsBuffer(buffer, file.name);
    const [dbEntries, adjustmentsResult, uomMap] = await Promise.all([
      fetchMaterialEntriesForArkikComparison(supabase, plantId, dateFrom, dateTo),
      fetchMaterialAdjustmentsForArkikComparison(supabase, plantId, dateFrom, dateTo),
      fetchMaterialUomHintsByCode(supabase),
    ]);
    const enriched = applyArkikQuantityConversion(parsed, uomMap);
    const conRemision = compareArkikEntries(
      enriched.entradas,
      enriched.entradas_sin_remision,
      dbEntries,
      adjustmentsResult.positive_with_remision,
      adjustmentsResult.positive_without_remision
    );
    const excelNegativos = [
      ...enriched.consumos_sin_remision,
      ...enriched.salidas_por_ajuste,
    ];
    const consumoSinRemision = compareArkikConsumosSinRemision(
      excelNegativos,
      adjustmentsResult.negative_without_remision,
      adjustmentsResult.negative_with_remision
    );
    const regresoProveedor = compareArkikRegresoProveedor(
      enriched.regresos_proveedor,
      adjustmentsResult.negative_with_remision,
      adjustmentsResult.negative_without_remision
    );
    const result = buildArkikReconciliationResult(
      conRemision,
      consumoSinRemision,
      regresoProveedor
    );

    return NextResponse.json({
      success: true,
      data: result,
      parse_meta: parsed.meta,
      plant_id: plantId,
      date_from: dateFrom,
      date_to: dateTo,
      file_name: file.name,
    });
  } catch (error) {
    console.error('arkik-entries-comparison POST:', error);
    const message =
      error instanceof Error ? error.message : 'Error interno al comparar movimientos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
