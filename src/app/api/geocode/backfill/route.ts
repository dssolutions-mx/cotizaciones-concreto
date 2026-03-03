import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { reverseGeocode } from '@/services/geocodingService';

/** Google Geocoding API: 25 requests per minute. Use 2.5s between API-call-inducing requests. */
const RATE_LIMIT_MS = 2500;

/**
 * Backfill order_location_metadata for existing orders with coordinates.
 * Respects 25 req/min by spacing processing. Uses cache to minimize API calls.
 * Call repeatedly until remaining === 0 (or cron every minute).
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await authClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedRoles = ['ADMIN', 'ADMIN_OPERATIONS', 'EXECUTIVE'];
    if (!profile?.role || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const batchSize = Math.min(25, Math.max(1, parseInt(url.searchParams.get('batch_size') ?? '25', 10)));

    const supabase = createServiceClient();

    // Orders with coords that don't have metadata yet (via DB function)
    const { data: toProcess, error: fetchError } = await supabase.rpc('get_orders_for_geocode_backfill', {
      p_limit: batchSize,
    });

    if (fetchError) {
      console.error('[Geocode backfill] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!toProcess || toProcess.length === 0) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .not('delivery_latitude', 'is', null)
        .not('delivery_longitude', 'is', null);
      const { count: metaCount } = await supabase
        .from('order_location_metadata')
        .select('order_id', { count: 'exact', head: true });
      const remaining = Math.max(0, (count ?? 0) - (metaCount ?? 0));
      return NextResponse.json({
        processed: 0,
        remaining,
        total: count ?? 0,
        message: remaining === 0 ? 'All orders with coordinates already have metadata.' : 'No orders matched in this batch.',
      });
    }

    let processed = 0;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const orders = toProcess as Array<{ id: string; delivery_latitude: number; delivery_longitude: number }>;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const lat = Number(order.delivery_latitude);
      const lng = Number(order.delivery_longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

      const metadata = await reverseGeocode(lat, lng, {
        supabaseClient: supabase,
        baseUrl,
      });

      if (metadata) {
        await supabase.from('order_location_metadata').upsert(
          {
            order_id: order.id,
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
        await supabase
          .from('orders')
          .update({ location_data_status: 'enriched' })
          .eq('id', order.id);
      } else {
        await supabase
          .from('orders')
          .update({ location_data_status: 'coordinates_only' })
          .eq('id', order.id);
      }
      processed++;

      // Rate limit: 25 req/min ≈ 2.4s between calls. Use 2.5s to be safe.
      if (i < orders.length - 1) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      }
    }

    const { count: totalWithCoords } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('delivery_latitude', 'is', null)
      .not('delivery_longitude', 'is', null);

    const { count: totalMeta } = await supabase
      .from('order_location_metadata')
      .select('order_id', { count: 'exact', head: true });

    const remaining = Math.max(0, (totalWithCoords ?? 0) - (totalMeta ?? 0));

    return NextResponse.json({
      processed,
      remaining,
      total: totalWithCoords ?? 0,
      message:
        remaining > 0
          ? `Processed ${processed}. Call again in ~1 min or run a cron to finish ${remaining} remaining.`
          : 'Backfill complete.',
    });
  } catch (error) {
    console.error('[Geocode backfill] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: stats only (no processing)
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { count: totalWithCoords } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('delivery_latitude', 'is', null)
      .not('delivery_longitude', 'is', null);

    const { count: totalMeta } = await supabase
      .from('order_location_metadata')
      .select('order_id', { count: 'exact', head: true });

    const remaining = Math.max(0, (totalWithCoords ?? 0) - (totalMeta ?? 0));

    return NextResponse.json({
      total_with_coords: totalWithCoords ?? 0,
      enriched: totalMeta ?? 0,
      remaining,
    });
  } catch (error) {
    console.error('[Geocode backfill] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
