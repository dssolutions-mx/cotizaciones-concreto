import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface LocationMetadata {
  formatted_address: string | null;
  locality: string | null;
  sublocality: string | null;
  administrative_area_level_1: string | null;
  administrative_area_level_2: string | null;
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
  place_id: string | null;
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

/**
 * Proxy to Google Geocoding API v4 (reverse geocoding).
 * Keeps API key server-side. Returns Mexico-focused address components.
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'lat and lng numbers are required' },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    const url = `https://geocode.googleapis.com/v4beta/geocode/location/${lat},${lng}?languageCode=es`;
    const res = await fetch(url, {
      headers: { 'X-Goog-Api-Key': apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Geocode] API error:', res.status, text);
      return NextResponse.json(
        { error: 'Geocoding API failed', details: text },
        { status: 502 }
      );
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
    if (!results || results.length === 0) {
      return NextResponse.json({ metadata: null });
    }

    const first = results[0];
    const components = first.addressComponents ?? [];

    const locality = extractComponent(components, 'locality') ?? null;
    const admin2 = extractComponent(components, 'administrative_area_level_2') ?? null;
    const metadata: LocationMetadata = {
      formatted_address: first.formattedAddress ?? null,
      locality,
      sublocality:
        extractComponent(components, 'sublocality', 'sublocality_level_1', 'neighborhood') ?? null,
      administrative_area_level_1:
        extractComponent(components, 'administrative_area_level_1') ?? null,
      // Google often omits administrative_area_level_2 for Mexico; use locality as municipio proxy
      administrative_area_level_2: admin2 ?? locality,
      postal_code: extractComponent(components, 'postal_code') ?? null,
      country: extractComponent(components, 'country') ?? null,
      country_code: extractShortComponent(components, 'country') ?? null,
      place_id: first.placeId ?? null,
    };

    return NextResponse.json({ metadata });
  } catch (error) {
    console.error('[Geocode] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
