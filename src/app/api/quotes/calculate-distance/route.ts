import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateDistanceInfo } from '@/lib/services/distanceService';

/**
 * Calculate road distance using Google Maps API
 * POST /api/quotes/calculate-distance
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plantId, constructionSiteId, plantLat, plantLng, siteLat, siteLng } = body;

    // Validate input
    if (!plantId && (!plantLat || !plantLng)) {
      return NextResponse.json(
        { error: 'Either plantId or plantLat/plantLng are required' },
        { status: 400 }
      );
    }

    if (!constructionSiteId && (!siteLat || !siteLng)) {
      return NextResponse.json(
        { error: 'Either constructionSiteId or siteLat/siteLng are required' },
        { status: 400 }
      );
    }

    let distanceInfo;

    if (plantId && constructionSiteId) {
      // Use IDs to fetch coordinates and calculate
      distanceInfo = await calculateDistanceInfo(plantId, constructionSiteId);
    } else if (plantLat && plantLng && siteLat && siteLng) {
      // Use provided coordinates directly
      // For this case, we need to determine plant_id to get range configs
      // This is a simplified version - in production, you'd want to pass plantId
      return NextResponse.json(
        { error: 'plantId is required when using coordinates directly to determine range configs' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    return NextResponse.json(distanceInfo);
  } catch (error) {
    console.error('Error calculating distance:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate distance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

