/**
 * Standalone backfill for order_location_metadata.
 * Processes orders with coordinates at ~25/min (Google Geocoding API limit).
 * Run: node --env-file=.env.local --import tsx scripts/geocode-backfill.ts
 * Or: npx ts-node --esm -e "require('dotenv').config({path:'.env.local'}); require('./scripts/geocode-backfill.ts')"
 * Simpler: npm run geocode:backfill (add script that loads env)
 */
import { createClient } from '@supabase/supabase-js';

const RATE_LIMIT_MS = 2500; // 25 req/min
const BATCH_SIZE = 25;

function getLocationKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  return `${roundedLat},${roundedLng}`;
}

function extractComponent(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>,
  ...types: string[]
): string | null {
  for (const comp of components) {
    const compTypes = comp.types ?? [];
    if (types.some((t) => compTypes.includes(t))) {
      return comp.longText ?? comp.shortText ?? null;
    }
  }
  return null;
}

function extractShortComponent(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>,
  ...types: string[]
): string | null {
  for (const comp of components) {
    const compTypes = comp.types ?? [];
    if (types.some((t) => compTypes.includes(t))) {
      return comp.shortText ?? comp.longText ?? null;
    }
  }
  return null;
}

async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{
  formatted_address: string | null;
  locality: string | null;
  sublocality: string | null;
  administrative_area_level_1: string | null;
  administrative_area_level_2: string | null;
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
  place_id: string | null;
} | null> {
  const url = `https://geocode.googleapis.com/v4beta/geocode/location/${lat},${lng}?languageCode=es`;
  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey } });
  if (!res.ok) {
    console.error(`[Geocode] API error ${res.status}:`, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    results?: Array<{
      placeId?: string;
      formattedAddress?: string;
      addressComponents?: Array<{
        longText?: string;
        shortText?: string;
        types?: string[];
      }>;
    }>;
  };
  const results = json.results;
  if (!results?.length) return null;
  const first = results[0];
  const components = first.addressComponents ?? [];
  const locality = extractComponent(components, 'locality') ?? null;
  const admin2 = extractComponent(components, 'administrative_area_level_2') ?? null;
  return {
    formatted_address: first.formattedAddress ?? null,
    locality,
    sublocality:
      extractComponent(components, 'sublocality', 'sublocality_level_1', 'neighborhood') ?? null,
    administrative_area_level_1: extractComponent(components, 'administrative_area_level_1') ?? null,
    // Google often omits administrative_area_level_2 for Mexico; use locality as municipio proxy
    administrative_area_level_2: admin2 ?? locality,
    postal_code: extractComponent(components, 'postal_code') ?? null,
    country: extractComponent(components, 'country') ?? null,
    country_code: extractShortComponent(components, 'country') ?? null,
    place_id: first.placeId ?? null,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Missing GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let totalProcessed = 0;
  let batchNum = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: orders, error } = await supabase.rpc('get_orders_for_geocode_backfill', {
      p_limit: BATCH_SIZE,
    });

    if (error) {
      console.error('RPC error:', error);
      process.exit(1);
    }
    if (!orders?.length) {
      console.log('\nBackfill complete.');
      break;
    }

    batchNum++;
    console.log(`\nBatch ${batchNum}: processing ${orders.length} orders...`);

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i] as { id: string; delivery_latitude: number; delivery_longitude: number };
      const lat = Number(o.delivery_latitude);
      const lng = Number(o.delivery_longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

      const locationKey = getLocationKey(lat, lng);

      // 1. Check cache
      const { data: cached } = await supabase
        .from('location_geocode_cache')
        .select('*')
        .eq('location_key', locationKey)
        .maybeSingle();

      let metadata: Awaited<ReturnType<typeof reverseGeocode>>;
      if (cached) {
        metadata = {
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
      } else {
        metadata = await reverseGeocode(lat, lng, apiKey);
        if (metadata) {
          await supabase.from('location_geocode_cache').upsert(
            {
              location_key: locationKey,
              ...metadata,
              enriched_at: new Date().toISOString(),
            },
            { onConflict: 'location_key' }
          );
        }
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      }

      if (metadata) {
        await supabase.from('order_location_metadata').upsert(
          {
            order_id: o.id,
            formatted_address: metadata.formatted_address,
            locality: metadata.locality,
            sublocality: metadata.sublocality,
            administrative_area_level_1: metadata.administrative_area_level_1,
            administrative_area_level_2: metadata.administrative_area_level_2,
            postal_code: metadata.postal_code,
            country: metadata.country,
            country_code: metadata.country_code,
            place_id: metadata.place_id,
          },
          { onConflict: 'order_id' }
        );
        await supabase.from('orders').update({ location_data_status: 'enriched' }).eq('id', o.id);
      } else {
        await supabase.from('orders').update({ location_data_status: 'coordinates_only' }).eq('id', o.id);
      }
      totalProcessed++;
      process.stdout.write(`  ${totalProcessed} done\r`);
    }
  }

  console.log(`Total enriched: ${totalProcessed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
