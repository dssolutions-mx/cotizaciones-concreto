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
    const queryParams = {
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
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
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    // Validate query parameters
    const validatedQuery = GetActivitiesQuerySchema.parse(queryParams);

    // Build query for material adjustments
    let query = supabase
      .from('material_adjustments')
      .select('*')
      .eq('plant_id', profile.plant_id);

    if (validatedQuery.date_from) {
      query = query.gte('adjustment_date', validatedQuery.date_from);
    }

    if (validatedQuery.date_to) {
      query = query.lte('adjustment_date', validatedQuery.date_to);
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
      throw new Error(`Error al obtener ajustes de material: ${adjustmentsError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: adjustments,
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
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    const body = await request.json();

    // Validate material adjustment data
    const validatedData = MaterialAdjustmentInputSchema.parse(body);

    // Generate adjustment number
    const adjustmentDate = validatedData.adjustment_date || new Date().toISOString().split('T')[0];
    const dateStr = adjustmentDate.replace(/-/g, '');
    
    // Get current sequence number
    const { data: lastAdjustment } = await supabase
      .from('material_adjustments')
      .select('adjustment_number')
      .eq('plant_id', profile.plant_id)
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
      .eq('plant_id', profile.plant_id)
      .eq('material_id', validatedData.material_id)
      .single();

    const inventoryBefore = currentInventory?.current_stock || 0;
    const inventoryAfter = inventoryBefore - validatedData.quantity_adjusted;

    // Create adjustment
    const { data: result, error: adjustmentError } = await supabase
      .from('material_adjustments')
      .insert({
        adjustment_number: adjustmentNumber,
        plant_id: profile.plant_id,
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
      throw new Error(`Error al crear ajuste: ${adjustmentError.message}`);
    }

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
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
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
