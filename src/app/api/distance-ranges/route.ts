import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDistanceRangeConfigs } from '@/lib/services/distanceService';

/**
 * GET /api/distance-ranges
 * Get distance range configs for a plant
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');

    if (!plantId) {
      return NextResponse.json(
        { error: 'plant_id query parameter is required' },
        { status: 400 }
      );
    }

    const ranges = await getDistanceRangeConfigs(plantId);
    return NextResponse.json(ranges);
  } catch (error) {
    console.error('Error fetching distance ranges:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch distance ranges',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/distance-ranges
 * Create/update distance range config (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['EXECUTIVE', 'PLANT_MANAGER'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id, // If provided, update existing
      plant_id,
      bloque_number,
      range_code,
      min_distance_km,
      max_distance_km,
      diesel_per_trip,
      maintenance_per_trip,
      operator_bonus_per_trip,
      tires_per_trip,
      total_per_trip,
      diesel_per_m3,
      maintenance_per_m3,
      bonus_per_m3,
      tires_per_m3,
      additive_te_per_m3,
      total_transport_per_m3,
      diferencial,
    } = body;

    if (!plant_id || !bloque_number || !range_code || min_distance_km === undefined || max_distance_km === undefined) {
      return NextResponse.json(
        { error: 'plant_id, bloque_number, range_code, min_distance_km, and max_distance_km are required' },
        { status: 400 }
      );
    }

    const rangeData: any = {
      plant_id,
      bloque_number,
      range_code,
      min_distance_km,
      max_distance_km,
      diesel_per_trip: diesel_per_trip || 0,
      maintenance_per_trip: maintenance_per_trip || 0,
      operator_bonus_per_trip: operator_bonus_per_trip || 0,
      tires_per_trip: tires_per_trip || 0,
      total_per_trip: total_per_trip || 0,
      diesel_per_m3: diesel_per_m3 || 0,
      maintenance_per_m3: maintenance_per_m3 || 0,
      bonus_per_m3: bonus_per_m3 || 0,
      tires_per_m3: tires_per_m3 || 0,
      additive_te_per_m3: additive_te_per_m3 || null,
      total_transport_per_m3: total_transport_per_m3 || 0,
      diferencial: diferencial || null,
      created_by: user.id,
    };

    let data;
    let error;

    if (id) {
      // Update existing
      ({ data, error } = await supabase
        .from('distance_range_configs')
        .update({
          ...rangeData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single());
    } else {
      // Create new
      ({ data, error } = await supabase
        .from('distance_range_configs')
        .insert([rangeData])
        .select()
        .single());
    }

    if (error) {
      console.error('Error saving distance range config:', error);
      return NextResponse.json(
        { error: 'Failed to save range config', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving distance range config:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save distance range config',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

