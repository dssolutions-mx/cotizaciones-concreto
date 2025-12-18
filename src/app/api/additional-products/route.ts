import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAvailableProducts } from '@/lib/services/additionalProductsService';

/**
 * GET /api/additional-products
 * List available additional products
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
    const plantId = searchParams.get('plant_id') || undefined;

    const products = await getAvailableProducts(plantId);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching additional products:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch additional products',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/additional-products
 * Create new additional product (admin only)
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
    const { code, name, description, category, unit, base_price, plant_id, requires_distance_calculation, distance_rate_per_km } = body;

    if (!code || !name || !category || base_price === undefined) {
      return NextResponse.json(
        { error: 'code, name, category, and base_price are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('additional_products')
      .insert({
        code,
        name,
        description: description || null,
        category,
        unit: unit || 'M3',
        base_price,
        plant_id: plant_id || null,
        requires_distance_calculation: requires_distance_calculation || false,
        distance_rate_per_km: distance_rate_per_km || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating additional product:', error);
      return NextResponse.json(
        { error: 'Failed to create product', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating additional product:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create additional product',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

