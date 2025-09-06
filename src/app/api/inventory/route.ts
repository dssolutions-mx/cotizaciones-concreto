import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  GetInventoryQuerySchema,
  MaterialEntryInputSchema,
  MaterialAdjustmentInputSchema 
} from '@/lib/validations/inventory';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const queryParams = {
      material_id: searchParams.get('material_id') || undefined,
      plant_id: searchParams.get('plant_id') || undefined,
      low_stock_only: searchParams.get('low_stock_only') || undefined,
    };

    // Validate query parameters
    const validatedQuery = GetInventoryQuerySchema.parse(queryParams);

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

    // Determine which plant_id to use
    let targetPlantId = profile.plant_id;
    if (validatedQuery.plant_id && profile.role === 'EXECUTIVE') {
      // Only EXECUTIVE users can query other plants
      targetPlantId = validatedQuery.plant_id;
    } else if (validatedQuery.plant_id && profile.plant_id !== validatedQuery.plant_id) {
      return NextResponse.json({ error: 'No puede consultar inventario de otras plantas' }, { status: 403 });
    }

    if (!targetPlantId) {
      return NextResponse.json({ error: 'Planta no especificada' }, { status: 400 });
    }

    // Get current inventory status
    try {
      const { data: inventory, error: inventoryError } = await supabase
        .from('material_inventory')
        .select(`
          *,
          material:materials(id, material_name, category, unit_of_measure, is_active)
        `)
        .eq('plant_id', targetPlantId)
        .eq('material.is_active', true);

      if (inventoryError) {
        // If the table doesn't exist, return empty inventory
        if (inventoryError.message.includes('does not exist') || inventoryError.message.includes('relation')) {
          return NextResponse.json({
            success: true,
            inventory: [],
            message: 'Sistema de inventario no implementado aún'
          });
        }
        throw new Error(`Error al obtener inventario: ${inventoryError.message}`);
      }

      return NextResponse.json({
        success: true,
        inventory: inventory,
      });
    } catch (error) {
      // Handle case where material_inventory table doesn't exist
      if (error instanceof Error && error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          inventory: [],
          message: 'Sistema de inventario no implementado aún'
        });
      }
      throw error;
    }

  } catch (error) {
    console.error('Error in inventory GET:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.message.includes('UUID')) {
        return NextResponse.json(
          { success: false, error: 'Parámetros de consulta inválidos' },
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
    const { type, ...data } = body;

    if (!type || !['entry', 'adjustment'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de operación requerido: "entry" o "adjustment"' },
        { status: 400 }
      );
    }

    let result;

    if (type === 'entry') {
      // Validate material entry data
      const validatedData = MaterialEntryInputSchema.parse(data);
      
      // Generate entry number
      const entryDate = validatedData.entry_date || new Date().toISOString().split('T')[0];
      const dateStr = entryDate.replace(/-/g, '');
      
      // Get current sequence number
      const { data: lastEntry } = await supabase
        .from('material_entries')
        .select('entry_number')
        .eq('plant_id', profile.plant_id)
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
        .eq('plant_id', profile.plant_id)
        .eq('material_id', validatedData.material_id)
        .single();

      const inventoryBefore = currentInventory?.current_stock || 0;
      const inventoryAfter = inventoryBefore + validatedData.quantity_received;

      // Create entry
      const { data: entry, error: entryError } = await supabase
        .from('material_entries')
        .insert({
          entry_number: entryNumber,
          plant_id: profile.plant_id,
          material_id: validatedData.material_id,
          supplier_id: validatedData.supplier_id,
          entry_date: entryDate,
          entry_time: new Date().toTimeString().split(' ')[0],
          quantity_received: validatedData.quantity_received,
          supplier_invoice: validatedData.supplier_invoice,
          inventory_before: inventoryBefore,
          inventory_after: inventoryAfter,
          notes: validatedData.notes,
          entered_by: user.id,
        })
        .select()
        .single();

      if (entryError) {
        throw new Error(`Error al crear entrada: ${entryError.message}`);
      }

      result = entry;
    } else if (type === 'adjustment') {
      // Validate material adjustment data
      const validatedData = MaterialAdjustmentInputSchema.parse(data);
      
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
      const { data: adjustment, error: adjustmentError } = await supabase
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
          reference_notes: validatedData.referenceNotes,
          adjusted_by: user.id,
        })
        .select()
        .single();

      if (adjustmentError) {
        throw new Error(`Error al crear ajuste: ${adjustmentError.message}`);
      }

      result = adjustment;
    }

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in inventory POST:', error);
    
    if (error instanceof Error) {
      // Check for validation errors (Zod)
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
          { success: false, error: 'Ya existe un registro con estos datos' },
          { status: 409 }
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
