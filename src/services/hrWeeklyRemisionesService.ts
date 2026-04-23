import type { HrComplianceFinding } from '@/lib/hr/complianceFromRuns';

export type HrWeeklyComplianceDispute = {
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
  /** Empty = legacy row; use hallazgosInDispute() for display count. */
  includedFindingKeys?: string[];
};

export type HrWeeklyRemisionRow = {
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

export type HrWeeklyFacets = {
  drivers: Array<{ display: string; count: number }>;
  trucks: Array<{ display: string; count: number }>;
  plants: Array<{ plant_id: string; code: string; name: string; count: number }>;
  types: string[];
};

export type HrWeeklyResponse = {
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  total: number;
  rows: HrWeeklyRemisionRow[];
  aggregates: {
    trips: number;
    uniqueDrivers: number;
    uniqueTrucks: number;
    totalVolume: number;
  };
  byDay: Array<{ date: string; trips: number; volume: number }>;
  byDriver: Array<{
    driver_key: string;
    conductor: string;
    trips: number;
    total_volume: number;
    unique_trucks: number;
    plants: string[];
    dayMatrix: Record<string, number>; // date (yyyy-mm-dd) -> trip count
    /** IncludeCompliance: días con al menos un viaje con hallazgo (conteo por día) */
    complianceDayMatrix?: Record<string, number>;
    /** Viajes sin hallazgo vinculado vs con hallazgo (includeCompliance) */
    compliance?: {
      validTrips: number;
      flaggedTrips: number;
      lastFlaggedDate: string | null;
      flaggedDayStreak: number;
      flaggedDayCount: number;
    };
  }>;
  byUnit?: Array<{
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
  }>;
  facets: HrWeeklyFacets;
  /** Present when the request set includeCompliance: true */
  complianceByRemisionId?: Record<string, HrComplianceFinding[]>;
  complianceByDriverKey?: Record<string, { flaggedTrips: number }>;
  complianceByUnitKey?: Record<string, { flaggedTrips: number }>;
  complianceDisputes?: HrWeeklyComplianceDispute[];
};

export type HrWeeklyRequest = {
  startDate: string;
  endDate: string;
  plantIds?: string[];
  drivers?: string[];
  trucks?: string[];
  day?: string | null;
  search?: string;
  includeTypes?: string[];
  export?: boolean;
  page?: number;
  pageSize?: number;
  includeCompliance?: boolean;
};

export async function fetchHrWeeklyRemisiones(payload: HrWeeklyRequest): Promise<HrWeeklyResponse> {
  const res = await fetch('/api/hr/remisiones-weekly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HR weekly remisiones request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as HrWeeklyResponse;
}

