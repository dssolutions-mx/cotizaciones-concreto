import { supabase } from '@/lib/supabase/client';
import type { OrderSuggestion, StagingRemision } from '@/types/arkik';

export interface OrderCreationResult {
  ordersCreated: number;
  remisionesCreated: number;
  materialsProcessed: number;
  orderItemsCreated: number;
  errors: string[];
}

interface OrderCreationData {
  quote_id: string;
  client_id: string;
  construction_site: string;
  construction_site_id?: string;
  order_number: string;
  requires_invoice: boolean;
  delivery_date: string;
  delivery_time: string;
  special_requirements?: string;
  total_amount: number;
  credit_status: 'approved';
  order_status: 'created';
  created_by: string;
  preliminary_amount: number;
  final_amount: number;
  invoice_amount?: number;
  plant_id: string;
  auto_generated: true;
  elemento?: string;
}

interface OrderItemData {
  order_id: string;
  quote_detail_id?: string;
  product_type: string;
  volume: number;
  unit_price: number;
  total_price: number;
  has_pump_service: boolean;
  pump_price?: number;
  recipe_id: string;
  concrete_volume_delivered: number;
}

interface RemisionData {
  order_id: string;
  remision_number: string;
  fecha: string;
  hora_carga: string;
  volumen_fabricado: number;
  conductor?: string;
  unidad?: string;
  tipo_remision: 'CONCRETO';
  recipe_id: string;
  plant_id: string;
}

interface RemisionMaterialData {
  remision_id: string;
  material_id: string;
  material_type: string;
  cantidad_real: number;
  cantidad_teorica: number;
}

export async function createOrdersFromSuggestions(
  orderSuggestions: OrderSuggestion[],
  plantId: string,
  validatedRows: StagingRemision[]
): Promise<OrderCreationResult> {
  console.log('[ArkikOrderCreator] Starting order creation process');
  console.log('[ArkikOrderCreator] Order suggestions:', orderSuggestions.length);
  console.log('[ArkikOrderCreator] Validated rows:', validatedRows.length);

  const result: OrderCreationResult = {
    ordersCreated: 0,
    remisionesCreated: 0,
    materialsProcessed: 0,
    orderItemsCreated: 0,
    errors: []
  };

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Filter suggestions that need new orders (not existing ones)
    const newOrderSuggestions = orderSuggestions.filter(suggestion => 
      !suggestion.remisiones[0].orden_original
    );

    console.log('[ArkikOrderCreator] Creating', newOrderSuggestions.length, 'new orders');

    // Process each order suggestion
    for (const suggestion of newOrderSuggestions) {
      try {
        const orderResult = await createSingleOrder(suggestion, plantId, user.id, validatedRows);
        result.ordersCreated += orderResult.ordersCreated;
        result.remisionesCreated += orderResult.remisionesCreated;
        result.materialsProcessed += orderResult.materialsProcessed;
        result.orderItemsCreated += orderResult.orderItemsCreated;
        result.errors.push(...orderResult.errors);
      } catch (error) {
        console.error('[ArkikOrderCreator] Error creating order for suggestion:', suggestion.group_key, error);
        result.errors.push(`Error en orden ${suggestion.group_key}: ${error.message}`);
      }
    }

    console.log('[ArkikOrderCreator] Order creation completed', result);
    return result;

  } catch (error) {
    console.error('[ArkikOrderCreator] Fatal error in order creation:', error);
    throw new Error(`Error fatal en creación de órdenes: ${error.message}`);
  }
}

async function createSingleOrder(
  suggestion: OrderSuggestion,
  plantId: string,
  userId: string,
  validatedRows: StagingRemision[]
): Promise<OrderCreationResult> {
  console.log('[ArkikOrderCreator] Creating single order for group:', suggestion.group_key);
  
  const result: OrderCreationResult = {
    ordersCreated: 0,
    remisionesCreated: 0,
    materialsProcessed: 0,
    orderItemsCreated: 0,
    errors: []
  };

  // Get the first remision for order data
  const firstRemision = suggestion.remisiones[0];
  
  if (!firstRemision.client_id || !firstRemision.recipe_id) {
    throw new Error('Datos incompletos: client_id o recipe_id faltante');
  }

  try {
    // Validate required fields
    if (!firstRemision.quote_id) {
      throw new Error(`No se encontró quote_id para la receta ${firstRemision.recipe_code} del cliente ${firstRemision.cliente_name}. Price source: ${firstRemision.price_source}`);
    }

    if (!firstRemision.unit_price) {
      throw new Error(`No se encontró precio unitario para la receta ${firstRemision.recipe_code}`);
    }



    // 2. Generate order number
    const orderNumber = await generateOrderNumber(plantId);

    // 3. Calculate totals and find earliest delivery date/time
    const totalVolume = suggestion.total_volume;
    const unitPrice = firstRemision.unit_price;
    const totalAmount = totalVolume * unitPrice;

    // Find the earliest date and time from all remisiones in the group
    const sortedRemisiones = suggestion.remisiones.sort((a, b) => {
      const dateA = new Date(`${a.fecha.toISOString().split('T')[0]}T${a.hora_carga || '08:00:00'}`);
      const dateB = new Date(`${b.fecha.toISOString().split('T')[0]}T${b.hora_carga || '08:00:00'}`);
      return dateA.getTime() - dateB.getTime();
    });
    
    const earliestRemision = sortedRemisiones[0];
    const deliveryDate = earliestRemision.fecha.toISOString().split('T')[0];
    
    // Ensure delivery_time is in HH:MM:SS format for database
    let deliveryTime: string;
    if (earliestRemision.hora_carga instanceof Date) {
      // Convert Date to HH:MM:SS format
      deliveryTime = earliestRemision.hora_carga.toTimeString().split(' ')[0];
    } else if (typeof earliestRemision.hora_carga === 'string') {
      // If it's already a string, ensure it's in correct format
      deliveryTime = earliestRemision.hora_carga;
    } else {
      // Default fallback
      deliveryTime = '08:00:00';
    }

    console.log('[ArkikOrderCreator] Using earliest delivery:', deliveryDate, deliveryTime, 'from', suggestion.remisiones.length, 'remisiones');

    // 4. Create order
    const orderData: OrderCreationData = {
      quote_id: firstRemision.quote_id,
      client_id: firstRemision.client_id,
      construction_site: firstRemision.obra_name,
      construction_site_id: firstRemision.construction_site_id || undefined,
      order_number: orderNumber,
      requires_invoice: false, // Default for Arkik imports
      delivery_date: deliveryDate,
      delivery_time: deliveryTime,
      special_requirements: suggestion.comentarios_externos.join(', ') || undefined,
      total_amount: totalAmount,
      credit_status: 'approved',
      order_status: 'created',
      created_by: userId,
      preliminary_amount: totalAmount,
      final_amount: totalAmount,
      invoice_amount: undefined, // Will be calculated by trigger if needed
      plant_id: plantId,
      auto_generated: true,
      elemento: suggestion.comentarios_externos[0] || undefined
    };

    const { data: createdOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (orderError) {
      console.error('[ArkikOrderCreator] Error creating order:', orderError);
      throw new Error(`Error creando orden: ${orderError.message}`);
    }

    result.ordersCreated = 1;
    console.log('[ArkikOrderCreator] Order created with ID:', createdOrder.id);

    // 5. Create order items for all unique recipes in this group
    const uniqueRecipes = new Map<string, { recipe_id: string, recipe_code: string, volume: number, unit_price: number }>();
    
    // Group by recipe and sum volumes
    suggestion.remisiones.forEach(remision => {
      if (remision.recipe_id && remision.recipe_code) {
        const key = remision.recipe_id;
        if (uniqueRecipes.has(key)) {
          const existing = uniqueRecipes.get(key)!;
          existing.volume += remision.volumen_fabricado;
        } else {
          uniqueRecipes.set(key, {
            recipe_id: remision.recipe_id,
            recipe_code: remision.recipe_code,
            volume: remision.volumen_fabricado,
            unit_price: remision.unit_price || 0
          });
        }
      }
    });

    console.log('[ArkikOrderCreator] Creating', uniqueRecipes.size, 'order items for unique recipes');

    // Create one order item per unique recipe
    for (const [recipeId, recipeData] of uniqueRecipes) {
      const orderItemData: OrderItemData = {
        order_id: createdOrder.id,
        product_type: recipeData.recipe_code,
        volume: recipeData.volume,
        unit_price: recipeData.unit_price,
        total_price: recipeData.volume * recipeData.unit_price,
        has_pump_service: false, // Default for Arkik imports
        recipe_id: recipeData.recipe_id,
        concrete_volume_delivered: recipeData.volume
      };

      const { error: itemError } = await supabase
        .from('order_items')
        .insert(orderItemData);

      if (itemError) {
        console.error('[ArkikOrderCreator] Error creating order item for recipe:', recipeData.recipe_code, itemError);
        throw new Error(`Error creando item de orden para receta ${recipeData.recipe_code}: ${itemError.message}`);
      }

      result.orderItemsCreated++;
      console.log('[ArkikOrderCreator] Order item created for recipe:', recipeData.recipe_code, 'with volume:', recipeData.volume);
    }

    // 6. Create remisiones for each validated row in this suggestion
    for (const remisionStaging of suggestion.remisiones) {
      try {
        const remisionResult = await createRemisionWithMaterials(
          createdOrder.id,
          remisionStaging,
          plantId,
          validatedRows
        );
        result.remisionesCreated += remisionResult.remisionesCreated;
        result.materialsProcessed += remisionResult.materialsProcessed;
        result.errors.push(...remisionResult.errors);
      } catch (error) {
        console.error('[ArkikOrderCreator] Error creating remision:', remisionStaging.remision_number, error);
        result.errors.push(`Error en remisión ${remisionStaging.remision_number}: ${error.message}`);
      }
    }

    return result;

  } catch (error) {
    console.error('[ArkikOrderCreator] Error in createSingleOrder:', error);
    throw error;
  }
}

async function createRemisionWithMaterials(
  orderId: string,
  remisionStaging: StagingRemision,
  plantId: string,
  validatedRows: StagingRemision[]
): Promise<OrderCreationResult> {
  console.log('[ArkikOrderCreator] Creating remision:', remisionStaging.remision_number);
  
  const result: OrderCreationResult = {
    ordersCreated: 0,
    remisionesCreated: 0,
    materialsProcessed: 0,
    orderItemsCreated: 0,
    errors: []
  };

  // Find the full validated row data
  const fullRemisionData = validatedRows.find(row => 
    row.remision_number === remisionStaging.remision_number
  );

  if (!fullRemisionData) {
    throw new Error(`No se encontraron datos completos para remisión ${remisionStaging.remision_number}`);
  }

  try {
    // Create remision
    // Ensure hora_carga is in HH:MM:SS format for database
    let horaCarga: string;
    if (fullRemisionData.hora_carga instanceof Date) {
      // Convert Date to HH:MM:SS format
      horaCarga = fullRemisionData.hora_carga.toTimeString().split(' ')[0];
    } else if (typeof fullRemisionData.hora_carga === 'string') {
      // If it's already a string, ensure it's in correct format
      horaCarga = fullRemisionData.hora_carga;
    } else {
      // Default fallback
      horaCarga = '08:00:00';
    }

    const remisionData: RemisionData = {
      order_id: orderId,
      remision_number: fullRemisionData.remision_number,
      fecha: fullRemisionData.fecha.toISOString().split('T')[0],
      hora_carga: horaCarga,
      volumen_fabricado: fullRemisionData.volumen_fabricado,
      conductor: fullRemisionData.conductor || undefined,
      unidad: fullRemisionData.unidad || undefined,
      tipo_remision: 'CONCRETO',
      recipe_id: fullRemisionData.recipe_id!,
      plant_id: plantId
    };



    const { data: createdRemision, error: remisionError } = await supabase
      .from('remisiones')
      .insert(remisionData)
      .select('id')
      .single();

    if (remisionError) {
      console.error('[ArkikOrderCreator] Error creating remision:', remisionError);
      throw new Error(`Error creando remisión: ${remisionError.message}`);
    }

    result.remisionesCreated = 1;
    console.log('[ArkikOrderCreator] Remision created with ID:', createdRemision.id);

    // Create remision_materiales for each material
    if (fullRemisionData.materials_teorico && fullRemisionData.materials_real) {
      const materialsCreated = await createRemisionMaterials(
        createdRemision.id,
        fullRemisionData.materials_teorico,
        fullRemisionData.materials_real,
        plantId
      );
      result.materialsProcessed = materialsCreated;
    }

    return result;

  } catch (error) {
    console.error('[ArkikOrderCreator] Error in createRemisionWithMaterials:', error);
    throw error;
  }
}

async function createRemisionMaterials(
  remisionId: string,
  materialsTeoretico: Record<string, number>,
  materialsReal: Record<string, number>,
  plantId: string
): Promise<number> {
  console.log('[ArkikOrderCreator] Creating materials for remision:', remisionId);
  
  let materialsProcessed = 0;
  
  // Get unique material codes from both theoretical and real
  const allMaterialCodes = new Set([
    ...Object.keys(materialsTeoretico),
    ...Object.keys(materialsReal)
  ]);

  console.log('[ArkikOrderCreator] Processing', allMaterialCodes.size, 'material codes');

  for (const materialCode of allMaterialCodes) {
    try {
      // Get material data from materials table using material_code
      const { data: material, error: materialError } = await supabase
        .from('materials')
        .select('id, material_name, material_code')
        .eq('material_code', materialCode)
        .eq('plant_id', plantId)
        .maybeSingle();

      if (materialError) {
        console.error('[ArkikOrderCreator] Error fetching material:', materialCode, materialError);
        continue; // Skip this material but continue with others
      }

      if (!material) {
        console.warn('[ArkikOrderCreator] Material not found for code:', materialCode, 'in plant:', plantId);
        continue; // Skip this material but continue with others
      }

      // Use the UUID from the materials table for proper relationship
      const materialData: RemisionMaterialData = {
        remision_id: remisionId,
        material_id: material.id, // This is the UUID from materials table
        material_type: material.material_name, // Keep the descriptive name
        cantidad_real: materialsReal[materialCode] || 0,
        cantidad_teorica: materialsTeoretico[materialCode] || 0
      };

      const { error: materialInsertError } = await supabase
        .from('remision_materiales')
        .insert(materialData);

      if (materialInsertError) {
        console.error('[ArkikOrderCreator] Error inserting material:', materialCode, materialInsertError);
        continue; // Skip this material but continue with others
      }

      materialsProcessed++;
      console.log('[ArkikOrderCreator] Material processed:', materialCode, '->', material.id, material.material_name);

    } catch (error) {
      console.error('[ArkikOrderCreator] Error processing material:', materialCode, error);
      // Continue with next material
    }
  }

  console.log('[ArkikOrderCreator] Materials processing completed:', materialsProcessed, 'of', allMaterialCodes.size);
  return materialsProcessed;
}

async function generateOrderNumber(plantId: string): Promise<string> {
  // Get plant code
  const { data: plant, error: plantError } = await supabase
    .from('plants')
    .select('code')
    .eq('id', plantId)
    .single();

  if (plantError || !plant) {
    throw new Error('Error obteniendo código de planta');
  }

  // Get current date
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  // Get next sequence number for today
  const datePrefix = `${plant.code}-${year}${month}${day}`;
  
  const { data: lastOrder, error: orderError } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${datePrefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sequence = 1;
  if (lastOrder && orderError === null) {
    const lastSequence = parseInt(lastOrder.order_number.slice(-3));
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const orderNumber = `${datePrefix}-${sequence.toString().padStart(3, '0')}`;
  console.log('[ArkikOrderCreator] Generated order number:', orderNumber);
  
  return orderNumber;
}
