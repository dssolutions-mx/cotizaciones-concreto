import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';

type RemisionRow = {
  id: string;
  fecha: string;
  remision_number: string | null;
  conductor: string | null;
  unidad: string | null;
  volumen_fabricado: number | string | null;
  tipo_remision?: string | null;
  plant_id?: string | null;
  plant?: { id: string; code: string | null; name: string | null } | null;
  hora_carga?: string | null;
  order_id?: string | null;
  order?: {
    id: string;
    construction_site: string | null;
    client_id?: string | null;
    client?: { id: string; business_name: string | null } | null;
  } | null;
};

function normalizeKey(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  // Normalize unicode + remove diacritics to reduce duplicates like “Pérez” vs “Perez”
  const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.replace(/\s+/g, ' ').toLowerCase();
}

function parseBody<T>(req: NextRequest): Promise<T> {
  return req.json() as Promise<T>;
}

function toYyyyMmDd(input: string): string {
  // Accept yyyy-mm-dd only (table stores DATE-like strings); enforce shape.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error('Invalid date format. Use yyyy-MM-dd.');
  }
  return input;
}

async function getAuthedUserAndProfile(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Route Handlers can't reliably mutate request cookies; set on the outgoing response instead.
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, supabaseResponse };

  // Use service client to read profile regardless of RLS
  const service = createServiceClient();
  const { data: profile } = await service
    .from('user_profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile, supabaseResponse };
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile, supabaseResponse } = await getAuthedUserAndProfile(request);
    if (!user) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
      return res;
    }

    // Only allow internal roles (exclude external client portal users)
    // Allowed roles: ADMINISTRATIVE, ADMIN_OPERATIONS, CREDIT_VALIDATOR, DOSIFICADOR, 
    // EXECUTIVE, PLANT_MANAGER, QUALITY_TEAM, SALES_AGENT, EXTERNAL_SALES_AGENT
    if (!profile || profile.role === 'EXTERNAL_CLIENT') {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
      return res;
    }

    const body = await parseBody<{
      startDate: string;
      endDate: string;
      plantIds?: string[];
      drivers?: string[];
      trucks?: string[];
      day?: string | null;
      search?: string;
      includeTypes?: Array<'CONCRETO' | 'BOMBEO' | string>;
      export?: boolean;
      page?: number;
      pageSize?: number;
    }>(request);

    const startDate = toYyyyMmDd(body.startDate);
    const endDate = toYyyyMmDd(body.endDate);

    const isExport = body.export === true;
    const pageSize = Math.min(Math.max(body.pageSize ?? 50, 10), 250);
    const page = isExport ? 1 : Math.max(body.page ?? 1, 1);

    const plantIds = (body.plantIds ?? []).filter(Boolean);
    const driverFilters = (body.drivers ?? []).map(normalizeKey).filter(Boolean);
    const truckFilters = (body.trucks ?? []).map(normalizeKey).filter(Boolean);
    const day = body.day ? toYyyyMmDd(body.day) : null;
    const search = (body.search ?? '').trim();

    // Default to CONCRETO for “trips” unless caller requests otherwise
    const includeTypes = (body.includeTypes?.length ? body.includeTypes : ['CONCRETO']).map(String);

    // Use service client to bypass RLS - this ensures ADMIN_OPERATIONS and ADMINISTRATIVE can access remisiones
    const service = createServiceClient();
    
    // Verify service client is properly configured (service role key bypasses all RLS)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[HR API] SUPABASE_SERVICE_ROLE_KEY is not set - RLS bypass may not work correctly');
    }

    let q = service
      .from('remisiones')
      .select(
        `
          id,
          fecha,
          remision_number,
          conductor,
          unidad,
          volumen_fabricado,
          tipo_remision,
          plant_id,
          hora_carga,
          order_id,
          plant:plants(id, code, name),
          order:orders(
            id,
            construction_site,
            client_id,
            client:clients(id, business_name)
          )
        `
      )
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (includeTypes.length > 0) q = q.in('tipo_remision', includeTypes);
    if (plantIds.length > 0) q = q.in('plant_id', plantIds);

    if (search) {
      const term = search.replace(/[%_]/g, '\\$&');
      q = q.or(
        [
          `remision_number.ilike.%${term}%`,
          `conductor.ilike.%${term}%`,
          `unidad.ilike.%${term}%`,
        ].join(',')
      );
    }

    const { data, error } = await q.order('fecha', { ascending: true });
    if (error) {
      console.error('Error fetching remisiones:', error);
      console.error('User role:', profile?.role);
      console.error('Date range:', { startDate, endDate });
      return NextResponse.json({ error: 'Failed to fetch remisiones', details: error.message }, { status: 500 });
    }

    // Log for debugging ADMIN_OPERATIONS access issues
    if (profile?.role === 'ADMIN_OPERATIONS' || profile?.role === 'ADMINISTRATIVE') {
      console.log(`[HR API] ${profile.role} user query: ${data?.length ?? 0} remisiones found for range ${startDate} to ${endDate}`);
    }

    const all = ((data ?? []) as RemisionRow[]).filter(r => {
      const driverKey = normalizeKey(r.conductor);
      const truckKey = normalizeKey(r.unidad);

      if (day && r.fecha !== day) return false;
      if (driverFilters.length > 0 && !driverFilters.includes(driverKey)) return false;
      if (truckFilters.length > 0 && !truckFilters.includes(truckKey)) return false;
      return true;
    });

    // Aggregates + facets
    const driverCounts = new Map<string, { display: string; count: number }>();
    const truckCounts = new Map<string, { display: string; count: number }>();
    const plantCounts = new Map<string, { plant_id: string; code: string; name: string; count: number }>();
    const byDay = new Map<string, { date: string; trips: number; volume: number }>();
    const byDriver = new Map<
      string,
      {
        driver_key: string;
        conductor: string;
        trips: number;
        total_volume: number;
        trucks: Set<string>;
        plants: Set<string>;
        dayMatrix: Map<string, number>; // date -> trip count for that day
      }
    >();

    let totalVolume = 0;
    for (const r of all) {
      const volume = Number(r.volumen_fabricado) || 0;
      totalVolume += volume;

      const date = r.fecha;
      const day = byDay.get(date) ?? { date, trips: 0, volume: 0 };
      day.trips += 1;
      day.volume += volume;
      byDay.set(date, day);

      const dKey = normalizeKey(r.conductor);
      const dDisplay = (r.conductor ?? '').trim() || 'Sin conductor';
      if (!driverCounts.has(dKey)) driverCounts.set(dKey, { display: dDisplay, count: 0 });
      driverCounts.get(dKey)!.count += 1;

      const tKey = normalizeKey(r.unidad);
      const tDisplay = (r.unidad ?? '').trim() || 'Sin unidad';
      if (!truckCounts.has(tKey)) truckCounts.set(tKey, { display: tDisplay, count: 0 });
      truckCounts.get(tKey)!.count += 1;

      const pid = r.plant_id ?? 'unknown';
      const pName = r.plant?.name ?? 'Sin planta';
      const pCode = r.plant?.code ?? '—';
      if (!plantCounts.has(pid)) plantCounts.set(pid, { plant_id: pid, name: pName, code: pCode, count: 0 });
      plantCounts.get(pid)!.count += 1;

      // Driver summary
      const driverKey = dKey || 'unknown_driver';
      const entry =
        byDriver.get(driverKey) ??
        ({
          driver_key: driverKey,
          conductor: dDisplay,
          trips: 0,
          total_volume: 0,
          trucks: new Set<string>(),
          plants: new Set<string>(),
          dayMatrix: new Map<string, number>(),
        } as const);
      entry.trips += 1;
      entry.total_volume += volume;
      entry.trucks.add((r.unidad ?? '').trim() || 'Sin unidad');
      entry.plants.add(`${pName} (${pCode})`);
      // Update day matrix
      const dayCount = entry.dayMatrix.get(r.fecha) ?? 0;
      entry.dayMatrix.set(r.fecha, dayCount + 1);
      byDriver.set(driverKey, entry as any);
    }

    const totalTrips = all.length;
    const uniqueDrivers = Array.from(driverCounts.keys()).filter(Boolean).length;
    const uniqueTrucks = Array.from(truckCounts.keys()).filter(Boolean).length;

    // Pagination (in-memory since we compute facets/aggregates)
    const total = all.length;
    const effectivePageSize = isExport ? total : pageSize;
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const rows = isExport ? all : all.slice(startIdx, endIdx);

    const facets = {
      drivers: Array.from(driverCounts.values()).sort((a, b) => b.count - a.count || a.display.localeCompare(b.display)),
      trucks: Array.from(truckCounts.values()).sort((a, b) => b.count - a.count || a.display.localeCompare(b.display)),
      plants: Array.from(plantCounts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      types: includeTypes,
    };

    const res = NextResponse.json({
      startDate,
      endDate,
      page,
      pageSize: effectivePageSize,
      total,
      rows,
      aggregates: {
        trips: totalTrips,
        uniqueDrivers,
        uniqueTrucks,
        totalVolume,
      },
      byDay: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byDriver: Array.from(byDriver.values())
        .map((d) => ({
          driver_key: d.driver_key,
          conductor: d.conductor,
          trips: d.trips,
          total_volume: d.total_volume,
          unique_trucks: d.trucks.size,
          plants: Array.from(d.plants.values()).sort(),
          dayMatrix: Object.fromEntries(d.dayMatrix), // Convert Map to object for JSON serialization
        }))
        .sort((a, b) => b.trips - a.trips || b.total_volume - a.total_volume || a.conductor.localeCompare(b.conductor)),
      facets,
    });
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  } catch (err) {
    console.error('POST /api/hr/remisiones-weekly error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

