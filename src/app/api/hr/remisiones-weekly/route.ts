import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import {
  buildComplianceByDriverKey,
  buildComplianceByRemisionId,
  buildComplianceByUnitKey,
  type HrComplianceFinding,
} from '@/lib/hr/complianceFromRuns';

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
  is_production_record?: boolean | null;
  cross_plant_billing_plant_id?: string | null;
  billing_plant?: { id: string; code: string | null; name: string | null } | null;
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

/** From compliance day matrix (date -> flagged trip count that day); streak ends at last flagged day. */
function computeFlaggedDayMeta(cdm: Record<string, number>): {
  lastFlaggedDate: string | null;
  flaggedDayStreak: number;
  flaggedDayCount: number;
} {
  const daysWith = Object.entries(cdm)
    .filter(([, n]) => n > 0)
    .map(([d]) => d)
    .sort();
  if (daysWith.length === 0) {
    return { lastFlaggedDate: null, flaggedDayStreak: 0, flaggedDayCount: 0 };
  }
  const lastFlaggedDate = daysWith[daysWith.length - 1]!;
  const flaggedDayCount = daysWith.length;
  let streak = 0;
  const cur = new Date(`${lastFlaggedDate}T12:00:00.000Z`);
  for (let i = 0; i < 14; i++) {
    const ymd = cur.toISOString().slice(0, 10);
    if ((cdm[ymd] ?? 0) <= 0) break;
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return { lastFlaggedDate, flaggedDayStreak: streak, flaggedDayCount };
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
    .select('id, role, plant_id, business_unit_id')
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
      /** When true, includes compliance findings and disputes in range (for RH weekly). */
      includeCompliance?: boolean;
    }>(request);

    const startDate = toYyyyMmDd(body.startDate);
    const endDate = toYyyyMmDd(body.endDate);

    const isExport = body.export === true;
    const pageSize = Math.min(Math.max(body.pageSize ?? 50, 10), 250);
    const page = isExport ? 1 : Math.max(body.page ?? 1, 1);

    const plantIdsFromBody = (body.plantIds ?? []).filter(Boolean);
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

    // Compute effective plant filter for DOSIFICADOR/PLANT_MANAGER (hierarchical model)
    // - plant_id: locked to that plant
    // - business_unit_id (no plant): can switch within BU; intersect with body.plantIds
    // - neither: no restriction, use body as-is
    let effectivePlantIds: string[] = plantIdsFromBody;
    if (profile && (profile.role === 'DOSIFICADOR' || profile.role === 'PLANT_MANAGER')) {
      if (profile.plant_id) {
        effectivePlantIds = [profile.plant_id];
      } else if (profile.business_unit_id) {
        const { data: buPlants } = await service
          .from('plants')
          .select('id')
          .eq('business_unit_id', profile.business_unit_id);
        const buPlantIds = (buPlants ?? []).map((p: { id: string }) => p.id);
        effectivePlantIds =
          plantIdsFromBody.length > 0
            ? plantIdsFromBody.filter((id) => buPlantIds.includes(id))
            : buPlantIds;
      }
    }

    // Build base query (will be reused for pagination)
    const buildBaseQuery = () => {
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
            is_production_record,
            cross_plant_billing_plant_id,
            plant:plants!plant_id(id, code, name),
            billing_plant:plants!cross_plant_billing_plant_id(id, code, name),
            order:orders(
              id,
              construction_site,
              client_id,
              client:clients(id, business_name)
            )
          `,
          { count: 'exact' }
        )
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: true });

      if (includeTypes.length > 0) q = q.in('tipo_remision', includeTypes);
      if (effectivePlantIds.length > 0) q = q.in('plant_id', effectivePlantIds);

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

      return q;
    };

    // Fetch all remisiones using pagination to avoid 1000 row limit
    const fetchPageSize = 1000; // Supabase's default limit
    let allRemisiones: RemisionRow[] = [];
    let from = 0;
    let totalCount: number | null = null;
    let pageCount = 0;
    const maxPages = 1000; // Safety limit to prevent infinite loops

    while (pageCount < maxPages) {
      const q = buildBaseQuery();
      const { data, error, count } = await q.range(from, from + fetchPageSize - 1);

      if (error) {
        console.error('Error fetching remisiones:', error);
        console.error('User role:', profile?.role);
        console.error('Date range:', { startDate, endDate });
        console.error('Pagination state:', { from, pageCount, totalCount });
        return NextResponse.json({ error: 'Failed to fetch remisiones' }, { status: 500 });
      }

      // Set total count on first page
      if (totalCount === null) {
        totalCount = count ?? 0;
        // Log for debugging ADMIN_OPERATIONS access issues
        if (profile?.role === 'ADMIN_OPERATIONS' || profile?.role === 'ADMINISTRATIVE') {
          console.log(`[HR API] ${profile.role} user query: ${totalCount} total remisiones found for range ${startDate} to ${endDate}`);
        }
      }

      if (!data || data.length === 0) {
        break; // No more data
      }

      allRemisiones = allRemisiones.concat(data as RemisionRow[]);
      pageCount++;

      // If we got fewer rows than the page size, we've reached the end
      if (data.length < fetchPageSize) {
        break;
      }

      from += fetchPageSize;
    }

    // Safety check: if we hit max pages, log a warning
    if (pageCount >= maxPages) {
      console.warn(`[HR API] Pagination stopped at ${maxPages} pages. Total remisiones fetched: ${allRemisiones.length}, expected: ${totalCount}`);
    }

    const all = (allRemisiones as RemisionRow[]).filter(r => {
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
    const byUnit = new Map<
      string,
      {
        unit_key: string;
        unidad: string;
        trips: number;
        total_volume: number;
        drivers: Set<string>;
        plants: Set<string>;
        dayMatrix: Map<string, number>;
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

      // Unit summary
      const unitKey = tKey || 'unknown_unit';
      const uEntry =
        byUnit.get(unitKey) ??
        ({
          unit_key: unitKey,
          unidad: tDisplay,
          trips: 0,
          total_volume: 0,
          drivers: new Set<string>(),
          plants: new Set<string>(),
          dayMatrix: new Map<string, number>(),
        } as const);
      uEntry.trips += 1;
      uEntry.total_volume += volume;
      uEntry.drivers.add((r.conductor ?? '').trim() || 'Sin conductor');
      uEntry.plants.add(`${pName} (${pCode})`);
      const uDayCount = uEntry.dayMatrix.get(r.fecha) ?? 0;
      uEntry.dayMatrix.set(r.fecha, uDayCount + 1);
      byUnit.set(unitKey, uEntry as any);
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

    let complianceByRemisionId: Record<string, HrComplianceFinding[]> | undefined;
    let complianceByDriverKey:
      | Record<string, { flaggedTrips: number }>
      | undefined;
    let complianceByUnitKey: Record<string, { flaggedTrips: number }> | undefined;
    let complianceDisputes: Array<{
      id: string;
      category: string;
      status: string;
      subject: string | null;
      body: string | null;
      sent_at: string | null;
      resolved_at: string | null;
      resolution_notes: string | null;
      recipients: { to: string[]; cc: string[] } | null;
      run: { target_date: string } | null;
      plant: { id: string; code: string | null; name: string | null } | null;
      sender: { email: string | null } | null;
      includedFindingKeys: string[];
    }> | undefined;

    if (body.includeCompliance) {
      const plantSet =
        effectivePlantIds.length > 0 ? new Set(effectivePlantIds) : null;
      const { data: runRows, error: runErr } = await service
        .from('compliance_daily_runs')
        .select('id, target_date, report')
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      if (runErr) {
        console.error('[HR API] compliance_daily_runs:', runErr);
      }

      const runs = (runRows ?? []) as Array<{
        id: string;
        target_date: string;
        report: unknown;
      }>;
      complianceByRemisionId = buildComplianceByRemisionId(runs, plantSet);
      complianceByDriverKey = buildComplianceByDriverKey(all, complianceByRemisionId);
      complianceByUnitKey = buildComplianceByUnitKey(all, complianceByRemisionId);

      const runIds = runs.map((r) => r.id);
      if (runIds.length > 0) {
        const { data: discRows, error: discErr } = await service
          .from('compliance_daily_disputes')
          .select(
            `id, category, status, subject, body, sent_at, resolved_at, resolution_notes, recipients, included_finding_keys,
             run:run_id(target_date),
             plant:plant_id(id, code, name),
             sender:sent_by(email)`,
          )
          .in('run_id', runIds)
          .order('sent_at', { ascending: false })
          .limit(200);

        if (discErr) {
          console.error('[HR API] compliance_daily_disputes:', discErr);
          complianceDisputes = [];
        } else {
          const raw = (discRows ?? []) as Array<Record<string, unknown>>;
          complianceDisputes = raw
            .filter((r) => {
              if (effectivePlantIds.length === 0) return true;
              const p = r.plant as { id?: string } | null;
              return p?.id && effectivePlantIds.includes(p.id);
            })
            .map((r) => ({
              id: r.id as string,
              category: r.category as string,
              status: r.status as string,
              subject: (r.subject as string | null) ?? null,
              body: (r.body as string | null) ?? null,
              sent_at: (r.sent_at as string | null) ?? null,
              resolved_at: (r.resolved_at as string | null) ?? null,
              resolution_notes: (r.resolution_notes as string | null) ?? null,
              recipients: r.recipients as { to: string[]; cc: string[] } | null,
              run: (r.run as { target_date: string } | null) ?? null,
              plant: (r.plant as {
                id: string;
                code: string | null;
                name: string | null;
              } | null) ?? null,
              sender: (r.sender as { email: string | null } | null) ?? null,
              includedFindingKeys: Array.isArray(r.included_finding_keys)
                ? (r.included_finding_keys as string[])
                : [],
            }));
        }
      } else {
        complianceDisputes = [];
      }
    }

    const driverComplianceDay = new Map<string, Map<string, number>>();
    const unitComplianceDay = new Map<string, Map<string, number>>();
    if (complianceByRemisionId) {
      for (const r of all) {
        if (!complianceByRemisionId[r.id]?.length) continue;
        const dk = normalizeKey(r.conductor) || 'unknown_driver';
        const uk = normalizeKey(r.unidad) || 'unknown_unit';
        const fd = r.fecha;
        const dm = driverComplianceDay.get(dk) ?? new Map<string, number>();
        dm.set(fd, (dm.get(fd) ?? 0) + 1);
        driverComplianceDay.set(dk, dm);
        const um = unitComplianceDay.get(uk) ?? new Map<string, number>();
        um.set(fd, (um.get(fd) ?? 0) + 1);
        unitComplianceDay.set(uk, um);
      }
    }

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
        .map((d) => {
          const cdm: Record<string, number> = complianceByRemisionId
            ? Object.fromEntries(driverComplianceDay.get(d.driver_key) ?? new Map())
            : {};
          const row: {
            driver_key: string;
            conductor: string;
            trips: number;
            total_volume: number;
            unique_trucks: number;
            plants: string[];
            dayMatrix: Record<string, number>;
            complianceDayMatrix?: Record<string, number>;
            compliance?: {
              validTrips: number;
              flaggedTrips: number;
              lastFlaggedDate: string | null;
              flaggedDayStreak: number;
              flaggedDayCount: number;
            };
          } = {
            driver_key: d.driver_key,
            conductor: d.conductor,
            trips: d.trips,
            total_volume: d.total_volume,
            unique_trucks: d.trucks.size,
            plants: Array.from(d.plants.values()).sort(),
            dayMatrix: Object.fromEntries(d.dayMatrix),
          };
          if (complianceByRemisionId) {
            row.complianceDayMatrix = cdm;
          }
          if (complianceByDriverKey) {
            const rawFlagged = complianceByDriverKey[d.driver_key]?.flaggedTrips ?? 0;
            const flagged = Math.min(d.trips, Math.max(0, rawFlagged));
            const dayMeta = computeFlaggedDayMeta(cdm);
            row.compliance = {
              validTrips: Math.max(0, d.trips - flagged),
              flaggedTrips: flagged,
              lastFlaggedDate: dayMeta.lastFlaggedDate,
              flaggedDayStreak: dayMeta.flaggedDayStreak,
              flaggedDayCount: dayMeta.flaggedDayCount,
            };
          }
          return row;
        })
        .sort((a, b) => b.trips - a.trips || b.total_volume - a.total_volume || a.conductor.localeCompare(b.conductor)),
      byUnit: Array.from(byUnit.values())
        .map((u) => {
          const cdm: Record<string, number> = complianceByRemisionId
            ? Object.fromEntries(unitComplianceDay.get(u.unit_key) ?? new Map())
            : {};
          const row: {
            unit_key: string;
            unidad: string;
            trips: number;
            total_volume: number;
            unique_drivers: number;
            plants: string[];
            dayMatrix: Record<string, number>;
            complianceDayMatrix?: Record<string, number>;
            compliance?: {
              validTrips: number;
              flaggedTrips: number;
              lastFlaggedDate: string | null;
              flaggedDayStreak: number;
              flaggedDayCount: number;
            };
          } = {
            unit_key: u.unit_key,
            unidad: u.unidad,
            trips: u.trips,
            total_volume: u.total_volume,
            unique_drivers: u.drivers.size,
            plants: Array.from(u.plants.values()).sort(),
            dayMatrix: Object.fromEntries(u.dayMatrix),
          };
          if (complianceByRemisionId) {
            row.complianceDayMatrix = cdm;
          }
          if (complianceByUnitKey) {
            const rawFlagged = complianceByUnitKey[u.unit_key]?.flaggedTrips ?? 0;
            const flagged = Math.min(u.trips, Math.max(0, rawFlagged));
            const dayMeta = computeFlaggedDayMeta(cdm);
            row.compliance = {
              validTrips: Math.max(0, u.trips - flagged),
              flaggedTrips: flagged,
              lastFlaggedDate: dayMeta.lastFlaggedDate,
              flaggedDayStreak: dayMeta.flaggedDayStreak,
              flaggedDayCount: dayMeta.flaggedDayCount,
            };
          }
          return row;
        })
        .sort(
          (a, b) =>
            b.trips - a.trips || b.total_volume - a.total_volume || a.unidad.localeCompare(b.unidad),
        ),
      facets,
      ...(complianceByRemisionId
        ? {
            complianceByRemisionId,
            complianceByDriverKey: complianceByDriverKey ?? {},
            complianceByUnitKey: complianceByUnitKey ?? {},
            complianceDisputes: complianceDisputes ?? [],
          }
        : {}),
    });
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  } catch (err) {
    console.error('POST /api/hr/remisiones-weekly error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

