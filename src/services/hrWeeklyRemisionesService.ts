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
  }>;
  facets: HrWeeklyFacets;
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

