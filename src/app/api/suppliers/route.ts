import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if user has permission to view suppliers
    const allowedRoles = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR', 'QUALITY_TEAM'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');

    // Build query for suppliers
    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('provider_number');

    // Filter by plant if specified
    if (plantId) {
      query = query.eq('plant_id', plantId);
    }

    // Fetch suppliers
    const { data: suppliers, error } = await query;

    if (error) {
      console.error('Error fetching suppliers:', error);
      return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }

    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('Error in suppliers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if user has permission to create suppliers
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.provider_number || !body.plant_id) {
      return NextResponse.json({ error: 'Missing required fields: name, provider_number, plant_id' }, { status: 400 });
    }

    // Create supplier
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert([{
        ...body,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      
      // Check for unique constraint violation (PostgreSQL error code 23505)
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        // Try to extract provider number from error message
        const providerNumberMatch = error.message?.match(/provider_number[^=]*=\((\d+)\)/i);
        const providerNumber = providerNumberMatch ? providerNumberMatch[1] : body.provider_number;
        
        const errorMessage = providerNumber 
          ? `Ya existe un proveedor con el número ${providerNumber}${body.plant_id ? ' en esta planta' : ''}.`
          : 'Ya existe un proveedor con ese número.';
        
        return NextResponse.json({ error: errorMessage }, { status: 409 });
      }
      
      // Check for check constraint violation (PostgreSQL error code 23514)
      if (error.code === '23514' || error.message?.includes('check constraint')) {
        if (error.message?.includes('suppliers_provider_number_check')) {
          // Mostrar el mensaje real de PostgreSQL para identificar la restricción exacta
          const errorMessage = `El número de proveedor ${body.provider_number} no cumple con las restricciones de la base de datos. ${error.message || 'Por favor verifica el número e intenta de nuevo.'}`;
          return NextResponse.json({ error: errorMessage }, { status: 400 });
        }
        return NextResponse.json({ 
          error: error.message || 'Los datos proporcionados no cumplen con las restricciones requeridas.' 
        }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Error in suppliers POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
