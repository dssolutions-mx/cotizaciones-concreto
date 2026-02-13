import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DEFAULT_RADIUS_METERS = 1000;
const MAX_RESULTS = 5;

/**
 * Haversine distance in meters between two points
 */
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/orders/nearby-deliveries
 * Query params: lat, lng, radius (optional, default 150m)
 * Returns orders with delivery coords within radius, ordered by delivery_date DESC
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radius = parseInt(searchParams.get('radius') || String(DEFAULT_RADIUS_METERS), 10);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng are required' },
        { status: 400 }
      );
    }

    // Bounding box to reduce dataset (~0.002 deg ≈ 220m at equator)
    const delta = (radius / 1000) * (1 / 111); // rough: 1 deg ≈ 111km
    const minLat = lat - delta;
    const maxLat = lat + delta;
    const minLng = lng - delta;
    const maxLng = lng + delta;

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        delivery_date,
        delivery_latitude,
        delivery_longitude,
        site_access_rating
      `)
      .not('delivery_latitude', 'is', null)
      .not('delivery_longitude', 'is', null)
      .not('site_access_rating', 'is', null)
      .gte('delivery_latitude', minLat)
      .lte('delivery_latitude', maxLat)
      .gte('delivery_longitude', minLng)
      .lte('delivery_longitude', maxLng)
      .order('delivery_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('nearby-deliveries error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const nearby = (orders || [])
      .filter((o) => {
        const d = haversineDistanceMeters(
          lat,
          lng,
          Number(o.delivery_latitude),
          Number(o.delivery_longitude)
        );
        return d <= radius;
      })
      .slice(0, MAX_RESULTS)
      .map((o) => {
        const deliveryDate = o.delivery_date ? new Date(o.delivery_date) : null;
        const daysAgo = deliveryDate
          ? Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        return {
          id: o.id,
          order_number: o.order_number,
          site_access_rating: o.site_access_rating,
          delivery_date: o.delivery_date,
          days_ago: daysAgo,
        };
      });

    return NextResponse.json({
      nearby,
      radius_meters: radius,
      total_found: nearby.length,
    });
  } catch (err) {
    console.error('nearby-deliveries:', err);
    return NextResponse.json(
      { error: 'Failed to fetch nearby deliveries' },
      { status: 500 }
    );
  }
}
