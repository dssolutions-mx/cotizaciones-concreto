import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { 
  GetActivitiesQuerySchema,
  MaterialEntryInputSchema,
  UpdateMaterialEntrySchema 
} from '@/lib/validations/inventory';
import { hasInventoryStandardAccess, isGlobalInventoryRole } from '@/lib/auth/inventoryRoles';

/** Merge document_count per entry from inventory_documents (type entry). */
async function attachEntryDocumentCounts(
  supabase: { from: (table: string) => any },
  entries: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (!entries.length) return entries;
  const ids = entries.map((e) => e.id as string).filter(Boolean);
  if (!ids.length) return entries;
  const { data: rows, error } = await supabase
    .from('inventory_documents')
    .select('entry_id')
    .eq('document_type', 'entry')
    .in('entry_id', ids);
  if (error) {
    console.error('attachEntryDocumentCounts:', error);
    return entries.map((e) => ({ ...e, document_count: 0 }));
  }
  const counts = new Map<string, number>();
  for (const r of rows || []) {
    const id = r.entry_id as string | undefined;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return entries.map((e) => ({
    ...e,
    document_count: counts.get(e.id as string) ?? 0,
  }));
}

async function profileCanAccessMaterialEntryPlant(
  supabase: { from: (table: string) => any },
  profile: { role: string; plant_id?: string | null; business_unit_id?: string | null },
  entryPlantId: string
): Promise<boolean> {
  if (isGlobalInventoryRole(profile.role)) return true;
  if (profile.plant_id && profile.plant_id === entryPlantId) return true;
  if (profile.business_unit_id) {
    const { data: pl } = await supabase
      .from('plants')
      .select('business_unit_id')
      .eq('id', entryPlantId)
      .single();
    return pl?.business_unit_id === profile.business_unit_id;
  }
  return false;
}

/** Quantities this entry contributes to a PO line (native UoM + kg for m³). Used on POST create. */
function nativeKgFromEntryForPoItem(
  entry: {
    quantity_received: number;
    received_qty_entered?: number | null;
    received_qty_kg?: number | null;
  },
  poItem: { uom: string | null; is_service: boolean }
): { native: number; kg: number } {
  if (poItem.is_service) {
    return { native: Number(entry.quantity_received) || 0, kg: 0 };
  }
  const uom = poItem.uom;
  if (uom === 'l') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0);
    return { native: n, kg: 0 };
  }
  if (uom === 'm3') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0);
    const kg = Number(entry.received_qty_kg ?? 0);
    return { native: n, kg: kg };
  }
  const kg = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0);
  return { native: kg, kg: kg };
}

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
      po_id: searchParams.get('po_id') || undefined,
      plant_id: searchParams.get('plant_id') || undefined,
      entry_id: searchParams.get('entry_id') || undefined,
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
      include: searchParams.get('include') || undefined,
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

    if (!hasInventoryStandardAccess(profile.role)) {
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
        ),
        po:purchase_orders!po_id ( id, po_number ),
        fleet_po:purchase_orders!fleet_po_id ( id, po_number ),
        supplier:suppliers!supplier_id ( id, name, provider_number )
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

    // Workspace plant from query (PlantContext): narrow to one plant when the user may access it
    if (queryParams.plant_id) {
      const isGlobalInventoryRole =
        profile.role === 'EXECUTIVE' || profile.role === 'ADMIN_OPERATIONS';
      const inAllowedPlantList =
        !!plantFilter &&
        plantFilter.length > 0 &&
        plantFilter.includes(queryParams.plant_id);
      const matchesProfilePlant = profile.plant_id === queryParams.plant_id;

      if (!isGlobalInventoryRole && !inAllowedPlantList && !matchesProfilePlant) {
        return NextResponse.json(
          { error: 'Sin acceso a la planta indicada' },
          { status: 403 }
        );
      }

      query = query.eq('plant_id', queryParams.plant_id);
      console.log('Applied workspace plant_id scope:', queryParams.plant_id);
    }

    // Single entry by id (ignores date filters — used for deep links from procurement)
    if (queryParams.entry_id) {
      query = query.eq('id', queryParams.entry_id);
      const { data: singleEntry, error: singleErr } = await query.maybeSingle();

      if (singleErr) {
        console.error('Entry by id error:', singleErr);
        throw new Error(`Error al obtener entrada de material: ${singleErr.message}`);
      }

      let rows: Record<string, unknown>[] = singleEntry ? [singleEntry as Record<string, unknown>] : [];
      if (queryParams.include === 'document_counts' && rows.length > 0) {
        rows = await attachEntryDocumentCounts(supabase, rows);
      }
      return NextResponse.json({
        success: true,
        entries: rows,
        pagination: {
          limit: parseInt(queryParams.limit),
          offset: parseInt(queryParams.offset),
          hasMore: false,
        },
      });
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

    if (queryParams.po_id) {
      console.log('Filtering by po_id (includes fleet_po_id):', queryParams.po_id);
      query = query.or(
        `po_id.eq.${queryParams.po_id},fleet_po_id.eq.${queryParams.po_id}`
      );
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

    let list = (entries || []) as Record<string, unknown>[];
    if (queryParams.include === 'document_counts' && list.length > 0) {
      list = await attachEntryDocumentCounts(supabase, list);
    }

    const response = {
      success: true,
      entries: list,
      pagination: {
        limit: parseInt(queryParams.limit),
        offset: parseInt(queryParams.offset),
        hasMore: list.length === parseInt(queryParams.limit),
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
    if (!hasInventoryStandardAccess(profile.role)) {
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
    
    // Get current sequence number (per plant; DB unique is on plant_id + entry_number)
    const { data: lastEntry } = await supabase
      .from('material_entries')
      .select('entry_number')
      .eq('plant_id', targetPlantId)
      .ilike('entry_number', `ENT-${dateStr}-%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .maybeSingle();

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

    const ALERT_RESOLVABLE_ON_ENTRY = [
      'confirmed',
      'pending_validation',
      'validated',
      'pending_po',
      'po_linked',
      'delivery_scheduled',
    ] as const;

    let effectivePoId: string | null = validatedData.po_id || null;
    let effectivePoItemId: string | null = validatedData.po_item_id || null;
    let effectiveSupplierId: string | null = validatedData.supplier_id || null;

    type ExplicitAlertCtx = { id: string; status: string; alert_number: string | null };
    let explicitAlertCtx: ExplicitAlertCtx | null = null;

    if (validatedData.alert_id) {
      const { data: linkAlert, error: linkAlertErr } = await supabase
        .from('material_alerts')
        .select('id, status, alert_number, plant_id, material_id, existing_po_id')
        .eq('id', validatedData.alert_id)
        .single();

      if (linkAlertErr || !linkAlert) {
        return NextResponse.json(
          { success: false, error: 'La alerta indicada no existe' },
          { status: 404 }
        );
      }
      if (linkAlert.plant_id !== targetPlantId) {
        return NextResponse.json(
          { success: false, error: 'La alerta no pertenece a la planta de esta entrada' },
          { status: 400 }
        );
      }
      if (linkAlert.material_id !== validatedData.material_id) {
        return NextResponse.json(
          { success: false, error: 'La alerta no corresponde al material de esta entrada' },
          { status: 400 }
        );
      }
      if (!ALERT_RESOLVABLE_ON_ENTRY.includes(linkAlert.status as (typeof ALERT_RESOLVABLE_ON_ENTRY)[number])) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Esta alerta no puede cerrarse con una entrada en su estado actual. Complete confirmación o validación según corresponda.',
          },
          { status: 400 }
        );
      }

      explicitAlertCtx = {
        id: linkAlert.id,
        status: linkAlert.status,
        alert_number: linkAlert.alert_number ?? null,
      };

      // Bridge admin PO link → entry (dosificador does not pick PO in UI)
      if (!effectivePoId && linkAlert.existing_po_id) {
        const { data: poRow } = await supabase
          .from('purchase_orders')
          .select('id, plant_id, supplier_id')
          .eq('id', linkAlert.existing_po_id)
          .single();

        if (poRow?.plant_id === targetPlantId) {
          const { data: poItems } = await supabase
            .from('purchase_order_items')
            .select('id, qty_ordered, qty_received, status, is_service')
            .eq('po_id', linkAlert.existing_po_id)
            .eq('material_id', validatedData.material_id)
            .eq('is_service', false)
            .in('status', ['open', 'partial']);

          const withBalance = (poItems || []).find((row) => {
            const ordered = Number(row.qty_ordered) || 0;
            const received = Number(row.qty_received) || 0;
            return ordered - received > 1e-9;
          });

          if (withBalance) {
            effectivePoId = linkAlert.existing_po_id;
            effectivePoItemId = withBalance.id;
            if (!effectiveSupplierId && poRow.supplier_id) {
              effectiveSupplierId = poRow.supplier_id;
            }
          }
        }
      }
    }

    // Calculate received quantity in kg for FIFO tracking
    const receivedQtyKg =
      validatedData.received_uom === 'l' && validatedData.received_qty_entered
        ? null // liters pass-through; not converting
        : effectivePoItemId && (validatedData as { received_qty_kg?: number }).received_qty_kg
          ? (validatedData as { received_qty_kg?: number }).received_qty_kg!
          : validatedData.quantity_received;

    // Create material entry (optional immediate PO linkage on create)
    const entryData = {
      entry_number: entryNumber,
      plant_id: targetPlantId,
      material_id: validatedData.material_id,
      supplier_id: effectiveSupplierId,
      entry_date: entryDate,
      entry_time: new Date().toTimeString().split(' ')[0],
      quantity_received: validatedData.quantity_received,
      po_id: effectivePoId,
      po_item_id: effectivePoItemId,
      received_uom: validatedData.received_uom || (effectivePoItemId ? 'kg' : null),
      received_qty_entered:
        validatedData.received_qty_entered || (effectivePoItemId ? validatedData.quantity_received : null),
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

    // Keep PO line recepciones in sync (PUT path already did this; POST was missing it)
    try {
      if (effectivePoItemId && entry) {
        const { data: poItemRow } = await supabase
          .from('purchase_order_items')
          .select('qty_received, qty_received_native, qty_received_kg, qty_ordered, uom, is_service')
          .eq('id', effectivePoItemId)
          .single();
        if (poItemRow) {
          const { native: deltaNative, kg: deltaKg } = nativeKgFromEntryForPoItem(entry, poItemRow);
          if (deltaNative > 0 || deltaKg > 0) {
            const currentNative =
              Number(poItemRow.qty_received ?? poItemRow.qty_received_native ?? 0) + deltaNative;
            const currentKg = Number(poItemRow.qty_received_kg ?? 0) + deltaKg;
            const orderedNative = Number(poItemRow.qty_ordered || 0);
            let newStatus = 'partial';
            if (currentNative >= orderedNative - 1e-6) newStatus = 'fulfilled';
            const updateFields: Record<string, unknown> = {
              qty_received: currentNative,
              status: newStatus,
            };
            if (deltaKg > 0) updateFields.qty_received_kg = currentKg;
            const { error: updMatErr } = await supabase
              .from('purchase_order_items')
              .update(updateFields)
              .eq('id', effectivePoItemId);
            if (updMatErr) console.error('POST entry: avance PO material:', updMatErr);
          }
        }
      }

      const fleetItemId = validatedData.fleet_po_item_id;
      const fleetQty = validatedData.fleet_qty_entered;
      if (fleetItemId && fleetQty != null && Number(fleetQty) > 0) {
        const { data: fleetItemRow } = await supabase
          .from('purchase_order_items')
          .select('qty_received, qty_received_native, qty_ordered')
          .eq('id', fleetItemId)
          .single();
        if (fleetItemRow) {
          const delta = Number(fleetQty);
          const currentNative =
            Number(fleetItemRow.qty_received ?? fleetItemRow.qty_received_native ?? 0) + delta;
          const orderedNative = Number(fleetItemRow.qty_ordered || 0);
          let newStatus = 'partial';
          if (currentNative >= orderedNative - 1e-6) newStatus = 'fulfilled';
          const { error: updFleetErr } = await supabase
            .from('purchase_order_items')
            .update({ qty_received: currentNative, status: newStatus })
            .eq('id', fleetItemId);
          if (updFleetErr) console.error('POST entry: avance PO flota:', updFleetErr);
        }
      }
    } catch (poProgressErr) {
      console.error('POST entry: actualización PO (no fatal):', poProgressErr);
    }

    // Get the auto-created lot (trigger creates it on insert)
    const { data: lot } = await supabase
      .from('material_lots')
      .select('id, lot_number')
      .eq('entry_id', entry.id)
      .single();

    // Resolve material alert: only when alert_id is explicitly provided (no auto-close heuristics)
    let resolvedAlertNumber: string | null = null;
    try {
      if (explicitAlertCtx) {
        resolvedAlertNumber = explicitAlertCtx.alert_number;
        await supabase
          .from('material_alerts')
          .update({
            status: 'closed',
            resolved_entry_id: entry.id,
            resolved_lot_id: lot?.id || null,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', explicitAlertCtx.id);

        await supabase.from('material_alert_events').insert({
          alert_id: explicitAlertCtx.id,
          event_type: 'resolved_by_dosificador_entry',
          from_status: explicitAlertCtx.status,
          to_status: 'closed',
          performed_by: profile.id,
          details: { entry_id: entry.id, lot_id: lot?.id, alert_id: explicitAlertCtx.id },
        });
      }
    } catch (alertErr) {
      // Non-blocking — alert resolution failure should not block entry creation
      console.warn('Alert resolution failed:', alertErr);
    }

    return NextResponse.json({
      success: true,
      data: { ...entry, lot_id: lot?.id, lot_number: lot?.lot_number },
      entry_id: entry.id,
      lot_id: lot?.id || null,
      lot_number: lot?.lot_number || null,
      resolved_alert_number: resolvedAlertNumber,
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
    if (!hasInventoryStandardAccess(profile.role)) {
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

    if (currentEntry.pricing_status === 'reviewed') {
      const elevated = profile.role === 'EXECUTIVE' || profile.role === 'ADMIN_OPERATIONS';
      if (!elevated) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Esta entrada ya fue revisada por administración y no puede modificarse.',
          },
          { status: 403 }
        );
      }
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
        .select('*, po:purchase_orders!po_id (id, plant_id, supplier_id, status)')
        .eq('id', updateData.po_item_id)
        .single();
      if (poItemErr || !poItem) {
        console.error('PO item fetch error:', poItemErr, 'for id:', updateData.po_item_id);
        return NextResponse.json({ success: false, error: 'Item de PO no encontrado' }, { status: 400 });
      }
      // Fetch material density separately (only needed for m³ UoM fallback)
      let poItemMaterial: { density_kg_per_l?: number | null; bulk_density_kg_per_m3?: number | null } | null = null;
      if (poItem.material_id) {
        const { data: matRow } = await supabase
          .from('materials')
          .select('density_kg_per_l, bulk_density_kg_per_m3')
          .eq('id', poItem.material_id)
          .single();
        poItemMaterial = matRow ?? null;
      }
      // Attach as poItem.material for downstream UoM resolution
      (poItem as any).material = poItemMaterial;
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
      const alreadyReceivedNative = Number(poItem.qty_received ?? poItem.qty_received_native ?? 0);
      const orderedNative = Number(poItem.qty_ordered || 0);

      // Compute previous native from current entry to find delta.
      // First-time link (entrada sin OC): nothing was counted on a PO line yet — full receipt applies (same idea as fleet OC link).
      const firstMaterialPoLink = !currentEntry.po_item_id;
      let previousNative = 0;
      if (!firstMaterialPoLink) {
        if (currentEntry.received_uom === 'l') previousNative = Number(currentEntry.received_qty_entered || 0);
        else if (currentEntry.received_uom === 'm3') previousNative = Number(currentEntry.received_qty_entered || 0);
        else previousNative = Number(currentEntry.received_qty_kg || currentEntry.quantity_received || 0);
      }

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
      const previousKg = firstMaterialPoLink ? 0 : Number(currentEntry.received_qty_kg || 0);
      const deltaKg = Math.max(newReceivedKg - previousKg, 0);
      updatePayload.__po_delta_kg = deltaKg;
    }

    // Fleet PO: validate new link (pricing review) and compute delta for PO line recepciones
    let __fleet_po_link_delta_native = 0;
    if (
      updateData.fleet_po_item_id &&
      updateData.fleet_qty_entered != null &&
      Number(updateData.fleet_qty_entered) > 0 &&
      !currentEntry.fleet_po_item_id
    ) {
      const { data: fleetPoLine, error: fleetLineErr } = await supabase
        .from('purchase_order_items')
        .select(
          'id, is_service, material_supplier_id, qty_received, qty_received_native, qty_ordered, po:purchase_orders!po_id (id, plant_id, status)'
        )
        .eq('id', updateData.fleet_po_item_id)
        .single();
      if (fleetLineErr || !fleetPoLine) {
        return NextResponse.json({ success: false, error: 'Línea de OC de flota no encontrada' }, { status: 400 });
      }
      if (!fleetPoLine.is_service) {
        return NextResponse.json(
          { success: false, error: 'La línea de OC de flota debe ser de tipo servicio' },
          { status: 400 }
        );
      }
      const fleetPo = fleetPoLine.po as { id: string; plant_id: string; status: string };
      if (fleetPo.plant_id !== currentEntry.plant_id) {
        return NextResponse.json({ success: false, error: 'La OC de flota pertenece a otra planta' }, { status: 400 });
      }
      const mergedSupplierId =
        (updateData.supplier_id as string | undefined) ?? currentEntry.supplier_id ?? null;
      if (
        mergedSupplierId &&
        fleetPoLine.material_supplier_id &&
        fleetPoLine.material_supplier_id !== mergedSupplierId
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'El proveedor de material de la entrada no coincide con la OC de flota seleccionada',
          },
          { status: 400 }
        );
      }
      const qtyIn = Number(updateData.fleet_qty_entered);
      const already = Number(fleetPoLine.qty_received ?? fleetPoLine.qty_received_native ?? 0);
      const ordered = Number(fleetPoLine.qty_ordered || 0);
      if (qtyIn > ordered - already + 1e-6) {
        return NextResponse.json(
          { success: false, error: 'La cantidad de flota excede el saldo disponible en la línea de OC' },
          { status: 400 }
        );
      }
      __fleet_po_link_delta_native = qtyIn;
    }

    // If pricing fields are being updated, mark as reviewed
    if (
      (updateData.unit_price !== undefined ||
        updateData.total_cost !== undefined ||
        updateData.fleet_supplier_id !== undefined ||
        updateData.fleet_cost !== undefined ||
        updateData.fleet_po_item_id !== undefined ||
        updateData.po_item_id !== undefined) &&
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
          .select('qty_received, qty_received_native, qty_received_kg, qty_ordered, uom, is_service')
          .eq('id', result.po_item_id)
          .single();
        if (!poErr2 && poItem2) {
          const currentNative = Number(poItem2.qty_received ?? poItem2.qty_received_native ?? 0) + __po_delta_native;
          const currentKg = Number(poItem2.qty_received_kg ?? 0) + __po_delta_kg;
          // Determine status using native comparison for materials and services
          const orderedNative = Number(poItem2.qty_ordered || 0);
          let newStatus = 'partial';
          if (currentNative >= orderedNative - 1e-6) newStatus = 'fulfilled';

          const updateFields: Record<string, any> = { qty_received: currentNative, status: newStatus };
          if (__po_delta_kg > 0) updateFields.qty_received_kg = currentKg;

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

    // New fleet PO link on PUT (revisión de precios): increment línea de servicio
    try {
      if (__fleet_po_link_delta_native > 0 && result.fleet_po_item_id) {
        const { data: fleetItemRow } = await supabase
          .from('purchase_order_items')
          .select('qty_received, qty_received_native, qty_ordered')
          .eq('id', result.fleet_po_item_id)
          .single();
        if (fleetItemRow) {
          const delta = __fleet_po_link_delta_native;
          const currentNative =
            Number(fleetItemRow.qty_received ?? fleetItemRow.qty_received_native ?? 0) + delta;
          const orderedNative = Number(fleetItemRow.qty_ordered || 0);
          let newStatus = 'partial';
          if (currentNative >= orderedNative - 1e-6) newStatus = 'fulfilled';
          const { error: updFleetErr } = await supabase
            .from('purchase_order_items')
            .update({ qty_received: currentNative, status: newStatus })
            .eq('id', result.fleet_po_item_id);
          if (updFleetErr) console.error('PUT entry: avance PO flota:', updFleetErr);
        }
      }
    } catch (fleetPoProgressErr) {
      console.error('Error actualizando progreso PO flota (no fatal):', fleetPoProgressErr);
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

      // Upsert material payable item (payable_items schema: payable_id, entry_id, amount, cost_category, po_item_id)
      const nativeQty = result.received_qty_entered ?? result.quantity_received ?? 0;
      const amountMaterial = (result.total_cost ?? ((result.unit_price || 0) * Number(nativeQty)));
      let materialPayableId: string | null = null;
      if (result.supplier_id && result.supplier_invoice && amountMaterial > 0) {
        materialPayableId = await upsertPayable(result.supplier_id, result.plant_id, result.supplier_invoice, result.ap_due_date_material, result.id);
        const materialItemPayload: Record<string, unknown> = {
          payable_id: materialPayableId,
          entry_id: result.id,
          amount: amountMaterial,
          cost_category: 'material',
        };
        if (result.po_item_id) materialItemPayload.po_item_id = result.po_item_id;
        const { error: itemErr } = await supabase
          .from('payable_items')
          .upsert(materialItemPayload, { onConflict: 'entry_id,cost_category' });
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
      console.error('AP upsert error:', apError);
      // Atomic policy: if AP upsert fails, fail the entire request to avoid entry/payable drift
      return NextResponse.json(
        {
          success: false,
          error: 'Error al crear/actualizar cuentas por pagar. La entrada no se actualizó. Intente de nuevo.',
          details: apError instanceof Error ? apError.message : String(apError),
        },
        { status: 500 }
      );
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

type MaterialEntryRow = Record<string, unknown> & {
  id: string;
  plant_id: string;
  po_item_id?: string | null;
  fleet_po_item_id?: string | null;
  fleet_qty_entered?: number | null;
  pricing_status?: string | null;
};

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const idRaw = searchParams.get('id');
    const idParsed = z.string().uuid('ID inválido').safeParse(idRaw);
    if (!idParsed.success) {
      return NextResponse.json({ success: false, error: 'ID de entrada inválido' }, { status: 400 });
    }
    const id = idParsed.data;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    if (!hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    const { data: row, error: loadErr } = await supabase
      .from('material_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (loadErr || !row) {
      return NextResponse.json({ success: false, error: 'Entrada no encontrada' }, { status: 404 });
    }

    const entry = row as MaterialEntryRow;

    if (!(await profileCanAccessMaterialEntryPlant(supabase, profile, entry.plant_id))) {
      return NextResponse.json({ success: false, error: 'Sin acceso a esta entrada' }, { status: 403 });
    }

    if (entry.pricing_status === 'reviewed') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Esta entrada ya fue revisada por administración y no puede eliminarse.',
        },
        { status: 403 }
      );
    }

    const { count: allocCount, error: allocErr } = await supabase
      .from('material_consumption_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', id);

    if (allocErr) {
      console.error('DELETE entry: allocations count', allocErr);
    } else if ((allocCount ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se puede eliminar: el material de esta entrada ya fue consumido en remisiones (costeo FIFO).',
        },
        { status: 409 }
      );
    }

    const { data: alertRows } = await supabase
      .from('material_alerts')
      .select('id')
      .eq('resolved_entry_id', id)
      .limit(1);

    if (alertRows && alertRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se puede eliminar: esta entrada cerró una alerta de material. Ajuste la alerta antes de borrar.',
        },
        { status: 409 }
      );
    }

    let materialPoPatch: {
      id: string;
      qty_received: number;
      status: string;
      qty_received_kg?: number;
    } | null = null;

    if (entry.po_item_id) {
      const { data: poItemRow } = await supabase
        .from('purchase_order_items')
        .select('qty_received, qty_received_native, qty_received_kg, qty_ordered, uom, is_service')
        .eq('id', entry.po_item_id)
        .single();
      if (poItemRow) {
        const { native: deltaNative, kg: deltaKg } = nativeKgFromEntryForPoItem(
          entry as unknown as Parameters<typeof nativeKgFromEntryForPoItem>[0],
          poItemRow
        );
        if (deltaNative > 0 || deltaKg > 0) {
          const currentNative = Number(poItemRow.qty_received ?? poItemRow.qty_received_native ?? 0);
          const currentKg = Number(poItemRow.qty_received_kg ?? 0);
          const newNative = Math.max(0, currentNative - deltaNative);
          const newKg = Math.max(0, currentKg - deltaKg);
          const orderedNative = Number(poItemRow.qty_ordered || 0);
          let newStatus = 'open';
          if (newNative >= orderedNative - 1e-6) newStatus = 'fulfilled';
          else if (newNative > 1e-6) newStatus = 'partial';
          materialPoPatch = {
            id: entry.po_item_id,
            qty_received: newNative,
            status: newStatus,
          };
          if (deltaKg > 0) materialPoPatch.qty_received_kg = newKg;
        }
      }
    }

    let fleetPoPatch: { id: string; qty_received: number; status: string } | null = null;
    if (entry.fleet_po_item_id && entry.fleet_qty_entered != null && Number(entry.fleet_qty_entered) > 0) {
      const { data: fleetItemRow } = await supabase
        .from('purchase_order_items')
        .select('qty_received, qty_received_native, qty_ordered')
        .eq('id', entry.fleet_po_item_id)
        .single();
      if (fleetItemRow) {
        const delta = Number(entry.fleet_qty_entered);
        const currentNative = Number(fleetItemRow.qty_received ?? fleetItemRow.qty_received_native ?? 0);
        const newNative = Math.max(0, currentNative - delta);
        const orderedNative = Number(fleetItemRow.qty_ordered || 0);
        let newStatus = 'open';
        if (newNative >= orderedNative - 1e-6) newStatus = 'fulfilled';
        else if (newNative > 1e-6) newStatus = 'partial';
        fleetPoPatch = { id: entry.fleet_po_item_id, qty_received: newNative, status: newStatus };
      }
    }

    const { error: piErr } = await supabase.from('payable_items').delete().eq('entry_id', id);
    if (piErr) console.error('DELETE entry: payable_items', piErr);

    const { data: docs } = await supabase.from('inventory_documents').select('file_path').eq('entry_id', id);
    if (docs?.length) {
      const paths = docs.map((d: { file_path: string }) => d.file_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: stErr } = await supabase.storage.from('inventory-documents').remove(paths);
        if (stErr) console.warn('DELETE entry: storage remove', stErr);
      }
      const { error: docDelErr } = await supabase.from('inventory_documents').delete().eq('entry_id', id);
      if (docDelErr) console.error('DELETE entry: inventory_documents', docDelErr);
    }

    const { error: delErr } = await supabase.from('material_entries').delete().eq('id', id);

    if (delErr) {
      if (delErr.code === '23503' || delErr.message?.includes('foreign key')) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No se puede eliminar: existen registros vinculados (consumos, lotes, etc.).',
          },
          { status: 409 }
        );
      }
      throw new Error(delErr.message);
    }

    const poWarnings: string[] = [];

    if (materialPoPatch) {
      const { id: lineId, ...rest } = materialPoPatch;
      const { error: updMatErr } = await supabase.from('purchase_order_items').update(rest).eq('id', lineId);
      if (updMatErr) {
        console.error('DELETE entry: revert PO material', updMatErr);
        poWarnings.push('La entrada se eliminó pero no se pudo revertir el avance de la OC de material.');
      }
    }

    if (fleetPoPatch) {
      const { id: lineId, ...rest } = fleetPoPatch;
      const { error: updFleetErr } = await supabase.from('purchase_order_items').update(rest).eq('id', lineId);
      if (updFleetErr) {
        console.error('DELETE entry: revert PO flota', updFleetErr);
        poWarnings.push('La entrada se eliminó pero no se pudo revertir el avance de la OC de flota.');
      }
    }

    const body: Record<string, unknown> = {
      success: true,
      message: 'Entrada eliminada. El inventario se actualizó automáticamente.',
    };
    if (poWarnings.length > 0) {
      body.warnings = poWarnings;
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error('Error in entries DELETE:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
