import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
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
    const validatedData = MaterialEntryInputSchema.parse(body) as z.infer<typeof MaterialEntryInputSchema>;
    
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

    // Calculate received quantity in kg for FIFO tracking
    const receivedQtyKg = validatedData.received_uom === 'l' && validatedData.received_qty_entered
      ? null // liters pass-through; not converting
      : (validatedData.po_item_id && validatedData.received_qty_kg
          ? validatedData.received_qty_kg
          : validatedData.quantity_received);

    // Create material entry (optional immediate PO linkage on create)
    const entryData = {
      entry_number: entryNumber,
      plant_id: targetPlantId,
      material_id: validatedData.material_id,
      supplier_id: validatedData.supplier_id || null,
      entry_date: entryDate,
      entry_time: new Date().toTimeString().split(' ')[0],
      quantity_received: validatedData.quantity_received,
      po_id: validatedData.po_id || null,
      po_item_id: validatedData.po_item_id || null,
      received_uom: validatedData.received_uom || (validatedData.po_item_id ? 'kg' : null),
      received_qty_entered: validatedData.received_qty_entered || (validatedData.po_item_id ? validatedData.quantity_received : null),
      received_qty_kg: receivedQtyKg,
      remaining_quantity_kg: receivedQtyKg, // Initialize FIFO remaining quantity
      supplier_invoice: validatedData.supplier_invoice || null,
      inventory_before: inventoryBefore,
      inventory_after: inventoryAfter,
      notes: validatedData.notes || null,
      entered_by: profile.id,
      // Fleet PO linkage
      fleet_po_id: validatedData.fleet_po_id || null,
      fleet_po_item_id: validatedData.fleet_po_item_id || null,
      fleet_qty_entered: validatedData.fleet_qty_entered || null,
      fleet_uom: validatedData.fleet_uom || null,
      fleet_supplier_id: validatedData.fleet_supplier_id || null
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

    // Load current entry to compute deltas and plant/material context
    const { data: currentEntry, error: loadErr } = await supabase
      .from('material_entries')
      .select('*')
      .eq('id', id)
      .single();
    if (loadErr || !currentEntry) {
      return NextResponse.json({ success: false, error: 'Entrada no encontrada' }, { status: 404 });
    }

    // Prepare update payload
    const updatePayload: Record<string, any> = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Optional: Link PO item with unit conversion and caps
    if (updateData.po_item_id) {
      // Fetch PO item, header, material densities
      const { data: poItem, error: poItemErr } = await supabase
        .from('purchase_order_items')
        .select('*, po:purchase_orders!po_id (id, plant_id, supplier_id, status), material:materials!material_id (id, density_kg_per_l, bulk_density_kg_per_m3)')
        .eq('id', updateData.po_item_id)
        .single();
      if (poItemErr || !poItem) {
        return NextResponse.json({ success: false, error: 'Item de PO no encontrado' }, { status: 400 });
      }
      if (poItem.po.plant_id !== currentEntry.plant_id) {
        return NextResponse.json({ success: false, error: 'PO pertenece a otra planta' }, { status: 400 });
      }
      if (!poItem.is_service && poItem.material_id !== currentEntry.material_id) {
        return NextResponse.json({ success: false, error: 'El material de la entrada no coincide con el del PO' }, { status: 400 });
      }
      // Enforce supplier match when provided
      const entrySupplier = updateData.supplier_id || currentEntry.supplier_id || null;
      if (entrySupplier && entrySupplier !== poItem.po.supplier_id) {
        return NextResponse.json({ success: false, error: 'El proveedor de la entrada no coincide con el proveedor del PO' }, { status: 400 });
      }
      // If entry supplier not set, default to PO supplier for traceability
      if (!currentEntry.supplier_id && !updateData.supplier_id) {
        updatePayload.supplier_id = poItem.po.supplier_id;
      }

      // Resolve received quantities based on UoM
      let newReceivedKg = 0;
      let newReceivedNative = 0;
      let nativeUom = poItem.uom as string | null;

      // Liters pass-through: use native liters, do not convert to kg
      if (!poItem.is_service && poItem.uom === 'l') {
        // Prefer explicitly provided quantities; else fallback to quantity_received
        const entered = updateData.received_qty_entered ?? updateData.quantity_received ?? currentEntry.received_qty_entered ?? currentEntry.quantity_received ?? 0;
        newReceivedNative = Number(entered) || 0;
        nativeUom = 'l';
        updatePayload.received_uom = 'l';
        updatePayload.received_qty_entered = newReceivedNative;
        updatePayload.received_qty_kg = null; // no conversion for liters
      }
      // m3: resolve volumetric weight and compute kg
      else if (!poItem.is_service && poItem.uom === 'm3') {
        const enteredM3 = updateData.received_qty_entered ?? updateData.quantity_received ?? currentEntry.received_qty_entered ?? currentEntry.quantity_received ?? 0;
        newReceivedNative = Number(enteredM3) || 0;
        nativeUom = 'm3';
        // Resolve volumetric weight
        let volW: number | null = poItem.volumetric_weight_kg_per_m3 ?? null;
        let volSource: string | null = volW ? 'po_item' : null;
        if (!volW) {
          // Try supplier agreement
          const supplierId = poItem.po.supplier_id;
          const { data: agreement } = await supabase
            .from('supplier_agreements')
            .select('volumetric_weight_kg_per_m3')
            .eq('supplier_id', supplierId)
            .eq('is_service', false)
            .eq('material_id', poItem.material_id)
            .is('effective_to', null)
            .limit(1)
            .single();
          if (agreement?.volumetric_weight_kg_per_m3) {
            volW = Number(agreement.volumetric_weight_kg_per_m3);
            volSource = 'supplier_agreement';
          }
        }
        if (!volW && poItem.material?.bulk_density_kg_per_m3) {
          volW = Number(poItem.material.bulk_density_kg_per_m3);
          volSource = 'material_default';
        }
        if (!volW && updateData.volumetric_weight_kg_per_m3) {
          volW = Number(updateData.volumetric_weight_kg_per_m3);
          volSource = 'entry';
        }
        if (!volW) {
          return NextResponse.json({ success: false, error: 'Se requiere peso volumétrico (kg/m³) para convertir m³ a kg' }, { status: 400 });
        }
        newReceivedKg = newReceivedNative * volW;
        updatePayload.received_uom = 'm3';
        updatePayload.received_qty_entered = newReceivedNative;
        updatePayload.received_qty_kg = newReceivedKg;
        updatePayload.volumetric_weight_kg_per_m3 = volW;
        updatePayload.volumetric_weight_source = volSource;
      }
      // kg (default)
      else {
        const enteredKg = updateData.received_qty_entered ?? updateData.quantity_received ?? currentEntry.received_qty_entered ?? currentEntry.quantity_received ?? 0;
        newReceivedNative = Number(enteredKg) || 0;
        nativeUom = 'kg';
        newReceivedKg = newReceivedNative;
        updatePayload.received_uom = 'kg';
        updatePayload.received_qty_entered = newReceivedNative;
        updatePayload.received_qty_kg = newReceivedKg;
      }

      // Remaining validation based on native UoM
      const alreadyReceivedNative = Number(poItem.qty_received_native || 0);
      const orderedNative = Number(poItem.qty_ordered || 0);

      // Compute previous native from current entry to find delta
      let previousNative = 0;
      if (currentEntry.received_uom === 'l') previousNative = Number(currentEntry.received_qty_entered || 0);
      else if (currentEntry.received_uom === 'm3') previousNative = Number(currentEntry.received_qty_entered || 0);
      else previousNative = Number(currentEntry.received_qty_kg || currentEntry.quantity_received || 0);

      const deltaNative = Math.max(newReceivedNative - previousNative, 0);
      if (deltaNative > (orderedNative - alreadyReceivedNative) + 1e-6) {
        return NextResponse.json({ success: false, error: 'Cantidad excede el saldo disponible del PO (UoM nativa)' }, { status: 400 });
      }

      updatePayload.po_item_id = updateData.po_item_id;
      updatePayload.po_id = poItem.po.id;

      // Enforce price lock by default for materials (services handled elsewhere)
      if (!poItem.is_service) {
        const elevated = profile.role === 'EXECUTIVE' || profile.role === 'ADMINISTRATIVE';
        if (!elevated || updateData.unit_price === undefined) {
          updatePayload.unit_price = Number(poItem.unit_price);
        }
        if (updatePayload.unit_price !== undefined && (updateData.total_cost === undefined)) {
          const qtyForCost = newReceivedNative; // cost based on native UoM price
          updatePayload.total_cost = Number(updatePayload.unit_price) * qtyForCost;
        }
      }

      // After update succeeds, update PO item tallies (native and kg)
      updatePayload.__po_delta_native = deltaNative;
      updatePayload.__po_native_uom = nativeUom;
      // For kg/m3 we may track kg too
      const previousKg = Number(currentEntry.received_qty_kg || 0);
      const deltaKg = Math.max(newReceivedKg - previousKg, 0);
      updatePayload.__po_delta_kg = deltaKg;
    }

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

    // Remove internal helpers before DB update if present (we'll use local copies below)
    const __po_delta_native = (updatePayload as any).__po_delta_native ?? 0;
    const __po_delta_kg = (updatePayload as any).__po_delta_kg ?? 0;
    const __po_native_uom = (updatePayload as any).__po_native_uom ?? null;
    delete (updatePayload as any).__po_delta_native;
    delete (updatePayload as any).__po_delta_kg;
    delete (updatePayload as any).__po_native_uom;

    const { data: result, error: updateError } = await updateQuery.select().single();

    if (updateError) {
      throw new Error(`Error al actualizar entrada: ${updateError.message}`);
    }

    // If linked to PO item, update the PO item received tallies and status
    try {
      if (updateData.po_item_id && (__po_delta_native > 0 || __po_delta_kg > 0)) {
        const { data: poItem2, error: poErr2 } = await supabase
          .from('purchase_order_items')
          .select('qty_received_native, qty_received_kg, qty_ordered, uom, is_service')
          .eq('id', result.po_item_id)
          .single();
        if (!poErr2 && poItem2) {
          const newReceivedNative = Number(poItem2.qty_received_native || 0) + __po_delta_native;
          const newReceivedKg = Number(poItem2.qty_received_kg || 0) + __po_delta_kg;
          // Determine status using native comparison for materials and services
          const orderedNative = Number(poItem2.qty_ordered || 0);
          let newStatus = 'partial';
          if (newReceivedNative >= orderedNative - 1e-6) newStatus = 'fulfilled';

          const updateFields: Record<string, any> = { qty_received_native: newReceivedNative, status: newStatus };
          if (__po_delta_kg > 0) updateFields.qty_received_kg = newReceivedKg;

          const { error: updPoItemErr } = await supabase
            .from('purchase_order_items')
            .update(updateFields)
            .eq('id', result.po_item_id);
          if (updPoItemErr) console.error('Error actualizando avance de PO:', updPoItemErr);
        }
      }
    } catch (poProgressErr) {
      console.error('Error actualizando progreso de PO (no fatal):', poProgressErr);
    }

    // After updating entry, optionally upsert Accounts Payable records for material and fleet
    let threeWayWarnings: string[] = [];
    try {
      // Resolve VAT precedence: supplier agreements -> business unit default
      let vatRate = 0.16;
      const { data: plantRow } = await supabase
        .from('plants')
        .select('id, business_unit_id')
        .eq('id', result.plant_id)
        .single();
      if (plantRow?.business_unit_id) {
        const { data: buRow } = await supabase
          .from('business_units')
          .select('iva_rate')
          .eq('id', plantRow.business_unit_id)
          .single();
        if (buRow?.iva_rate !== null && buRow?.iva_rate !== undefined) {
          vatRate = buRow.iva_rate as unknown as number;
        }
      }
      // Attempt to override from supplier agreement VAT if present
      if (result.supplier_id) {
        const { data: agreementVat } = await supabase
          .from('supplier_agreements')
          .select('vat_rate')
          .eq('supplier_id', result.supplier_id)
          .eq('is_service', false)
          .eq('material_id', result.material_id)
          .is('effective_to', null)
          .limit(1)
          .single();
        if (agreementVat?.vat_rate !== null && agreementVat?.vat_rate !== undefined) {
          vatRate = Number(agreementVat.vat_rate);
        }
      }

      // Helper to upsert payable and return its id
      const upsertPayable = async (supplierId: string, plantId: string, invoiceNumber: string, dueDate?: string, entryId?: string) => {
        const payload: Record<string, any> = {
          supplier_id: supplierId,
          plant_id: plantId,
          invoice_number: invoiceNumber,
          vat_rate: vatRate,
          currency: 'MXN',
        };
        if (dueDate) payload.due_date = dueDate;
        if (entryId) payload.entry_id = entryId;

        const { data: payableRows, error: payableErr } = await supabase
          .from('payables')
          .upsert(payload, { onConflict: 'supplier_id,plant_id,invoice_number' })
          .select();
        if (payableErr) throw new Error(`Error al crear/actualizar CXP: ${payableErr.message}`);
        const payable = Array.isArray(payableRows) ? payableRows[0] : payableRows;
        return payable.id as string;
      };

      // Upsert material payable item
      const nativeUom = result.received_uom || null;
      const nativeQty = result.received_qty_entered || null;
      const volUsed = result.volumetric_weight_kg_per_m3 || null;
      const amountMaterial = (result.total_cost ?? ((result.unit_price || 0) * (nativeQty || 0)));
      let materialPayableId: string | null = null;
      if (result.supplier_id && result.supplier_invoice && amountMaterial > 0) {
        materialPayableId = await upsertPayable(result.supplier_id, result.plant_id, result.supplier_invoice, result.ap_due_date_material, result.id);
        const { error: itemErr } = await supabase
          .from('payable_items')
          .upsert({
            payable_id: materialPayableId,
            entry_id: result.id,
            amount: amountMaterial,
            cost_category: 'material',
            native_uom: nativeUom,
            native_qty: nativeQty,
            volumetric_weight_used: volUsed,
          }, { onConflict: 'entry_id,cost_category' });
        if (itemErr) throw new Error(`Error al registrar partida CXP material: ${itemErr.message}`);
      }

      // Upsert fleet payable item (separate supplier/invoice)
      let fleetPayableId: string | null = null;
      if (result.fleet_supplier_id && result.fleet_cost && result.fleet_cost > 0 && result.fleet_invoice) {
        fleetPayableId = await upsertPayable(result.fleet_supplier_id, result.plant_id, result.fleet_invoice, result.ap_due_date_fleet, result.id);
        const { error: fleetItemErr } = await supabase
          .from('payable_items')
          .upsert({
            payable_id: fleetPayableId,
            entry_id: result.id,
            amount: result.fleet_cost,
            cost_category: 'fleet',
          }, { onConflict: 'entry_id,cost_category' });
        if (fleetItemErr) throw new Error(`Error al registrar partida CXP flota: ${fleetItemErr.message}`);
      }

      // D3 — 3-way match soft validation (gap M3)
      for (const pid of [materialPayableId, fleetPayableId]) {
        if (!pid) continue;
        const { data: w } = await supabase.rpc('validate_payable_vs_po', { p_payable_id: pid });
        if (Array.isArray(w) && w.length > 0) {
          for (const x of w) {
            if (x && typeof x === 'object' && 'amount' in x && 'expected' in x) {
              threeWayWarnings.push(`Factura excede valor recibido: monto ${(x as any).amount} vs esperado ${(x as any).expected}`);
            }
          }
        }
      }
    } catch (apError) {
      console.error('AP upsert error (non-fatal):', apError);
      // We do not fail the entire request if AP upsert fails; client can retry from CXP UI
    }

    const json: Record<string, unknown> = {
      success: true,
      data: result,
      message: 'Entrada de material actualizada exitosamente',
    };
    if (threeWayWarnings.length > 0) {
      json.warnings = threeWayWarnings;
    }
    return NextResponse.json(json);

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
