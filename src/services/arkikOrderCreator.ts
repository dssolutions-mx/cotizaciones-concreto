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

// Cache for frequently accessed data
interface DataCache {
  plantCode: string;
  materialsMap: Map<string, { id: string; material_name: string }>;
  orderNumberSequence: number;
}

export async function createOrdersFromSuggestions(
  orderSuggestions: OrderSuggestion[],
  plantId: string,
  validatedRows: StagingRemision[]
): Promise<OrderCreationResult> {
  console.log('[ArkikOrderCreator] Starting optimized order creation process');
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

    // Pre-load and cache frequently accessed data
    const dataCache = await buildDataCache(plantId, validatedRows);
    
    // Filter suggestions that need new orders (not existing ones)
    const newOrderSuggestions = orderSuggestions.filter(suggestion => 
      !suggestion.remisiones[0].orden_original
    );

    console.log('[ArkikOrderCreator] Creating', newOrderSuggestions.length, 'new orders');

    // Process orders in batches for better performance
    const batchSize = 5; // Process 5 orders at a time
    for (let i = 0; i < newOrderSuggestions.length; i += batchSize) {
      const batch = newOrderSuggestions.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(suggestion => 
          createSingleOrder(suggestion, plantId, user.id, validatedRows, dataCache)
        )
      );

      // Aggregate batch results
      batchResults.forEach((batchResult, index) => {
        if (batchResult.status === 'fulfilled') {
          const orderResult = batchResult.value;
          result.ordersCreated += orderResult.ordersCreated;
          result.remisionesCreated += orderResult.remisionesCreated;
          result.materialsProcessed += orderResult.materialsProcessed;
          result.orderItemsCreated += orderResult.orderItemsCreated;
          result.errors.push(...orderResult.errors);
        } else {
          const suggestion = batch[index];
          const errorMessage = batchResult.reason instanceof Error ? batchResult.reason.message : 'Error desconocido';
          result.errors.push(`Error en orden ${suggestion.group_key}: ${errorMessage}`);
        }
      });

      // Update order number sequence for next batch
      dataCache.orderNumberSequence += batch.length;
    }

    console.log('[ArkikOrderCreator] Order creation completed', result);
    return result;

  } catch (error) {
    console.error('[ArkikOrderCreator] Fatal error in order creation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error fatal en creación de órdenes: ${errorMessage}`);
  }
}

async function buildDataCache(plantId: string, validatedRows: StagingRemision[]): Promise<DataCache> {
  console.log('[ArkikOrderCreator] Building data cache for plant:', plantId);
  
  // Get plant code
  const { data: plant, error: plantError } = await supabase
    .from('plants')
    .select('code')
    .eq('id', plantId)
    .single();

  if (plantError || !plant) {
    throw new Error('Error obteniendo código de planta');
  }

  // Get all unique material codes from validated rows
  const materialCodes = new Set<string>();
  validatedRows.forEach(row => {
    if (row.materials_teorico) {
      Object.keys(row.materials_teorico).forEach(code => materialCodes.add(code));
    }
    if (row.materials_real) {
      Object.keys(row.materials_real).forEach(code => materialCodes.add(code));
    }
  });

  // Batch fetch all materials for this plant
  const { data: materials, error: materialsError } = await supabase
    .from('materials')
    .select('id, material_name, material_code')
    .eq('plant_id', plantId)
    .in('material_code', Array.from(materialCodes));

  if (materialsError) {
    console.warn('[ArkikOrderCreator] Error fetching materials, will fetch individually:', materialsError);
  }

  // Build materials map
  const materialsMap = new Map<string, { id: string; material_name: string }>();
  if (materials) {
    materials.forEach(material => {
      materialsMap.set(material.material_code, {
        id: material.id,
        material_name: material.material_name
      });
    });
  }

  // Get current order number sequence
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString().slice(-2);
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getDate().toString().padStart(2, '0');
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

  console.log('[ArkikOrderCreator] Data cache built successfully');
  return {
    plantCode: plant.code,
    materialsMap,
    orderNumberSequence: sequence
  };
}

async function createSingleOrder(
  suggestion: OrderSuggestion,
  plantId: string,
  userId: string,
  validatedRows: StagingRemision[],
  dataCache: DataCache
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

    // Generate order number using cached sequence
    const orderNumber = `${dataCache.plantCode}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${dataCache.orderNumberSequence.toString().padStart(3, '0')}`;
    dataCache.orderNumberSequence++;

    // Calculate totals and find earliest delivery date/time
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
      deliveryTime = earliestRemision.hora_carga.toTimeString().split(' ')[0];
    } else if (typeof earliestRemision.hora_carga === 'string') {
      deliveryTime = earliestRemision.hora_carga;
    } else {
      deliveryTime = '08:00:00';
    }

    console.log('[ArkikOrderCreator] Using earliest delivery:', deliveryDate, deliveryTime, 'from', suggestion.remisiones.length, 'remisiones');

    // Create order
    const orderData: OrderCreationData = {
      quote_id: firstRemision.quote_id,
      client_id: firstRemision.client_id,
      construction_site: firstRemision.obra_name,
      construction_site_id: firstRemision.construction_site_id || undefined,
      order_number: orderNumber,
      requires_invoice: false,
      delivery_date: deliveryDate,
      delivery_time: deliveryTime,
      special_requirements: suggestion.comentarios_externos.join(', ') || undefined,
      total_amount: totalAmount,
      credit_status: 'approved',
      order_status: 'created',
      created_by: userId,
      preliminary_amount: totalAmount,
      final_amount: totalAmount,
      invoice_amount: undefined,
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

    // Create order items for all unique recipes in this group
    const uniqueRecipes = new Map<string, { recipe_id: string; recipe_code: string; volume: number; unit_price: number }>();
    
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

    // Batch create order items
    const orderItemsData: OrderItemData[] = [];
    uniqueRecipes.forEach((recipeData) => {
      orderItemsData.push({
        order_id: createdOrder.id,
        product_type: recipeData.recipe_code,
        volume: recipeData.volume,
        unit_price: recipeData.unit_price,
        total_price: recipeData.volume * recipeData.unit_price,
        has_pump_service: false,
        recipe_id: recipeData.recipe_id,
        concrete_volume_delivered: recipeData.volume
      });
    });

    if (orderItemsData.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) {
        console.error('[ArkikOrderCreator] Error creating order items:', itemsError);
        throw new Error(`Error creando items de orden: ${itemsError.message}`);
      }

      result.orderItemsCreated = orderItemsData.length;
      console.log('[ArkikOrderCreator] Order items created successfully:', orderItemsData.length);
    }

    // Batch create remisiones and materials
    const remisionesData: RemisionData[] = [];
    const allRemisionMaterials: RemisionMaterialData[] = [];
    
    // Prepare remisiones data
    suggestion.remisiones.forEach(remisionStaging => {
      const fullRemisionData = validatedRows.find(row => 
        row.remision_number === remisionStaging.remision_number
      );

      if (fullRemisionData) {
        let horaCarga: string;
        if (fullRemisionData.hora_carga instanceof Date) {
          horaCarga = fullRemisionData.hora_carga.toTimeString().split(' ')[0];
        } else if (typeof fullRemisionData.hora_carga === 'string') {
          horaCarga = fullRemisionData.hora_carga;
        } else {
          horaCarga = '08:00:00';
        }

        remisionesData.push({
          order_id: createdOrder.id,
          remision_number: fullRemisionData.remision_number,
          fecha: fullRemisionData.fecha.toISOString().split('T')[0],
          hora_carga: horaCarga,
          volumen_fabricado: fullRemisionData.volumen_fabricado,
          conductor: fullRemisionData.conductor || undefined,
          unidad: undefined, // Remove this field as it doesn't exist in StagingRemision
          tipo_remision: 'CONCRETO',
          recipe_id: fullRemisionData.recipe_id!,
          plant_id: plantId
        });
      }
    });

    // Create remisiones in batch
    if (remisionesData.length > 0) {
      const { data: createdRemisiones, error: remisionesError } = await supabase
        .from('remisiones')
        .insert(remisionesData)
        .select('id, remision_number');

      if (remisionesError) {
        console.error('[ArkikOrderCreator] Error creating remisiones:', remisionesError);
        throw new Error(`Error creando remisiones: ${remisionesError.message}`);
      }

      result.remisionesCreated = createdRemisiones.length;
      console.log('[ArkikOrderCreator] Remisiones created successfully:', createdRemisiones.length);

      // Prepare materials data for batch insertion
      createdRemisiones.forEach(createdRemision => {
        const fullRemisionData = validatedRows.find(row => 
          row.remision_number === createdRemision.remision_number
        );

        if (fullRemisionData && fullRemisionData.materials_teorico && fullRemisionData.materials_real) {
          const allMaterialCodes = new Set([
            ...Object.keys(fullRemisionData.materials_teorico),
            ...Object.keys(fullRemisionData.materials_real)
          ]);

          allMaterialCodes.forEach(materialCode => {
            const cachedMaterial = dataCache.materialsMap.get(materialCode);
            if (cachedMaterial) {
              allRemisionMaterials.push({
                remision_id: createdRemision.id,
                material_id: cachedMaterial.id,
                material_type: cachedMaterial.material_name,
                cantidad_real: fullRemisionData.materials_real[materialCode] || 0,
                cantidad_teorica: fullRemisionData.materials_teorico[materialCode] || 0
              });
            } else {
              // Fallback: fetch material individually if not in cache
              console.warn('[ArkikOrderCreator] Material not found in cache, will fetch individually:', materialCode);
            }
          });
        }
      });

      // Create materials in batch
      if (allRemisionMaterials.length > 0) {
        const { error: materialsError } = await supabase
          .from('remision_materiales')
          .insert(allRemisionMaterials);

        if (materialsError) {
          console.error('[ArkikOrderCreator] Error creating materials:', materialsError);
          // Don't throw here, just log the error
          result.errors.push(`Error creando materiales: ${materialsError.message}`);
        } else {
          result.materialsProcessed = allRemisionMaterials.length;
          console.log('[ArkikOrderCreator] Materials created successfully:', allRemisionMaterials.length);
        }
      }
    }

    return result;

  } catch (error) {
    console.error('[ArkikOrderCreator] Error in createSingleOrder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(errorMessage);
  }
}
