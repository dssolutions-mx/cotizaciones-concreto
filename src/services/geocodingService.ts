/**
 * Geocoding service using Google Geocoding API v4 (reverse geocoding).
 * Fetches location metadata from coordinates for Mexico-focused address components.
 * Uses /api/geocode/reverse proxy to keep API key server-side.
 */

export interface LocationMetadata {
  formatted_address: string | null;
  locality: string | null; // Ciudad
  sublocality: string | null; // Colonia
  administrative_area_level_1: string | null; // Estado
  administrative_area_level_2: string | null; // Municipio
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
  place_id: string | null;
}

/**
 * Round coordinates to 4 decimals (~11m precision) for cache key
 */
export function getLocationKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  return `${roundedLat},${roundedLng}`;
}

/**
 * Reverse geocode coordinates to address metadata (Mexico-focused).
 * Uses cache lookup first, then Google Geocoding API v4 on miss (via /api/geocode/reverse).
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  options?: {
    supabaseClient?: { from: (table: string) => any };
    /** Base URL for API (e.g. when called from server). Default '' for client. */
    baseUrl?: string;
  }
): Promise<LocationMetadata | null> {
  const locationKey = getLocationKey(lat, lng);

  // 1. Check cache
  if (options?.supabaseClient) {
    const { data: cached } = await options.supabaseClient
      .from('location_geocode_cache')
      .select('*')
      .eq('location_key', locationKey)
      .maybeSingle();

    if (cached) {
      return {
        formatted_address: cached.formatted_address,
        locality: cached.locality,
        sublocality: cached.sublocality,
        administrative_area_level_1: cached.administrative_area_level_1,
        administrative_area_level_2: cached.administrative_area_level_2,
        postal_code: cached.postal_code,
        country: cached.country,
        country_code: cached.country_code,
        place_id: cached.place_id,
      };
    }
  }

  // 2. Call API via proxy (keeps key server-side)
  const baseUrl = options?.baseUrl ?? (typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/geocode/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });

  if (!res.ok) {
    console.error('[Geocoding] API error:', res.status, await res.text());
    return null;
  }

  const { metadata } = (await res.json()) as { metadata: LocationMetadata | null };
  if (!metadata) {
    return null;
  }

  // 3. Write to cache
  if (options?.supabaseClient) {
    await options.supabaseClient.from('location_geocode_cache').upsert(
      {
        location_key: locationKey,
        place_id: metadata.place_id,
        formatted_address: metadata.formatted_address,
        locality: metadata.locality,
        sublocality: metadata.sublocality,
        administrative_area_level_1: metadata.administrative_area_level_1,
        administrative_area_level_2: metadata.administrative_area_level_2,
        postal_code: metadata.postal_code,
        country: metadata.country,
        country_code: metadata.country_code,
        enriched_at: new Date().toISOString(),
      },
      { onConflict: 'location_key' }
    );
  }

  return metadata;
}
