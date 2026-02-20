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

    const products = await getAvailableProducts(plantId, supabase as any);
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
    const {
      code: codeIn,
      name,
      description,
      category,
      unit: unitIn,
      base_price,
      plant_id,
      requires_distance_calculation,
      distance_rate_per_km,
      billing_type
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }
    if (base_price === undefined || typeof base_price !== 'number' || base_price < 0) {
      return NextResponse.json(
        { error: 'base_price is required and must be a non-negative number' },
        { status: 400 }
      );
    }

    const normalizedBillingType = billing_type || 'PER_M3';
    if (!['PER_M3', 'PER_ORDER_FIXED', 'PER_UNIT'].includes(normalizedBillingType)) {
      return NextResponse.json(
        { error: 'billing_type must be PER_M3, PER_ORDER_FIXED, or PER_UNIT' },
        { status: 400 }
      );
    }

    const unitDefaults: Record<string, string> = {
      PER_M3: 'm3',
      PER_UNIT: 'unidad',
      PER_ORDER_FIXED: 'orden',
    };
    const resolvedUnit = (unitIn && String(unitIn).trim()) || unitDefaults[normalizedBillingType] || 'm3';

    const generateCode = (): string =>
      `ADDL-${Date.now().toString(36)}-${Math.floor(1000 + Math.random() * 9000)}`;

    let resolvedCode = (codeIn && String(codeIn).trim()) ? String(codeIn).trim().toUpperCase() : null;
    if (!resolvedCode) {
      resolvedCode = generateCode();
    }

    const insertPayload = {
      code: resolvedCode,
      name: name.trim(),
      description: description || null,
      category: category || 'OTHER',
      unit: resolvedUnit,
      base_price,
      plant_id: plant_id || null,
      requires_distance_calculation: requires_distance_calculation || false,
      distance_rate_per_km: distance_rate_per_km || null,
      billing_type: normalizedBillingType,
      created_by: user.id,
    };

    const maxRetries = 3;
    let lastError: unknown = null;
    let data: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        resolvedCode = generateCode();
        insertPayload.code = resolvedCode;
      }
      const { data: inserted, error } = await supabase
        .from('additional_products')
        .insert(insertPayload)
        .select()
        .single();

      if (!error) {
        data = inserted;
        break;
      }
      lastError = error;
      const isConflict = (error as { code?: string })?.code === '23505' || String((error as Error).message).toLowerCase().includes('unique') || String((error as Error).message).toLowerCase().includes('duplicate');
      if (!isConflict || attempt === maxRetries - 1) break;
    }

    if (lastError || !data) {
      console.error('Error creating additional product:', lastError);
      return NextResponse.json(
        { error: 'Failed to create product', details: lastError ? (lastError as Error).message : 'Unknown error' },
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

/**
 * PUT /api/additional-products
 * Update additional product (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      id,
      code,
      name,
      description,
      category,
      unit,
      base_price,
      is_active,
      requires_distance_calculation,
      distance_rate_per_km,
      billing_type
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (code !== undefined) updatePayload.code = code;
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description || null;
    if (category !== undefined) updatePayload.category = category;
    if (unit !== undefined) updatePayload.unit = unit;
    if (base_price !== undefined) updatePayload.base_price = base_price;
    if (is_active !== undefined) updatePayload.is_active = !!is_active;
    if (requires_distance_calculation !== undefined) {
      updatePayload.requires_distance_calculation = !!requires_distance_calculation;
    }
    if (distance_rate_per_km !== undefined) updatePayload.distance_rate_per_km = distance_rate_per_km;

    if (billing_type !== undefined) {
      if (!['PER_M3', 'PER_ORDER_FIXED', 'PER_UNIT'].includes(billing_type)) {
        return NextResponse.json(
          { error: 'billing_type must be PER_M3, PER_ORDER_FIXED, or PER_UNIT' },
          { status: 400 }
        );
      }
      updatePayload.billing_type = billing_type;
    }

    const { data, error } = await supabase
      .from('additional_products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating additional product:', error);
      return NextResponse.json(
        { error: 'Failed to update product', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating additional product:', error);
    return NextResponse.json(
      {
        error: 'Failed to update additional product',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

