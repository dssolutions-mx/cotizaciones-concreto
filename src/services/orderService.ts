// Remove createClientComponentClient import since we use the singleton client
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  // Removed unused Order
  OrderWithClient, 
  OrderWithDetails, 
  // Removed unused OrderItem
  EmptyTruckDetails,
  PumpServiceDetails 
} from '@/types/orders';
// Import the singleton Supabase client
import { supabase } from '@/lib/supabase';

export interface OrderCreationParams {
  quote_id: string;
  client_id: string;
  construction_site: string;
  construction_site_id?: string;
  plant_id?: string;
  delivery_date: string;
  delivery_time: string;
  requires_invoice: boolean;
  special_requirements: string | null;
  total_amount: number;
  order_status: string;
  credit_status: string;
  // New optional delivery coordinates and maps URL
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_google_maps_url?: string | null;
  // Site access validation
  site_access_rating?: 'green' | 'yellow' | 'red';
  site_validation?: {
    road_type?: 'paved' | 'gravel_good' | 'gravel_rough';
    road_slope?: 'none' | 'moderate' | 'steep';
    recent_weather_impact?: 'dry' | 'light_rain' | 'heavy_rain';
    route_incident_history?: 'none' | 'minor' | 'major';
    validation_notes?: string | null;
    evidence_photo_urls?: string[];
    validated_by?: string | null;
    validated_at?: string | Date;
  };
  order_items?: Array<{
    quote_detail_id: string;
    volume: number;
    pump_volume?: number | null;
  }>;
  // Optional: If provided, only copy these additional products. Otherwise, copy all from quote.
  selected_additional_product_ids?: string[];
}

export async function createOrder(orderData: OrderCreationParams, emptyTruckData?: EmptyTruckDetails | null, pumpServiceData?: PumpServiceDetails | null) {
  try {
    // Use the singleton Supabase client instead of creating a new one each time
    // const supabase = createClientComponentClient<Database>();
    
    // Generate a unique order number (format: ORD-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    const orderNumber = `ORD-${dateStr}-${randomPart}`;
    
    // Get current user's ID from the auth session with fallback to NULL instead of 'system'
    let userId = null;
    try {
      const { data: authData } = await supabase.auth.getSession();
      
      if (authData && authData.session && authData.session.user) {
        userId = authData.session.user.id;
      } else {
        // Instead of using 'system' string which is not a valid UUID,
        // set to NULL and let the database handle the constraint
      }
    } catch (authError) {
      // Could not get auth session, using null for created_by
    }
    
        // Check if we have a valid user ID
    if (!userId) {
      throw new Error('Usuario no autenticado. Debe iniciar sesión para crear órdenes.');
    }

    // Get plant_id from the associated quote (primary source)
    let plantId = null;
    if (orderData.quote_id) {
      console.log('Fetching plant_id for quote:', orderData.quote_id);
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('plant_id')
        .eq('id', orderData.quote_id)
        .single();
        
      if (quoteError) {
        console.error('Error fetching quote plant_id:', quoteError);
      } else if (quote) {
        plantId = quote.plant_id;
        console.log('Found plant_id from quote:', plantId);
      } else {
        console.log('No quote found for ID:', orderData.quote_id);
      }
    }
    
    // Fallback to orderData plant_id if quote doesn't have one
    if (!plantId && orderData.plant_id) {
      plantId = orderData.plant_id;
      console.log('Using plant_id from orderData as fallback:', plantId);
    }

    // Revert to direct insert to avoid PostgREST schema cache issues
    const orderInsertData: any = {
      quote_id: orderData.quote_id,
      client_id: orderData.client_id,
      construction_site: orderData.construction_site,
      construction_site_id: orderData.construction_site_id,
      order_number: orderNumber,
      delivery_date: orderData.delivery_date,
      delivery_time: orderData.delivery_time,
      requires_invoice: orderData.requires_invoice,
      special_requirements: orderData.special_requirements,
      total_amount: orderData.total_amount,
      order_status: orderData.order_status,
      credit_status: orderData.credit_status,
      created_by: userId
    };

    // Add plant_id if inherited from quote
    if (plantId) {
      orderInsertData.plant_id = plantId;
    }

    // Include optional delivery coordinates and URL if provided
    if (typeof orderData.delivery_latitude === 'number') {
      orderInsertData.delivery_latitude = orderData.delivery_latitude;
    }
    if (typeof orderData.delivery_longitude === 'number') {
      orderInsertData.delivery_longitude = orderData.delivery_longitude;
    }
    if (orderData.delivery_google_maps_url) {
      orderInsertData.delivery_google_maps_url = orderData.delivery_google_maps_url;
    }

    // Include site access rating if provided
    if (orderData.site_access_rating) {
      orderInsertData.site_access_rating = orderData.site_access_rating;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderInsertData)
      .select('id')
      .single();

    if (orderError) throw orderError;
    
    // If Yellow/Red, insert validation record with evidence
    if (orderData.site_access_rating && orderData.site_access_rating !== 'green' && orderData.site_validation) {
      const validationInsert = {
        order_id: order.id,
        road_type: orderData.site_validation.road_type ?? null,
        road_slope: orderData.site_validation.road_slope ?? null,
        recent_weather_impact: orderData.site_validation.recent_weather_impact ?? null,
        route_incident_history: orderData.site_validation.route_incident_history ?? null,
        validation_notes: orderData.site_validation.validation_notes ?? null,
        evidence_photo_urls: orderData.site_validation.evidence_photo_urls ?? [],
        validated_by: userId,
        validated_at: new Date().toISOString()
      } as any;

      const { error: validationError } = await supabase
        .from('order_site_validations')
        .insert(validationInsert);

      if (validationError) throw validationError;
    }
    
    // If orderData.order_items are provided, insert them
    if (orderData.order_items && orderData.order_items.length > 0) {
      // Fetch the quote details to get product information
      const { data: quoteDetails, error: quoteDetailsError } = await supabase
        .from('quote_details')
        .select(`
          id,
          final_price,
          pump_service,
          pump_price,
          product_id,
          recipe_id,
          master_recipe_id,
          recipes:recipe_id (
            recipe_code
          ),
          master_recipes:master_recipe_id (
            master_code
          )
        `)
        .in('id', orderData.order_items.map(item => item.quote_detail_id));

      if (quoteDetailsError) throw quoteDetailsError;

      // Insert order items
      const orderItems = orderData.order_items.map((item: any) => {
        const quoteDetail = quoteDetails.find(qd => qd.id === item.quote_detail_id);

        console.log('Processing order item:', {
          quoteDetailId: item.quote_detail_id,
          quoteDetail: quoteDetail,
          pumpService: quoteDetail?.pump_service,
          productId: quoteDetail?.product_id,
          recipeId: quoteDetail?.recipe_id,
          masterRecipeId: quoteDetail?.master_recipe_id,
          recipes: quoteDetail?.recipes,
          masterRecipes: quoteDetail?.master_recipes
        });

        // Determine product type based on quote detail type
        // PRIORITY: Master-first, then recipe, then pumping-only, then unknown
        let productType = 'Unknown';
        if (quoteDetail?.master_recipe_id && quoteDetail?.master_recipes) {
          // Master-based concrete product
          productType = quoteDetail.master_recipes.master_code || 'Unknown';
          console.log('Identified as master-based concrete product:', productType);
        } else if (quoteDetail?.recipe_id && quoteDetail?.recipes) {
          // Recipe-based concrete product (fallback when no master)
          productType = quoteDetail.recipes.recipe_code || 'Unknown';
          console.log('Identified as recipe-based concrete product:', productType);
        } else if (quoteDetail?.pump_service && quoteDetail?.product_id) {
          // This is a standalone pumping service
          productType = 'SERVICIO DE BOMBEO';
          console.log('Identified as standalone pumping service');
        } else {
          console.log('Could not determine product type, using Unknown');
        }

        // No longer include pump_volume field for individual items (legacy approach removed)
        // CRITICAL: When master_recipe_id exists, recipe_id must be NULL (master-level item)
        // This matches the pattern used in Arkik order creator and client portal
        return {
          order_id: order.id,
          quote_detail_id: item.quote_detail_id,
          recipe_id: quoteDetail?.master_recipe_id ? null : (quoteDetail?.recipe_id || null),
          master_recipe_id: quoteDetail?.master_recipe_id || null,
          product_type: productType,
          volume: item.volume,
          unit_price: quoteDetail?.final_price || 0,
          total_price: (quoteDetail?.final_price || 0) * item.volume,
          has_pump_service: quoteDetail?.pump_service || false,
          pump_price: quoteDetail?.pump_service ? quoteDetail?.final_price : null,
          pump_volume: null // Always null for individual items in new approach
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;
    }
    
    // If empty truck data is provided, add it as a separate order item
    if (emptyTruckData && emptyTruckData.hasEmptyTruckCharge) {
      const { error: emptyTruckError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          quote_detail_id: null,
          product_type: 'VACÍO DE OLLA',
          volume: emptyTruckData.emptyTruckVolume,
          unit_price: emptyTruckData.emptyTruckPrice,
          total_price: emptyTruckData.emptyTruckVolume * emptyTruckData.emptyTruckPrice,
          has_pump_service: false,
          has_empty_truck_charge: true,
          empty_truck_volume: emptyTruckData.emptyTruckVolume,
          empty_truck_price: emptyTruckData.emptyTruckPrice
        });

      if (emptyTruckError) throw emptyTruckError;
    }

    // If pump service data is provided, add it as a separate "SERVICIO DE BOMBEO" order item
    if (pumpServiceData && pumpServiceData.volume > 0) {
      const { error: pumpServiceError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          quote_detail_id: null,
          product_type: 'SERVICIO DE BOMBEO',
          volume: pumpServiceData.volume,
          unit_price: pumpServiceData.unit_price,
          total_price: pumpServiceData.total_price,
          has_pump_service: true,
          pump_price: pumpServiceData.unit_price,
          pump_volume: pumpServiceData.volume,
          pump_volume_delivered: null, // Should be null initially, updated when remisiones confirm delivery
          has_empty_truck_charge: false
        });

      if (pumpServiceError) throw pumpServiceError;
    }

    // Copy additional products from quotes as order_items
    // If specific IDs are provided, fetch those directly (can be from multiple quotes)
    // Otherwise, if quote_id is provided, fetch all from that quote
    if (order.id && (orderData.selected_additional_product_ids?.length > 0 || orderData.quote_id)) {
      try {
        let query = supabase
          .from('quote_additional_products')
          .select(`
            *,
            additional_products (
              id,
              name,
              code,
              unit
            )
          `);
        
        if (orderData.selected_additional_product_ids && orderData.selected_additional_product_ids.length > 0) {
          // Remove duplicates from selected IDs (defensive programming)
          const uniqueIds = Array.from(new Set(orderData.selected_additional_product_ids));
          // Fetch selected additional products by ID (can be from multiple quotes)
          query = query.in('id', uniqueIds);
        } else if (orderData.quote_id) {
          // Fallback: fetch all from the primary quote
          query = query.eq('quote_id', orderData.quote_id);
        } else {
          return order; // No additional products to copy
        }
        
        const { data: quoteAdditionalProducts, error: additionalError } = await query;

        if (additionalError) {
          console.error('Error fetching quote additional products:', additionalError);
        } else if (quoteAdditionalProducts && quoteAdditionalProducts.length > 0) {
          // Deduplicate products by ID to avoid inserting duplicates
          const uniqueProductsMap = new Map<string, any>();
          quoteAdditionalProducts.forEach((product: any) => {
            if (!uniqueProductsMap.has(product.id)) {
              uniqueProductsMap.set(product.id, product);
            }
          });
          const uniqueProducts = Array.from(uniqueProductsMap.values());
          
          // Calculate total concrete volume from order items for multiplier
          const { data: concreteItems } = await supabase
            .from('order_items')
            .select('volume')
            .eq('order_id', order.id)
            .neq('product_type', 'SERVICIO DE BOMBEO')
            .neq('product_type', 'VACÍO DE OLLA');
          
          const totalConcreteVolume = concreteItems?.reduce((sum, item) => sum + (item.volume || 0), 0) || 0;
          
          // Create order_items for additional products
          // Additional products are multiplied by concrete volume, so we use quantity as the multiplier
          const additionalProductItems = uniqueProducts.map((product: any) => {
            const additionalProduct = product.additional_products;
            const productName = additionalProduct?.name || 'Producto Adicional';
            const productCode = additionalProduct?.code || 'ADDL';
            
            // Calculate volume: quantity (per m³) × total concrete volume
            // For initial creation, use scheduled volume; will be recalculated with delivered volume
            const itemVolume = product.quantity; // This is the multiplier per m³
            const unitPrice = product.unit_price;
            // Initial total will be recalculated based on delivered volume
            const initialTotal = product.quantity * totalConcreteVolume * unitPrice;
            
            return {
              order_id: order.id,
              quote_detail_id: null, // Additional products don't have quote_detail_id
              recipe_id: null,
              master_recipe_id: null,
              product_type: `PRODUCTO ADICIONAL: ${productName} (${productCode})`,
              volume: itemVolume, // Store the multiplier (quantity per m³)
              unit_price: unitPrice,
              total_price: initialTotal, // Will be recalculated with delivered volume
              has_pump_service: false,
              pump_price: null,
              pump_volume: null,
              // Store additional product info in a way we can retrieve it
              // We'll use product_type to identify these items
            };
          });

          // Insert into order_items
          const { error: insertAdditionalError } = await supabase
            .from('order_items')
            .insert(additionalProductItems);

          if (insertAdditionalError) {
            console.error('Error inserting additional products as order_items:', insertAdditionalError);
            // Don't throw - order is already created, just log the error
          } else {
            console.log(`Created ${uniqueProducts.length} additional products as order_items for order ${order.id}`);
          }
        }
      } catch (error) {
        console.error('Error copying additional products:', error);
        // Don't throw - order is already created, just log the error
      }
    }

    return order;
  } catch (error) {
    console.error('Error in createOrder:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Error desconocido al crear la orden');
    }
  }
}

export async function getOrders(
  filterStatus?: string, 
  maxItems?: number, 
  dateRange?: { startDate?: string, endDate?: string }, 
  creditStatusFilter?: string,
  plantIds?: string[] | null
) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  let query = supabase
    .from('orders')
    .select(`
      *,
      clients!inner(business_name, client_code),
      order_items(
        id,
        volume,
        pump_volume,
        has_pump_service,
        product_type,
        has_empty_truck_charge
      )
    `);
  
  if (filterStatus) {
    query = query.eq('order_status', filterStatus);
  } else {
    // Si no hay un filtro específico de estado, excluir los pedidos rechazados
    // Usamos un enfoque más simple: filtrar manualmente los resultados
    // No filtramos en la consulta, sino en el código
  }
  
  if (creditStatusFilter) {
    query = query.eq('credit_status', creditStatusFilter);
  }
  
  // Apply plant filtering if plantIds is provided
  if (plantIds && plantIds.length > 0) {
    query = query.in('plant_id', plantIds);
  } else if (plantIds && plantIds.length === 0) {
    // User has no access - return empty result by filtering on a non-existent condition
    query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
  }
  // If plantIds is null, user can access all plants (global admin), so no filter applied
  
  if (dateRange?.startDate) {
    query = query.gte('delivery_date', dateRange.startDate);
  }
  
  if (dateRange?.endDate) {
    query = query.lte('delivery_date', dateRange.endDate);
  }
  
  if (maxItems) {
    query = query.limit(maxItems);
  }
  
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
  
  // Ensure data is not null and has the expected structure
  if (!data) {
    return [];
  }
  
  // Filtrar manualmente los pedidos rechazados
  let filteredData = data;
  if (!filterStatus) {
    filteredData = data.filter(order =>
      order.credit_status !== 'rejected' &&
      order.credit_status !== 'rejected_by_validator'
    );
  }

  // Calculate concrete and pump volumes for each order
  const enrichedOrders = filteredData?.map(order => {
    const items = order.order_items || [];
    let concreteVolume = 0;
    let pumpVolume = 0;
    let hasPumpService = false;

    // Only calculate volumes if there are items
    if (items.length > 0) {
      items.forEach((item: any) => {
        const productType = item.product_type || '';
        const volume = item.volume || 0;
        const pumpVolumeItem = item.pump_volume || 0;

        // Determine if this item is an empty truck charge
        const isEmptyTruckCharge = item.has_empty_truck_charge ||
                                  productType === 'VACÍO DE OLLA' ||
                                  productType === 'EMPTY_TRUCK_CHARGE';

        // Determine if this item is a pump service
        const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
                             productType.toLowerCase().includes('bombeo') ||
                             productType.toLowerCase().includes('pump');

        // Calculate concrete volume (exclude empty truck charges and pump services)
        if (!isEmptyTruckCharge && !isPumpService) {
          concreteVolume += volume;
        }

        // Calculate pump volume
        if (item.has_pump_service || isPumpService) {
          if (pumpVolumeItem > 0) {
            pumpVolume += pumpVolumeItem;
          } else if (isPumpService && volume > 0) {
            pumpVolume += volume;
          }
          hasPumpService = true;
        }
      });
    }

    return {
      ...order,
      concreteVolume: concreteVolume > 0 ? concreteVolume : undefined,
      pumpVolume: pumpVolume > 0 ? pumpVolume : undefined,
      hasPumpService
    };
  });

  return enrichedOrders as unknown as OrderWithClient[];
}

export async function getOrderById(id: string) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      clients!inner(id, business_name, client_code, email, phone),
      products:order_items(*, quote_details(recipe_id)),
      plant:plant_id(
        id,
        name,
        code,
        business_unit:business_unit_id(
          id,
          name,
          code,
          vat_rate
        )
      ),
      order_site_validations(
        road_type,
        road_slope,
        recent_weather_impact,
        route_incident_history,
        validation_notes,
        evidence_photo_urls
      )
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  
  // Transform data to match the OrderWithDetails type and structure products
  if (data) {
    // Rename clients to client for consistency with OrderWithDetails
    const { clients, products, plant, ...orderData } = data;
    
    // Map products to include recipe_id directly
    const structuredProducts = (products || []).map((p: { recipe_id: string | null; quote_details: { recipe_id: string } | null; [key: string]: any }) => {
      // Usar el recipe_id directo del order_item si existe, sino el de quote_details como fallback
      const recipeId = p.recipe_id !== null ? p.recipe_id : (p.quote_details?.recipe_id || null);
      const { quote_details, ...productData } = p;
      return {
        ...productData,
        recipe_id: recipeId
      };
    });

    return {
      ...orderData,
      client: clients,
      products: structuredProducts, // Use the transformed products
      plant: plant
    } as unknown as OrderWithDetails;
  }
  
  return data as unknown as OrderWithDetails;
}

export async function getOrdersForCreditValidation(plantIds?: string[] | null) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  // First, get order IDs that have remisiones (already delivered)
  const { data: ordersWithRemisiones } = await supabase
    .from('remisiones')
    .select('order_id')
    .not('order_id', 'is', null);
  
  const deliveredOrderIds = ordersWithRemisiones 
    ? [...new Set(ordersWithRemisiones.map((r: any) => r.order_id).filter(Boolean))]
    : [];
  
  let query = supabase
    .from('orders')
    .select(`
      *,
      clients!inner(business_name, client_code),
      order_items(
        id,
        volume,
        pump_volume,
        has_pump_service,
        product_type,
        has_empty_truck_charge
      )
    `)
    .eq('credit_status', 'pending');
  
  // Apply plant filtering if plantIds is provided
  if (plantIds && plantIds.length > 0) {
    query = query.in('plant_id', plantIds);
  } else if (plantIds && plantIds.length === 0) {
    // User has no access - return empty result by filtering on a non-existent condition
    query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
  }
  // If plantIds is null, user can access all plants (global admin), so no filter applied
  
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;

  if (error) throw error;

  // Filter out orders that already have remisiones (already delivered)
  // Credit validation doesn't make sense after delivery
  const filteredOrders = deliveredOrderIds.length > 0
    ? data?.filter((order: any) => !deliveredOrderIds.includes(order.id))
    : data;

  // Calculate concrete and pump volumes for each order
  const enrichedOrders = filteredOrders?.map(order => {
    const items = order.order_items || [];
    let concreteVolume = 0;
    let pumpVolume = 0;
    let hasPumpService = false;

    items.forEach((item: any) => {
      // Skip empty truck charges and pump service items for concrete volume calculation
      if (item.product_type !== 'VACÍO DE OLLA' &&
          item.product_type !== 'EMPTY_TRUCK_CHARGE' &&
          item.product_type !== 'SERVICIO DE BOMBEO' &&
          !item.has_empty_truck_charge) {
        concreteVolume += item.volume || 0;
      }

      // Calculate pump volume
      if (item.has_pump_service && item.pump_volume) {
        pumpVolume += item.pump_volume;
        hasPumpService = true;
      } else if (item.product_type === 'SERVICIO DE BOMBEO') {
        pumpVolume += item.volume || 0;
        hasPumpService = true;
      }
    });

    return {
      ...order,
      concreteVolume: concreteVolume > 0 ? concreteVolume : undefined,
      pumpVolume: pumpVolume > 0 ? pumpVolume : undefined,
      hasPumpService
    };
  });

  return enrichedOrders as unknown as OrderWithClient[];
}

export async function approveCreditForOrder(id: string) {
  try {
    const { data, error } = await supabase
      .rpc('approve_order_credit', {
        order_id: id
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error approving credit for order:', error);
    throw error;
  }
}

export async function rejectCreditForOrder(id: string, rejectionReason: string) {
  try {
    const { data, error } = await supabase
      .rpc('reject_order_credit', {
        order_id: id,
        p_rejection_reason: rejectionReason
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error rejecting credit for order:', error);
    throw error;
  }
}

export async function updateOrderStatus(id: string, status: string) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('orders')
    .update({ order_status: status })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateOrder(id: string, orderData: {
  delivery_date?: string;
  delivery_time?: string;
  requires_invoice?: boolean;
  special_requirements?: string | null;
  // Optional coordinates and maps URL
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_google_maps_url?: string | null;
  // Optionally update the linked quote
  quote_id?: string | null;
}) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update(orderData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateOrder:', error);
    throw error;
  }
}

export async function updateOrderItem(id: string, itemData: {
  volume?: number;
  pump_volume?: number | null;
  total_price?: number;
  recipe_id?: string;
  product_type?: string;
  unit_price?: number;
  quote_detail_id?: string | null;
}) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .update(itemData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateOrderItem:', error);
    throw error;
  }
}

// Normalize and update order items to master-level, merging per master and binding pricing as-of order.created_at
export async function updateOrderNormalized(
  orderId: string,
  orderUpdate: {
    delivery_date?: string;
    delivery_time?: string;
    requires_invoice?: boolean;
    special_requirements?: string | null;
    delivery_latitude?: number | null;
    delivery_longitude?: number | null;
    delivery_google_maps_url?: string | null;
    quote_id?: string | null;
  },
  editedProducts: Array<{
    id: string;
    volume: number;
    pump_volume?: number | null;
    recipe_id?: string | null;
  }>,
  opts?: { normalizeToMasters?: boolean; mergePerMaster?: boolean; strictMasterOnly?: boolean }
) {
  const { normalizeToMasters = true, mergePerMaster = true, strictMasterOnly = true } = opts || {};
  if (!normalizeToMasters) {
    // Fallback to legacy behavior: update order header only
    return updateOrder(orderId, orderUpdate);
  }

  // Load minimal order context
  const { data: orderRow, error: orderErr } = await supabase
    .from('orders')
    .select('id, client_id, construction_site, plant_id, created_at')
    .eq('id', orderId)
    .single();
  if (orderErr) throw orderErr;

  const clientId = orderRow.client_id as string;
  const site = orderRow.construction_site as string;
  const plantId = orderRow.plant_id as string | null;
  const createdAt = orderRow.created_at as string;
  if (!plantId) throw new Error('La orden no tiene planta asignada.');

  // Fetch current order items to get master_recipe_id context
  const { data: currentItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, recipe_id, master_recipe_id, product_type, quote_detail_id, unit_price')
    .eq('order_id', orderId);
  if (itemsErr) throw itemsErr;

  // Map current items for quick lookup by ID
  const currentItemMap: Record<string, any> = {};
  for (const item of (currentItems || []) as any[]) {
    currentItemMap[item.id] = item;
  }

  // Map edited recipe_ids to masters (only those that changed recipe_id)
  const recipeIds = Array.from(new Set(
    (editedProducts || [])
      .map(p => p.recipe_id)
      .filter((id): id is string => !!id)
  ));

  // Fetch recipes to get master mapping and master codes
  const { data: recipeRows, error: recipesErr } = await supabase
    .from('recipes')
    .select(`id, master_recipe_id, master_recipes:master_recipe_id(id, master_code)`) 
    .in('id', recipeIds.length > 0 ? recipeIds : ['00000000-0000-0000-0000-000000000000']);
  if (recipesErr) throw recipesErr;
  const recipeIdToMaster: Record<string, { masterId: string | null; masterCode: string | null }> = {};
  for (const r of (recipeRows || []) as any[]) {
    recipeIdToMaster[r.id] = {
      masterId: r.master_recipe_id || null,
      masterCode: r.master_recipes?.master_code || null
    };
  }

  // Build master groups, intelligently handling both new variant selections and existing master items
  type MasterAgg = {
    masterId: string;
    masterCode: string | null;
    volume: number;
    pumpVolume: number;
    needsPriceLookup: boolean;
    existingQuoteDetailId?: string | null;
    existingUnitPrice?: number | null;
  };
  const masterIdToAgg: Record<string, MasterAgg> = {};
  const missingMasters: string[] = [];
  const specialServiceItems: typeof editedProducts = []; // Preserve special items

  for (const p of editedProducts) {
    const currentItem = currentItemMap[p.id];
    if (!currentItem) {
      console.warn(`Current item ${p.id} not found in order; skipping`);
      continue;
    }

    // Preserve special service items as-is without processing for master recipes
    if (currentItem.product_type === 'VACÍO DE OLLA' || 
        currentItem.product_type === 'SERVICIO DE BOMBEO' ||
        currentItem.product_type === 'EMPTY_TRUCK_CHARGE') {
      console.log(`Preserving special service item ${p.id} (${currentItem.product_type})`);
      specialServiceItems.push(p);
      continue;
    }

    // Determine target master_recipe_id
    let masterId: string | null = null;
    let masterCode: string | null = null;
    let recipeChanged = false;

    // Log for debugging
    console.log(`Processing edited product ${p.id}:`, {
      pRecipeId: p.recipe_id,
      currentMasterId: currentItem.master_recipe_id,
      currentRecipeId: currentItem.recipe_id,
      currentProductType: currentItem.product_type
    });

    // Priority 1: If a new recipe_id was selected, resolve its master
    if (p.recipe_id) {
      // Check if the selected ID is a MASTER recipe first
      const { data: masterRow, error: masterErr } = await supabase
        .from('master_recipes')
        .select('id, master_code')
        .eq('id', p.recipe_id)
        .single();
      
      if (!masterErr && masterRow) {
        // It's a master recipe ID
        masterId = masterRow.id;
        masterCode = masterRow.master_code;
        console.log(`Selected ID is a master recipe, using directly:`, { masterId, masterCode });
      } else {
        // Otherwise, treat it as a variant recipe and look it up in the map
        const map = recipeIdToMaster[p.recipe_id];
        masterId = map?.masterId || null;
        masterCode = map?.masterCode || null;
        console.log(`Selected new recipe ${p.recipe_id}, resolved master:`, { masterId, masterCode });
      }
      if (currentItem.recipe_id && p.recipe_id !== currentItem.recipe_id) {
        recipeChanged = true;
      }
      if (currentItem.master_recipe_id && p.recipe_id !== currentItem.master_recipe_id) {
        recipeChanged = recipeChanged || !!masterId;
      }
    }
    // Priority 2: Fall back to the current item's master_recipe_id (for items already at master level)
    else if (currentItem.master_recipe_id) {
      masterId = currentItem.master_recipe_id;
      // Try to fetch the master_code if not already in map
      if (!masterCode) {
        const { data: masterRow, error: masterErr } = await supabase
          .from('master_recipes')
          .select('master_code')
          .eq('id', masterId)
          .single();
        if (!masterErr && masterRow) {
          masterCode = masterRow.master_code;
        }
      }
      console.log(`Using existing master from current item:`, { masterId, masterCode });
    }
    // Priority 3: Fall back to current recipe_id if it exists
    else if (currentItem.recipe_id) {
      const map = recipeIdToMaster[currentItem.recipe_id];
      masterId = map?.masterId || null;
      masterCode = map?.masterCode || null;
      console.log(`Using current recipe ${currentItem.recipe_id}, resolved master:`, { masterId, masterCode });
    }

    if (!masterId) {
      if (strictMasterOnly) {
        const failureInfo = `${p.recipe_id || currentItem.recipe_id || '(sin receta)'} [current: master=${currentItem.master_recipe_id}, recipe=${currentItem.recipe_id}]`;
        console.error(`Item ${p.id} has no master:`, failureInfo);
        missingMasters.push(failureInfo);
        continue;
      } else {
        // Skip items with no master if not strict
        continue;
      }
    }

    if (!masterIdToAgg[masterId]) {
      masterIdToAgg[masterId] = {
        masterId,
        masterCode,
        volume: 0,
        pumpVolume: 0,
        needsPriceLookup: false,
        existingQuoteDetailId: currentItem.quote_detail_id || null,
        existingUnitPrice: currentItem.unit_price || null,
      };
    }
    masterIdToAgg[masterId].volume += Number(p.volume || 0);
    masterIdToAgg[masterId].pumpVolume += Number(p.pump_volume || 0);
    if (recipeChanged || !currentItem.quote_detail_id) {
      masterIdToAgg[masterId].needsPriceLookup = true;
    }
    if (!masterIdToAgg[masterId].existingQuoteDetailId && currentItem.quote_detail_id) {
      masterIdToAgg[masterId].existingQuoteDetailId = currentItem.quote_detail_id;
    }
    if (!masterIdToAgg[masterId].existingUnitPrice && typeof currentItem.unit_price === 'number') {
      masterIdToAgg[masterId].existingUnitPrice = currentItem.unit_price;
    }
  }

  if (strictMasterOnly && missingMasters.length > 0) {
    throw new Error(
      `Los siguientes productos no tienen receta maestra asociada y no se pueden guardar: ${missingMasters.join(', ')}`
    );
  }

  const groups = Object.values(masterIdToAgg);
  if (mergePerMaster) {
    // Already aggregated by key
  }

  // Resolve pricing per master as of created_at
  const { resolveMasterPriceForAsOf } = await import('@/lib/services/productPriceResolver');
  const resolvedPerMaster: Record<string, { quoteId: string | null; quoteDetailId: string; unitPrice: number; priceSource: 'as_of'|'current'|'existing' }> = {};
  for (const g of groups) {
    if (g.needsPriceLookup || !g.existingQuoteDetailId) {
      const resolved = await resolveMasterPriceForAsOf({
        clientId,
        constructionSite: site,
        plantId,
        createdAt,
        masterRecipeId: g.masterId,
      });
      resolvedPerMaster[g.masterId] = resolved;
    } else {
      resolvedPerMaster[g.masterId] = {
        quoteId: (orderRow as any).quote_id || null,
        quoteDetailId: g.existingQuoteDetailId,
        unitPrice: g.existingUnitPrice || 0,
        priceSource: 'existing'
      };
    }
  }

  // Choose an order-level quote_id to set when a new linkage is resolved
  const firstResolved = groups
    .map(g => ({ masterId: g.masterId, ...resolvedPerMaster[g.masterId] }))
    .find(entry => entry.priceSource !== 'existing' && entry.quoteId && entry.quoteId !== (orderRow as any).quote_id);
  const newQuoteId = firstResolved?.quoteId || null;

  // Update order header (and set quote_id if provided by resolver)
  const orderHeaderUpdate = { ...orderUpdate } as any;
  if (newQuoteId) orderHeaderUpdate.quote_id = newQuoteId;
  await updateOrder(orderId, orderHeaderUpdate);

  // Delete only the edited concrete items (by id), excluding special service items
  const itemIdsToReplace = editedProducts
    .filter(p => {
      const item = currentItemMap[p.id];
      return item && 
             item.product_type !== 'VACÍO DE OLLA' && 
             item.product_type !== 'SERVICIO DE BOMBEO' &&
             item.product_type !== 'EMPTY_TRUCK_CHARGE';
    })
    .map(p => p.id)
    .filter(Boolean);
  
  if (itemIdsToReplace.length > 0) {
    const { error: delErr } = await supabase
      .from('order_items')
      .delete()
      .in('id', itemIdsToReplace);
    if (delErr) throw delErr;
  }

  // Insert one item per master
  const insertRows = groups.map(g => {
    const link = resolvedPerMaster[g.masterId];
    return {
      order_id: orderId,
      quote_detail_id: link.quoteDetailId,
      recipe_id: null,
      master_recipe_id: g.masterId,
      product_type: g.masterCode || 'CONCRETO',
      volume: g.volume,
      unit_price: link.unitPrice,
      total_price: link.unitPrice * g.volume,
      has_pump_service: false,
      pump_price: null,
      pump_volume: null,
    } as any;
  });

  if (insertRows.length > 0) {
    const { error: insErr } = await supabase
      .from('order_items')
      .insert(insertRows);
    if (insErr) throw insErr;
  }

  // Update any modified special service items (preserve them with updated volumes)
  for (const serviceItem of specialServiceItems) {
    if (serviceItem.volume !== currentItemMap[serviceItem.id]?.volume) {
      const { error: updateErr } = await supabase
        .from('order_items')
        .update({ volume: serviceItem.volume, total_price: serviceItem.volume * (currentItemMap[serviceItem.id]?.unit_price || 0) })
        .eq('id', serviceItem.id);
      if (updateErr) console.warn(`Error updating service item ${serviceItem.id}:`, updateErr);
    }
  }

  // Return minimal success response
  return { success: true };
}

export async function rejectCreditByValidator(id: string, rejectionReason: string) {
  try {
    const { data, error } = await supabase
      .rpc('reject_credit_by_validator', {
        order_id: id,
        p_rejection_reason: rejectionReason
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error en rejectCreditByValidator:', error);
    throw error;
  }
}

// Add function to get orders for manager validation
export async function getOrdersForManagerValidation(plantIds?: string[] | null) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients!inner(business_name, client_code),
        order_items(
          id,
          volume,
          pump_volume,
          has_pump_service,
          product_type,
          has_empty_truck_charge
        )
      `)
      .in('credit_status', ['pending', 'rejected_by_validator']);
    
    // Apply plant filtering if plantIds is provided
    if (plantIds && plantIds.length > 0) {
      query = query.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      // User has no access - return empty result by filtering on a non-existent condition
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
    }
    // If plantIds is null, user can access all plants (global admin), so no filter applied

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // Calculate concrete and pump volumes for each order
    const enrichedOrders = data?.map(order => {
      const items = order.order_items || [];
      let concreteVolume = 0;
      let pumpVolume = 0;
      let hasPumpService = false;

      // Only calculate volumes if there are items
      if (items.length > 0) {
        items.forEach((item: any) => {
          const productType = item.product_type || '';
          const volume = item.volume || 0;
          const pumpVolumeItem = item.pump_volume || 0;

          // Determine if this item is an empty truck charge
          const isEmptyTruckCharge = item.has_empty_truck_charge ||
                                    productType === 'VACÍO DE OLLA' ||
                                    productType === 'EMPTY_TRUCK_CHARGE';

          // Determine if this item is a pump service
          const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
                               productType.toLowerCase().includes('bombeo') ||
                               productType.toLowerCase().includes('pump');

          // Calculate concrete volume (exclude empty truck charges and pump services)
          if (!isEmptyTruckCharge && !isPumpService) {
            concreteVolume += volume;
          }

          // Calculate pump volume
          if (item.has_pump_service || isPumpService) {
            if (pumpVolumeItem > 0) {
              pumpVolume += pumpVolumeItem;
            } else if (isPumpService && volume > 0) {
              pumpVolume += volume;
            }
            hasPumpService = true;
          }
        });
      }

      return {
        ...order,
        concreteVolume: concreteVolume > 0 ? concreteVolume : undefined,
        pumpVolume: pumpVolume > 0 ? pumpVolume : undefined,
        hasPumpService
      };
    });

    return enrichedOrders as unknown as OrderWithClient[];
  } catch (error) {
    console.error('Error fetching orders for manager validation:', error);
    throw error;
  }
}

// Add function to get rejected orders
export async function getRejectedOrders(plantIds?: string[] | null) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients!inner(business_name, client_code),
        order_items(
          id,
          volume,
          pump_volume,
          has_pump_service,
          product_type,
          has_empty_truck_charge
        )
      `)
      .in('credit_status', ['rejected', 'rejected_by_validator']);
    
    // Apply plant filtering if plantIds is provided
    if (plantIds && plantIds.length > 0) {
      query = query.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      // User has no access - return empty result by filtering on a non-existent condition
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
    }
    // If plantIds is null, user can access all plants (global admin), so no filter applied
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;

    if (error) throw error;

    // Calculate concrete and pump volumes for each order
    const enrichedOrders = data?.map(order => {
      const items = order.order_items || [];
      let concreteVolume = 0;
      let pumpVolume = 0;
      let hasPumpService = false;

      // Only calculate volumes if there are items
      if (items.length > 0) {
        items.forEach((item: any) => {
          const productType = item.product_type || '';
          const volume = item.volume || 0;
          const pumpVolumeItem = item.pump_volume || 0;

          // Determine if this item is an empty truck charge
          const isEmptyTruckCharge = item.has_empty_truck_charge ||
                                    productType === 'VACÍO DE OLLA' ||
                                    productType === 'EMPTY_TRUCK_CHARGE';

          // Determine if this item is a pump service
          const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
                               productType.toLowerCase().includes('bombeo') ||
                               productType.toLowerCase().includes('pump');

          // Calculate concrete volume (exclude empty truck charges and pump services)
          if (!isEmptyTruckCharge && !isPumpService) {
            concreteVolume += volume;
          }

          // Calculate pump volume
          if (item.has_pump_service || isPumpService) {
            if (pumpVolumeItem > 0) {
              pumpVolume += pumpVolumeItem;
            } else if (isPumpService && volume > 0) {
              pumpVolume += volume;
            }
            hasPumpService = true;
          }
        });
      }

      return {
        ...order,
        concreteVolume: concreteVolume > 0 ? concreteVolume : undefined,
        pumpVolume: pumpVolume > 0 ? pumpVolume : undefined,
        hasPumpService
      };
    });

    return enrichedOrders as unknown as OrderWithClient[];
  } catch (error) {
    console.error('Error fetching rejected orders:', error);
    throw error;
  }
}

// Add function to check if user can approve an order
export async function canUserApproveOrder(orderId: string) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    
    if (!userId) return false;
    
    // Obtener el rol del usuario y el estado de la orden
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();
      
    const { data: order } = await supabase
      .from('orders')
      .select('credit_status')
      .eq('id', orderId)
      .single();
      
    if (!userProfile || !order) return false;
    
    // CREDIT_VALIDATOR solo puede aprobar si está pendiente
    if (userProfile.role === 'CREDIT_VALIDATOR' && order.credit_status === 'pending') {
      return true;
    }
    
    // EXECUTIVE/PLANT_MANAGER pueden aprobar si fue rechazado por el validador o está pendiente
    if (['EXECUTIVE', 'PLANT_MANAGER'].includes(userProfile.role) && 
        (order.credit_status === 'rejected_by_validator' || order.credit_status === 'pending')) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

export async function cancelOrder(orderId: string) {
  try {
    // Update order status to cancelled
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        order_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    throw error;
  }
}

export async function getOrdersForDosificador() {
  // Fetch orders relevant for DOSIFICADOR role (read-only access)
  try {
    // First, get the current user's profile to check their plant assignment
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('plant_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profileError) throw profileError;

    let query = supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        delivery_date, 
        delivery_time,
        construction_site,
        total_amount,
        order_status,
        credit_status,
        plant_id,
        clients!inner(id, business_name, client_code)
      `)
      // Use only active status orders
      .in('order_status', ['CREATED', 'VALIDATED', 'SCHEDULED']);

    // Filter by the user's assigned plant if they have one
    if (profile?.plant_id) {
      query = query.eq('plant_id', profile.plant_id);
    }

    const { data, error } = await query.order('delivery_date', { ascending: true });
    
    if (error) throw error;
    return data as unknown as OrderWithClient[];
  } catch (err) {
    return []; // Return empty array instead of throwing to prevent page crash
  }
}

/**
 * Permanently deletes an order from the database
 * This is restricted to executive users only at the UI level
 */
export async function deleteOrder(orderId: string) {
  try {
    // Check if the order has remisiones
    const { data: remisiones, error: remisionesError } = await supabase
      .from('remisiones')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);
    
    if (remisionesError) throw remisionesError;
    
    if (remisiones && remisiones.length > 0) {
      throw new Error('No se puede eliminar la orden porque tiene remisiones asociadas');
    }
    
    // Delete order items first
    const { error: orderItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
    
    if (orderItemsError) throw orderItemsError;
    
    // Then delete the order
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);
    
    if (orderError) throw orderError;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
}

// New function to recalculate an order's final amount
export async function recalculateOrderAmount(orderId: string) {
  try {
    // First, check if there are any remisiones for this order
    const { data: remisiones, error: remisionesError } = await supabase
      .from('remisiones')
      .select('id, volumen_fabricado, tipo_remision, recipe_id, master_recipe_id, remision_number')
      .eq('order_id', orderId);
    
    if (remisionesError) throw remisionesError;
    
    // Get order details to know if it requires invoice and plant_id
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('requires_invoice, client_id, construction_site, plant_id')
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
    // Get plant VAT rate
    let vatRate = 0.16; // Default fallback
    if (orderData.plant_id) {
      const { data: plantData, error: plantError } = await supabase
        .from('plants')
        .select(`
          id,
          business_unit:business_unit_id(
            id,
            vat_rate
          )
        `)
        .eq('id', orderData.plant_id)
        .single();
      
      if (!plantError && plantData?.business_unit?.vat_rate) {
        vatRate = plantData.business_unit.vat_rate;
      }
    }
    
    // Get all order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    
    if (itemsError) throw itemsError;
    
    // Step 1: Reset all concrete_volume_delivered and pump_volume_delivered to 0
    await supabase
      .from('order_items')
      .update({ 
        concrete_volume_delivered: 0, 
        pump_volume_delivered: 0 
      })
      .eq('order_id', orderId);
    
    // Step 2: Update delivered volumes based on remisiones
    if (remisiones && remisiones.length > 0) {
      // Match concrete remisiones to specific order items by recipe/master_recipe
      const concreteRemisiones = remisiones.filter(r => r.tipo_remision === 'CONCRETO');
      
      // Get concrete items (exclude additional products, pump service, and empty trucks)
      const concreteItems = orderItems?.filter(item => 
        item.product_type !== 'SERVICIO DE BOMBEO' && 
        item.product_type !== 'VACÍO DE OLLA' &&
        !item.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
        !item.has_empty_truck_charge
      ) || [];
      
      // Track delivered volume per order item
      const deliveredVolumeByItem = new Map<string, number>();
      
      // Match each remision to its corresponding order item
      for (const remision of concreteRemisiones) {
        const volumeFabricado = remision.volumen_fabricado || 0;
        
        // Try to match by master_recipe_id first (most common)
        let matchedItem = concreteItems.find(item => 
          remision.master_recipe_id && item.master_recipe_id === remision.master_recipe_id
        );
        
        // If no master match, try recipe_id as fallback
        if (!matchedItem && remision.recipe_id) {
          matchedItem = concreteItems.find(item => 
            item.recipe_id === remision.recipe_id
          );
        }
        
        if (matchedItem) {
          // Accumulate delivered volume for this order item
          const currentDelivered = deliveredVolumeByItem.get(matchedItem.id) || 0;
          deliveredVolumeByItem.set(matchedItem.id, currentDelivered + volumeFabricado);
          console.log(`Matched CONCRETO remision ${remision.remision_number} (${volumeFabricado}m³) to order item ${matchedItem.product_type}`);
        } else {
          // Only warn if remision has recipe/master info but couldn't match
          if (remision.recipe_id || remision.master_recipe_id) {
            console.warn(`Could not match CONCRETO remision ${remision.remision_number} (recipe: ${remision.recipe_id}, master: ${remision.master_recipe_id}) to any order item`);
          }
        }
      }
      
      // Update each matched order item with its delivered volume
      for (const [itemId, deliveredVolume] of deliveredVolumeByItem.entries()) {
        await supabase
          .from('order_items')
          .update({ concrete_volume_delivered: deliveredVolume })
          .eq('id', itemId);
        console.log(`Updated order item ${itemId} with delivered volume: ${deliveredVolume}m³`);
      }
      
      // Handle pump volume delivered - both from remisiones and global pump service
      const pumpRemisiones = remisiones.filter(r => r.tipo_remision === 'BOMBEO');
      const totalPumpDelivered = pumpRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
    
      // Find pump service items (both legacy and global)
      const pumpItems = orderItems?.filter(item => item.has_pump_service) || [];
      
      // Handle global pump service items
      const globalPumpItems = pumpItems.filter(item => 
        item.product_type === 'SERVICIO DE BOMBEO' || item.quote_detail_id === null
      );
      
      // Handle regular pump service items  
      const regularPumpItems = pumpItems.filter(item => 
        item.product_type !== 'SERVICIO DE BOMBEO' && item.quote_detail_id !== null
      );
      
      // For global pump service, set pump_volume_delivered to actual delivered volume from BOMBEO remisiones
      for (const globalItem of globalPumpItems) {
        if (globalItem.volume > 0) {
          await supabase
            .from('order_items')
            .update({ pump_volume_delivered: totalPumpDelivered })
            .eq('id', globalItem.id);
        }
      }
      
      // For regular pump items, distribute the remision pump volume
      if (regularPumpItems.length > 0 && totalPumpDelivered > 0) {
        const totalPumpOrdered = regularPumpItems.reduce((sum, item) => sum + (item.pump_volume || 0), 0);
        const pumpDeliveryRatio = totalPumpOrdered > 0 ? totalPumpDelivered / totalPumpOrdered : 0;
        
        for (const item of regularPumpItems) {
          const deliveredPumpVolume = (item.pump_volume || 0) * pumpDeliveryRatio;
          await supabase
            .from('order_items')
            .update({ pump_volume_delivered: deliveredPumpVolume })
            .eq('id', item.id);
        }
      }
    } else {
      // If no remisiones, but there's a global pump service, delivered volume should be 0
      const globalPumpItems = orderItems?.filter(item => 
        item.product_type === 'SERVICIO DE BOMBEO' && item.volume > 0
      ) || [];
      
      for (const globalItem of globalPumpItems) {
        await supabase
          .from('order_items')
          .update({ pump_volume_delivered: 0 })
          .eq('id', globalItem.id);
      }
    }
    
    // Step 3: Calculate the final amount manually since we understand the logic better
    const { data: updatedItems, error: updatedItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    
    if (updatedItemsError) throw updatedItemsError;
    
    // Calculate concrete amount (excluding empty truck charges and additional products)
    const concreteAmount = updatedItems
      ?.filter(item => 
        item.product_type !== 'VACÍO DE OLLA' && 
        item.product_type !== 'SERVICIO DE BOMBEO' &&
        !item.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
        !item.has_empty_truck_charge
      )
      .reduce((sum, item) => sum + ((item.unit_price || 0) * (item.concrete_volume_delivered || 0)), 0) || 0;
    
    // Calculate pump amount - avoid double charging when there's a global pump service
    const hasGlobalPumpService = updatedItems?.some(item => item.product_type === 'SERVICIO DE BOMBEO') || false;
    
    const pumpAmount = hasGlobalPumpService
      ? // If there's a global pump service, only charge from that item
        updatedItems
          ?.filter(item => item.product_type === 'SERVICIO DE BOMBEO' && (item.pump_volume_delivered || 0) > 0)
          .reduce((sum, item) => sum + ((item.pump_price || 0) * (item.pump_volume_delivered || 0)), 0) || 0
      : // Otherwise, charge from individual items with pump service
        updatedItems
          ?.filter(item => item.has_pump_service && (item.pump_volume_delivered || 0) > 0)
          .reduce((sum, item) => sum + ((item.pump_price || 0) * (item.pump_volume_delivered || 0)), 0) || 0;
    
    // Calculate empty truck amount
    // Business rule: Only include vacío de olla if there is at least one remisión
    const hasAnyRemisiones = Array.isArray(remisiones) && remisiones.length > 0;
    const emptyTruckAmount = hasAnyRemisiones
      ? (updatedItems
          ?.filter(item => 
            item.product_type === 'VACÍO DE OLLA' || 
            item.has_empty_truck_charge
          )
          .reduce((sum, item) => sum + ((item.empty_truck_price || 0) * (item.empty_truck_volume || 0)), 0) || 0)
      : 0;
    
    // Calculate additional products amount
    // Additional products are now stored as order_items with product_type starting with "PRODUCTO ADICIONAL:"
    // Get total delivered concrete volume (excluding additional products themselves)
    const totalConcreteDelivered = updatedItems
      ?.filter(item => 
        item.product_type !== 'VACÍO DE OLLA' && 
        item.product_type !== 'SERVICIO DE BOMBEO' &&
        !item.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
        !item.has_empty_truck_charge
      )
      .reduce((sum, item) => sum + (item.concrete_volume_delivered || 0), 0) || 0;
    
    // Calculate additional products amount: volume (multiplier per m³) × delivered volume × unit_price
    const additionalAmount = updatedItems
      ?.filter(item => item.product_type?.startsWith('PRODUCTO ADICIONAL:'))
      .reduce((sum, item) => {
        const multiplier = item.volume || 0; // This is the quantity per m³
        const unitPrice = item.unit_price || 0;
        // Multiply multiplier (rate per m³) by delivered concrete volume and unit price
        return sum + (multiplier * totalConcreteDelivered * unitPrice);
      }, 0) || 0;
    
    // Calculate total final amount with plant-specific VAT rate
    const finalAmount = concreteAmount + pumpAmount + emptyTruckAmount + additionalAmount;
    const invoiceAmount = orderData.requires_invoice ? finalAmount * (1 + vatRate) : finalAmount;
    
    // Update the order with new amounts
    const { error: updateOrderError } = await supabase
      .from('orders')
        .update({ 
        final_amount: finalAmount,
        invoice_amount: invoiceAmount,
          updated_at: new Date().toISOString() 
        })
      .eq('id', orderId);
      
    if (updateOrderError) throw updateOrderError;
    
    // Update client balance
    const { error: balanceError } = await supabase.rpc('update_client_balance', {
      p_client_id: orderData.client_id,
      p_site_name: orderData.construction_site
    });
    
    if (balanceError) throw balanceError;
    
    const vatPercentage = (vatRate * 100).toFixed(1);
    return { 
      success: true, 
      message: `Monto final recalculado: $${finalAmount.toFixed(2)}${orderData.requires_invoice ? ` (con IVA ${vatPercentage}%: $${invoiceAmount.toFixed(2)})` : ''}` 
    };
    
  } catch (error) {
    console.error('Error in recalculateOrderAmount:', error);
    throw error;
  }
}

const orderService = {
  createOrder,
  getOrders,
  getOrderById,
  getOrdersForCreditValidation,
  approveCreditForOrder,
  rejectCreditForOrder,
  updateOrderStatus,
  updateOrder,
  updateOrderItem,
  updateOrderNormalized,
  rejectCreditByValidator,
  getOrdersForManagerValidation,
  getRejectedOrders,
  canUserApproveOrder,
  cancelOrder,
  getOrdersForDosificador,
  deleteOrder,
  recalculateOrderAmount
};

export default orderService; 