import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  GetActivitiesQuerySchema,
  MaterialEntryInputSchema,
  UpdateMaterialEntrySchema 
} from '@/lib/validations/inventory';

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/inventory/entries called');
    
    const supabase = await createServerSupabaseClient();
    console.log('Supabase client created');

    const { searchParams } = new URL(request.url);
    const queryParams = {
      date: searchParams.get('date') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      material_id: searchParams.get('material_id') || undefined,
      pricing_status: searchParams.get('pricing_status') || undefined,
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
    };
    
    console.log('Query params:', queryParams);

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('Auth error:', authError);
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }
    
    console.log('User authenticated:', user.id);

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.log('Profile error:', profileError);
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }
    
    console.log('User profile:', { id: profile.id, role: profile.role, plant_id: profile.plant_id, business_unit_id: profile.business_unit_id });

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('User role not allowed:', profile.role);
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }
    
    console.log('User has inventory permissions');

    // Build query for material entries with joined data
    let query = supabase
      .from('material_entries')
      .select(`
        *,
        material:materials!material_id (
          id,
          material_name,
          category,
          unit_of_measure
        ),
        entered_by_user:user_profiles!entered_by (
          id,
          first_name,
          last_name,
          email
        )
      `);
    
    console.log('Base query created');

    // Handle plant filtering based on user role
    let plantFilter: string[] | undefined;
    
    if (profile.role === 'EXECUTIVE' || profile.role === 'ADMIN_OPERATIONS') {
      console.log('User is EXECUTIVE or ADMIN_OPERATIONS - no plant filtering');
      // Executive and Admin Operations users can see all entries
    } else if (profile.plant_id) {
      console.log('User has plant_id - filtering by plant:', profile.plant_id);
      // Plant users can only see entries from their plant
      plantFilter = [profile.plant_id];
    } else if (profile.business_unit_id) {
      console.log('User has business_unit_id - getting plants from BU:', profile.business_unit_id);
      // Business unit users can see entries from plants in their business unit
      // First get the plant IDs from the business unit
      const { data: buPlants } = await supabase
        .from('plants')
        .select('id')
        .eq('business_unit_id', profile.business_unit_id);
      
      plantFilter = buPlants?.map(p => p.id) || [];
      console.log('Plants in business unit:', plantFilter);
    }

    // Apply plant filtering if needed
    if (plantFilter && plantFilter.length > 0) {
      query = query.in('plant_id', plantFilter);
      console.log('Applied plant filter:', plantFilter);
    }

    // Handle date filtering - prefer range when provided, fallback to single date, then to today
    if (queryParams.date_from && queryParams.date_to) {
      console.log('Filtering by date range:', queryParams.date_from, 'to', queryParams.date_to);
      query = query.gte('entry_date', queryParams.date_from).lte('entry_date', queryParams.date_to);
    } else if (queryParams.date) {
      console.log('Filtering by specific date:', queryParams.date);
      query = query.eq('entry_date', queryParams.date);
    } else {
      // Default to today only if no date parameters provided
      const todayStr = new Date().toISOString().split('T')[0];
      console.log('No date params provided, defaulting to today:', todayStr);
      query = query.eq('entry_date', todayStr);
    }

    if (queryParams.material_id) {
      console.log('Filtering by material_id:', queryParams.material_id);
      query = query.eq('material_id', queryParams.material_id);
    }

    if (queryParams.pricing_status) {
      console.log('Filtering by pricing_status:', queryParams.pricing_status);
      query = query.eq('pricing_status', queryParams.pricing_status);
    }

    console.log('About to execute query...');

    // Get material entries with pagination
    const { data: entries, error: entriesError } = await query
      .order('entry_date', { ascending: false })
      .order('entry_time', { ascending: false })
      .range(parseInt(queryParams.offset), parseInt(queryParams.offset) + parseInt(queryParams.limit) - 1);

    console.log('Query executed. Entries:', entries?.length || 0, 'Error:', entriesError);

    if (entriesError) {
      console.error('Entries error:', entriesError);
      throw new Error(`Error al obtener entradas de material: ${entriesError.message}`);
    }

    const response = {
      success: true,
      entries: entries || [], // Return as 'entries' to match frontend expectation
      pagination: {
        limit: parseInt(queryParams.limit),
        offset: parseInt(queryParams.offset),
        hasMore: (entries || []).length === parseInt(queryParams.limit),
      },
    };
    
    console.log('Returning response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in entries GET:', error);
    
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

    // Validate material entry data
    const validatedData = MaterialEntryInputSchema.parse(body);
    
    // Validate that plant_id is provided, or use user's assigned plant as fallback
    let targetPlantId = validatedData.plant_id;
    
    if (!targetPlantId) {
      // Use user's assigned plant as fallback
      if (profile.plant_id) {
        targetPlantId = profile.plant_id;
      } else {
        return NextResponse.json(
          { success: false, error: 'Plant ID es requerido y usuario no tiene planta asignada' },
          { status: 400 }
        );
      }
    }

    // Check if user has access to the specified plant
    const userPlantAccess = await supabase
      .from('user_profiles')
      .select('plant_id, business_unit_id, role')
      .eq('id', profile.id)
      .single();

    if (!userPlantAccess.data) {
      return NextResponse.json(
        { success: false, error: 'Perfil de usuario no encontrado' },
        { status: 404 }
      );
    }

    const userProfile = userPlantAccess.data;
    
    // Check plant access permissions
    let hasPlantAccess = false;
    
    if (userProfile.role === 'EXECUTIVE' || userProfile.role === 'ADMIN_OPERATIONS') {
      hasPlantAccess = true; // Executives and Admin Operations can access all plants
    } else if (userProfile.plant_id === targetPlantId) {
      hasPlantAccess = true; // User can access their assigned plant
    } else if (userProfile.business_unit_id) {
      // Check if plant belongs to user's business unit
      const { data: plantBusinessUnit } = await supabase
        .from('plants')
        .select('business_unit_id')
        .eq('id', targetPlantId)
        .single();
      
      hasPlantAccess = plantBusinessUnit?.business_unit_id === userProfile.business_unit_id;
    }

    if (!hasPlantAccess) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para acceder a esta planta' },
        { status: 403 }
      );
    }

    // Generate entry number
    const entryDate = validatedData.entry_date || new Date().toISOString().split('T')[0];
    const dateStr = entryDate.replace(/-/g, '');
    
    // Get current sequence number
    const { data: lastEntry } = await supabase
      .from('material_entries')
      .select('entry_number')
      .eq('plant_id', targetPlantId)
      .ilike('entry_number', `ENT-${dateStr}-%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .single();

    const sequence = lastEntry ? parseInt(lastEntry.entry_number.split('-').pop() || '0') + 1 : 1;
    const entryNumber = `ENT-${dateStr}-${sequence.toString().padStart(3, '0')}`;

    // Get current inventory to calculate before/after values
    const { data: currentInventory } = await supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', targetPlantId)
      .eq('material_id', validatedData.material_id)
      .single();

    const inventoryBefore = currentInventory?.current_stock || 0;
    const inventoryAfter = inventoryBefore + validatedData.quantity_received;

    // Create material entry
    const entryData = {
      entry_number: entryNumber,
      plant_id: targetPlantId,
      material_id: validatedData.material_id,
      supplier_id: validatedData.supplier_id || null,
      entry_date: entryDate,
      entry_time: new Date().toTimeString().split(' ')[0],
      quantity_received: validatedData.quantity_received,
      supplier_invoice: validatedData.supplier_invoice || null,
      inventory_before: inventoryBefore,
      inventory_after: inventoryAfter,
      notes: validatedData.notes || null,
      entered_by: profile.id
    };

    console.log('Inserting entry data:', entryData);

    const { data: entry, error: entryError } = await supabase
      .from('material_entries')
      .insert(entryData)
      .select()
      .single();

    if (entryError) {
      console.error('Supabase insert error:', entryError);
      console.error('Entry data that failed:', entryData);
      throw new Error(`Error al crear entrada: ${entryError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: entry,
      entry_id: entry.id, // Include entry_id for document uploads
      message: 'Entrada de material creada exitosamente',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in entries POST:', error);
    
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
          { success: false, error: 'Ya existe una entrada con este número' },
          { status: 409 }
        );
      }

      // Check for foreign key constraint errors
      if (error.message.includes('foreign key')) {
        return NextResponse.json(
          { success: false, error: 'Material o proveedor no válido' },
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
    const validatedData = UpdateMaterialEntrySchema.parse(body);
    const { id, ...updateData } = validatedData;

    // Prepare update payload
    const updatePayload: Record<string, any> = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // If pricing fields are being updated, mark as reviewed
    if (
      (updateData.unit_price !== undefined || 
       updateData.total_cost !== undefined || 
       updateData.fleet_supplier_id !== undefined || 
       updateData.fleet_cost !== undefined) &&
      (profile.role === 'ADMIN_OPERATIONS' || profile.role === 'EXECUTIVE')
    ) {
      updatePayload.pricing_status = 'reviewed';
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = new Date().toISOString();
    }

    // Build the update query based on user role
    let updateQuery = supabase
      .from('material_entries')
      .update(updatePayload)
      .eq('id', id);

    // Apply plant filtering unless user is EXECUTIVE or ADMIN_OPERATIONS
    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS') {
      if (profile.plant_id) {
        updateQuery = updateQuery.eq('plant_id', profile.plant_id);
      } else {
        return NextResponse.json(
          { success: false, error: 'Usuario sin planta asignada' },
          { status: 403 }
        );
      }
    }

    const { data: result, error: updateError } = await updateQuery.select().single();

    if (updateError) {
      throw new Error(`Error al actualizar entrada: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Entrada de material actualizada exitosamente',
    });

  } catch (error) {
    console.error('Error in entries PUT:', error);
    
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

      // Check if entry doesn't exist or user doesn't have access
      if (error.message.includes('not found') || error.message.includes('no encontrado')) {
        return NextResponse.json(
          { success: false, error: 'Entrada de material no encontrada o sin permisos para modificarla' },
          { status: 404 }
        );
      }

      // Check for foreign key constraint errors
      if (error.message.includes('foreign key')) {
        return NextResponse.json(
          { success: false, error: 'Material o proveedor no válido' },
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
