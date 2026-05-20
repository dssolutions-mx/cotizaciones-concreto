import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { buildLocationReport } from '@/lib/finanzas/locationReportCore';
import type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';
import {
  canAccessFinanzasUbicaciones,
  isPlantLockedFinanzasRole,
} from '@/lib/finanzas/ubicacionesRouteAuth';
import {
  UBICACIONES_MAP_DISPLAY_CAP,
  UBICACIONES_MAX_RANGE_DAYS,
} from '@/lib/finanzas/ubicacionesConstants';

export const MAX_RANGE_DAYS = UBICACIONES_MAX_RANGE_DAYS;

function toYyyyMmDd(input: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error('Formato de fecha inválido. Use yyyy-MM-dd.');
  }
  return input;
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

function parseLocationDataFilter(
  raw: string | undefined
): LocationDataFilterValue {
  if (
    raw === 'enriched' ||
    raw === 'coordinates_only' ||
    raw === 'none' ||
    raw === 'all'
  ) {
    return raw;
  }
  return 'all';
}

async function resolveEffectivePlantIds(
  service: ReturnType<typeof createServiceClient>,
  profile: { role: string; plant_id: string | null; business_unit_id?: string | null },
  plantIdsFromBody: string[]
): Promise<string[] | undefined> {
  if (!isPlantLockedFinanzasRole(profile.role)) {
    return plantIdsFromBody.length > 0 ? plantIdsFromBody : undefined;
  }

  if (profile.plant_id) {
    return [profile.plant_id];
  }

  if (profile.business_unit_id) {
    const { data: buPlants } = await service
      .from('plants')
      .select('id')
      .eq('business_unit_id', profile.business_unit_id);
    const buPlantIds = (buPlants ?? []).map((p: { id: string }) => p.id);
    if (plantIdsFromBody.length > 0) {
      return plantIdsFromBody.filter((id) => buPlantIds.includes(id));
    }
    return buPlantIds;
  }

  return plantIdsFromBody.length > 0 ? plantIdsFromBody : undefined;
}

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
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    if (!canAccessFinanzasUbicaciones(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = (await request.json()) as {
      startDate: string;
      endDate: string;
      plantIds?: string[];
      clientIds?: string[];
      localityFilter?: string[];
      sublocalityFilter?: string[];
      administrativeArea1Filter?: string[];
      administrativeArea2Filter?: string[];
      locationDataFilter?: string;
      export?: boolean;
    };

    const startDate = toYyyyMmDd(body.startDate);
    const endDate = toYyyyMmDd(body.endDate);

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'La fecha inicial no puede ser mayor que la final' },
        { status: 400 }
      );
    }

    const span = daysBetweenInclusive(startDate, endDate);
    if (span > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `El rango máximo es ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }

    const service = createServiceClient();
    const plantIdsFromBody = (body.plantIds ?? []).filter(Boolean);
    const effectivePlantIds = await resolveEffectivePlantIds(
      service,
      profile,
      plantIdsFromBody
    );

    if (effectivePlantIds && effectivePlantIds.length === 0) {
      return NextResponse.json({
        data: {
          points: [],
          byLocality: [],
          unlocatedOrders: [],
          summary: {
            ordersWithLocation: 0,
            ordersWithoutCoordinates: 0,
            totalOrders: 0,
            totalVolume: 0,
            totalAmount: 0,
            avgPricePerM3: 0,
          },
          localities: [],
          administrativeAreas1: [],
          sublocalities: [],
          administrativeAreas2: [],
        },
        facets: {
          clients: [],
          localities: [],
          sublocalities: [],
          administrativeAreas1: [],
          administrativeAreas2: [],
          locationDataStatuses: [],
        },
        meta: { startDate, endDate, totalPoints: 0, mapDisplayCap: UBICACIONES_MAP_DISPLAY_CAP },
      });
    }

    const filters = {
      dateRange: {
        from: new Date(`${startDate}T12:00:00`),
        to: new Date(`${endDate}T12:00:00`),
      },
      plantIds: effectivePlantIds,
      clientIds: body.clientIds?.length ? body.clientIds : undefined,
      localityFilter: body.localityFilter?.length ? body.localityFilter : undefined,
      sublocalityFilter: body.sublocalityFilter?.length ? body.sublocalityFilter : undefined,
      administrativeArea1Filter: body.administrativeArea1Filter?.length
        ? body.administrativeArea1Filter
        : undefined,
      administrativeArea2Filter: body.administrativeArea2Filter?.length
        ? body.administrativeArea2Filter
        : undefined,
      locationDataFilter: parseLocationDataFilter(body.locationDataFilter),
    };

    const { data, facets } = await buildLocationReport(service, filters);

    return NextResponse.json({
      data,
      facets,
      meta: {
        startDate,
        endDate,
        totalPoints: data.points.length,
        mapDisplayCap: UBICACIONES_MAP_DISPLAY_CAP,
        export: body.export === true,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[finanzas/ubicaciones]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
