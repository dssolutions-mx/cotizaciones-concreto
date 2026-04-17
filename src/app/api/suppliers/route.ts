import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import type { PostgrestError } from '@supabase/supabase-js';

function normalizeProviderLetter(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null
  const one = String(raw).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1)
  return one || null
}

function uniqueViolationMessage(
  error: PostgrestError,
  plantId: string | undefined,
  providerNum: number
): string {
  const msg = error.message ?? ''
  if (
    msg.includes('suppliers_unique_letter') ||
    msg.includes('provider_letter') ||
    msg.includes('suppliers_unique_letter_global') ||
    msg.includes('suppliers_unique_letter_per_plant')
  ) {
    return plantId
      ? 'Ya existe un proveedor con esa letra en esta planta. Use otra letra o déjela en blanco.'
      : 'Ya existe un proveedor con esa letra. Use otra letra o déjela en blanco.'
  }
  if (
    msg.includes('suppliers_unique_number') ||
    msg.includes('provider_number') ||
    msg.includes('suppliers_unique_number_global') ||
    msg.includes('suppliers_unique_number_per_plant')
  ) {
    const providerNumberMatch = msg.match(/provider_number[^=]*=\((\d+)\)/i)
    const n = providerNumberMatch ? providerNumberMatch[1] : String(providerNum)
    return n
      ? `Ya existe un proveedor con el número ${n}${plantId ? ' en esta planta' : ''}.`
      : 'Ya existe un proveedor con ese número.'
  }
  return 'Ya existe un registro con esos datos (duplicado). Revise número y letra.'
}

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

    // Check if user has permission to create suppliers (includes procurement operators)
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || body.provider_number === undefined || body.provider_number === null || !body.plant_id) {
      return NextResponse.json({ error: 'Missing required fields: name, provider_number, plant_id' }, { status: 400 });
    }

    const providerNum = Number(body.provider_number);
    if (!Number.isInteger(providerNum) || providerNum < 1 || providerNum > 99) {
      return NextResponse.json({ error: 'provider_number must be an integer from 1 to 99' }, { status: 400 });
    }

    let terms: number | null
    if (body.default_payment_terms_days === undefined) {
      terms = 30
    } else if (body.default_payment_terms_days === null) {
      terms = null
    } else {
      terms = Number(body.default_payment_terms_days)
      if (Number.isNaN(terms) || terms < 0 || terms > 365) {
        return NextResponse.json({ error: 'default_payment_terms_days must be between 0 and 365' }, { status: 400 })
      }
    }

    const letterRaw = normalizeProviderLetter(body.provider_letter)

    const internalCode =
      body.internal_code != null && String(body.internal_code).trim() !== ''
        ? String(body.internal_code).trim()
        : null;

    let admin
    try {
      admin = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta (service role)' },
        { status: 503 }
      )
    }

    // RLS INSERT allows fewer roles than this API; use service role after app-level checks (same as PATCH suppliers/[id]).
    const { data: supplier, error } = await admin
      .from('suppliers')
      .insert([
        {
          name: String(body.name).trim(),
          provider_number: providerNum,
          plant_id: body.plant_id,
          provider_letter: letterRaw,
          internal_code: internalCode,
          is_active: body.is_active !== false,
          default_payment_terms_days: terms,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      
      // Check for unique constraint violation (PostgreSQL error code 23505)
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        const errorMessage = uniqueViolationMessage(error, body.plant_id, providerNum)
        return NextResponse.json({ error: errorMessage }, { status: 409 });
      }
      
      // Check for check constraint violation (PostgreSQL error code 23514)
      if (error.code === '23514' || error.message?.includes('check constraint')) {
        if (error.message?.includes('suppliers_provider_number_check')) {
          // Mostrar el mensaje real de PostgreSQL para identificar la restricción exacta
          const errorMessage = `El número de proveedor ${providerNum} no cumple con las restricciones de la base de datos. ${error.message || 'Por favor verifica el número e intenta de nuevo.'}`;
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
