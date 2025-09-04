import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  GetActivitiesQuerySchema,
  MaterialAdjustmentInputSchema,
  UpdateMaterialAdjustmentSchema 
} from '@/lib/validations/inventory';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const queryParams = {
      date_from: searchParams.get('date_from') || (date ? date : new Date().toISOString().split('T')[0]), // Default to today
      date_to: searchParams.get('date_to') || (date ? date : new Date().toISOString().split('T')[0]), // Default to today
      material_id: searchParams.get('material_id') || undefined,
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
    };

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    // Validate query parameters
    const validatedQuery = GetActivitiesQuerySchema.parse(queryParams);

    // Build query for material adjustments
    // For EXECUTIVE users, allow filtering by plant_id, otherwise use user's plant_id
    let query = supabase
      .from('material_adjustments')
      .select(`
        *,
        materials:material_id (
          material_name,
          category,
          unit
        )
      `);
    
    // Apply plant filter based on user role
    if (profile.role === 'EXECUTIVE' || profile.role === 'ADMIN_OPERATIONS') {
      // Executives and Admin Operations can see all plants, but if plant_id is provided in query, filter by it
      const queryPlantId = searchParams.get('plant_id');
      if (queryPlantId) {
        console.log('EXECUTIVE: Filtering by query plant_id:', queryPlantId);
        query = query.eq('plant_id', queryPlantId);
      } else {
        console.log('EXECUTIVE/ADMIN_OPERATIONS: No plant filter applied - seeing all plants');
      }
    } else {
      // Other users can only see their assigned plant
      console.log('NON-EXECUTIVE: Filtering by user plant_id:', profile.plant_id);
      if (!profile.plant_id) {
        console.log('WARNING: User has no plant_id assigned!');
      }
      query = query.eq('plant_id', profile.plant_id);
    }

    if (validatedQuery.date_from) {
      console.log('Applying date_from filter:', validatedQuery.date_from);
      query = query.gte('adjustment_date', validatedQuery.date_from);
    }

    if (validatedQuery.date_to) {
      console.log('Applying date_to filter:', validatedQuery.date_to);
      query = query.lte('adjustment_date', validatedQuery.date_to);
    }

    // If neither date_from nor date_to is provided, use the date parameter as both
    if (!validatedQuery.date_from && !validatedQuery.date_to) {
      const dateParam = searchParams.get('date');
      if (dateParam) {
        console.log('Applying single date filter:', dateParam);
        query = query.eq('adjustment_date', dateParam);
      }
    }

    if (validatedQuery.material_id) {
      query = query.eq('material_id', validatedQuery.material_id);
    }

    // Get material adjustments with pagination
    const { data: adjustments, error: adjustmentsError } = await query
      .order('adjustment_date', { ascending: false })
      .order('adjustment_time', { ascending: false })
      .range(validatedQuery.offset, validatedQuery.offset + validatedQuery.limit - 1);

    if (adjustmentsError) {
      console.error('Adjustments query error:', adjustmentsError);
      throw new Error(`Error al obtener ajustes de material: ${adjustmentsError.message}`);
    }

    console.log('=== ADJUSTMENTS API DEBUG ===');
    console.log('User profile:', {
      id: profile.id,
      role: profile.role,
      plant_id: profile.plant_id,
      business_unit_id: profile.business_unit_id
    });
    console.log('Query parameters:', {
      date_from: validatedQuery.date_from,
      date_to: validatedQuery.date_to,
      material_id: validatedQuery.material_id
    });
    console.log('Search params:', Object.fromEntries(searchParams.entries()));

    // Try to get a count first to see if table exists
    const { count, error: countError } = await supabase
      .from('material_adjustments')
      .select('*', { count: 'exact', head: true });

    console.log('Table count result:', { count, countError });

    console.log('Adjustments query result:', {
      adjustmentsCount: adjustments?.length || 0,
      adjustments: adjustments?.slice(0, 3).map(adj => ({
        id: adj.id,
        adjustment_date: adj.adjustment_date,
        plant_id: adj.plant_id,
        adjustment_type: adj.adjustment_type,
        quantity_adjusted: adj.quantity_adjusted
      }))
    });

    return NextResponse.json({
      success: true,
      adjustments: adjustments, // Return as 'adjustments' to match frontend expectation
      pagination: {
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
        hasMore: adjustments.length === validatedQuery.limit,
      },
    });

  } catch (error) {
    console.error('Error in adjustments GET:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Parámetros de consulta inválidos', details: error.message },
          { status: 400 }
        );
      }
      
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    const body = await request.json();

    // Validate material adjustment data
    const validatedData = MaterialAdjustmentInputSchema.parse(body);

    // Use plant_id from request body or fallback to profile's plant_id
    const plantId = validatedData.plant_id || profile.plant_id;
    
    if (!plantId) {
      return NextResponse.json({ error: 'No se pudo determinar la planta' }, { status: 400 });
    }

    // Generate adjustment number
    const adjustmentDate = validatedData.adjustment_date || new Date().toISOString().split('T')[0];
    const dateStr = adjustmentDate.replace(/-/g, '');
    
    // Get current sequence number
    const { data: lastAdjustment } = await supabase
      .from('material_adjustments')
      .select('adjustment_number')
      .eq('plant_id', plantId)
      .ilike('adjustment_number', `ADJ-${dateStr}-%`)
      .order('adjustment_number', { ascending: false })
      .limit(1)
      .single();

    const sequence = lastAdjustment ? parseInt(lastAdjustment.adjustment_number.split('-').pop() || '0') + 1 : 1;
    const adjustmentNumber = `ADJ-${dateStr}-${sequence.toString().padStart(3, '0')}`;

    // Get current inventory to calculate before/after values
    const { data: currentInventory } = await supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', plantId)
      .eq('material_id', validatedData.material_id)
      .single();

    const inventoryBefore = currentInventory?.current_stock || 0;
    const inventoryAfter = inventoryBefore - validatedData.quantity_adjusted;

    // Create adjustment
    const { data: result, error: adjustmentError } = await supabase
      .from('material_adjustments')
      .insert({
        adjustment_number: adjustmentNumber,
        plant_id: plantId,
        material_id: validatedData.material_id,
        adjustment_date: adjustmentDate,
        adjustment_time: new Date().toTimeString().split(' ')[0],
        adjustment_type: validatedData.adjustment_type,
        quantity_adjusted: validatedData.quantity_adjusted,
        inventory_before: inventoryBefore,
        inventory_after: inventoryAfter,
        reference_type: validatedData.reference_type,
        reference_notes: validatedData.reference_notes,
        adjusted_by: user.id,
      })
      .select()
      .single();

    if (adjustmentError) {
      console.error('Error creating adjustment:', adjustmentError);
      throw new Error(`Error al crear ajuste: ${adjustmentError.message}`);
    }

    console.log('=== ADJUSTMENT CREATED SUCCESSFULLY ===');
    console.log('Created adjustment:', {
      id: result.id,
      adjustment_number: result.adjustment_number,
      plant_id: result.plant_id,
      adjustment_date: result.adjustment_date,
      adjustment_type: result.adjustment_type,
      quantity_adjusted: result.quantity_adjusted,
      reference_notes: result.reference_notes
    });

    // Verify the adjustment was saved by querying it back
    const { data: verifyAdjustment, error: verifyError } = await supabase
      .from('material_adjustments')
      .select('*')
      .eq('id', result.id)
      .single();

    console.log('Verification query result:', { verifyAdjustment, verifyError });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Ajuste de material creado exitosamente',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in adjustments POST:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Datos de entrada inválidos', details: error.message },
          { status: 400 }
        );
      }
      
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      // Check for database constraint errors
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un ajuste con este número' },
          { status: 409 }
        );
      }

      // Check for foreign key constraint errors
      if (error.message.includes('foreign key')) {
        return NextResponse.json(
          { success: false, error: 'Material no válido' },
          { status: 400 }
        );
      }

      // Check for insufficient inventory
      if (error.message.includes('insufficient') || error.message.includes('insuficiente')) {
        return NextResponse.json(
          { success: false, error: 'Inventario insuficiente para este ajuste' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    const body = await request.json();

    // Validate update data
    const validatedData = UpdateMaterialAdjustmentSchema.parse(body);
    const { id, ...updateData } = validatedData;

    // Update material adjustment
    const { data: result, error: updateError } = await supabase
      .from('material_adjustments')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('plant_id', profile.plant_id) // Ensure user can only update their plant's adjustments
      .select()
      .single();

    if (updateError) {
      throw new Error(`Error al actualizar ajuste: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Ajuste de material actualizado exitosamente',
    });

  } catch (error) {
    console.error('Error in adjustments PUT:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Datos de actualización inválidos', details: error.message },
          { status: 400 }
        );
      }
      
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      // Check if adjustment doesn't exist or user doesn't have access
      if (error.message.includes('not found') || error.message.includes('no encontrado')) {
        return NextResponse.json(
          { success: false, error: 'Ajuste de material no encontrado o sin permisos para modificarlo' },
          { status: 404 }
        );
      }

      // Check for foreign key constraint errors
      if (error.message.includes('foreign key')) {
        return NextResponse.json(
          { success: false, error: 'Material no válido' },
          { status: 400 }
        );
      }

      // Check for insufficient inventory
      if (error.message.includes('insufficient') || error.message.includes('insuficiente')) {
        return NextResponse.json(
          { success: false, error: 'Inventario insuficiente para este ajuste' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
