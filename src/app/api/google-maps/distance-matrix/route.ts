import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Proxy to Google Maps Distance Matrix API
 * This protects the API key by keeping it server-side
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { origins, destinations } = body;

    if (!origins || !destinations) {
      return NextResponse.json(
        { error: 'origins and destinations are required' },
        { status: 400 }
      );
    }

    // Prefer server-side only variable for security, but fallback to NEXT_PUBLIC_ if needed
    // Note: NEXT_PUBLIC_ variables are exposed to client, so GOOGLE_MAPS_API_KEY is preferred
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found.');
      console.error('Please set either GOOGLE_MAPS_API_KEY (recommended) or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file');
      return NextResponse.json(
        { 
          error: 'Google Maps API key not configured',
          message: 'Set GOOGLE_MAPS_API_KEY (preferred) or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file'
        },
        { status: 500 }
      );
    }

    // Format origins and destinations for Google Maps API
    const originsStr = origins.map((o: { lat: number; lng: number }) => `${o.lat},${o.lng}`).join('|');
    const destinationsStr = destinations.map((d: { lat: number; lng: number }) => `${d.lat},${d.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originsStr)}&destinations=${encodeURIComponent(destinationsStr)}&units=metric&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    // Check for API errors
    if (data.status === 'REQUEST_DENIED') {
      console.error('Google Maps API key error:', data.error_message || 'API key invalid or not authorized');
      return NextResponse.json(
        { 
          error: 'Google Maps API key error', 
          message: data.error_message || 'API key invalid or Distance Matrix API not enabled',
          status: data.status 
        },
        { status: 500 }
      );
    }

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data);
      return NextResponse.json(
        { error: `Google Maps API error: ${data.status}`, details: data },
        { status: 500 }
      );
    }

    // Check element status
    if (data.rows?.[0]?.elements?.[0]?.status !== 'OK') {
      const elementStatus = data.rows?.[0]?.elements?.[0]?.status;
      console.error('Google Maps element error:', elementStatus);
      return NextResponse.json(
        { 
          error: 'Distance calculation failed', 
          status: elementStatus,
          message: `Unable to calculate distance: ${elementStatus}`
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in distance-matrix proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

