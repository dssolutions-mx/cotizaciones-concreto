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
  order_items?: Array<{
    quote_detail_id: string;
    volume: number;
    pump_volume?: number | null;
  }>;
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

    // Start a transaction
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
      console.log('Adding plant_id to orderInsertData:', plantId);
    } else {
      console.log('No plant_id found - this will cause issues for executives');
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
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderInsertData)
      .select('id')
      .single();
    
    if (orderError) throw orderError;
    
    // If order_items are provided, insert them
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
          recipes:recipe_id (
            recipe_code
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
          recipes: quoteDetail?.recipes
        });
        
        // Determine product type based on quote detail type
        let productType = 'Unknown';
        if (quoteDetail?.pump_service && quoteDetail?.product_id) {
          // This is a standalone pumping service
          productType = 'SERVICIO DE BOMBEO';
          console.log('Identified as standalone pumping service');
        } else if (quoteDetail?.recipes) {
          // This is a concrete product
          productType = typeof quoteDetail.recipes === 'object' ? 
            (quoteDetail.recipes as any).recipe_code : 'Unknown';
          console.log('Identified as concrete product:', productType);
        } else {
          console.log('Could not determine product type, using Unknown');
        }
        
        // No longer include pump_volume field for individual items (legacy approach removed)
        return {
          order_id: order.id,
          quote_detail_id: item.quote_detail_id,
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
          pump_volume_delivered: pumpServiceData.volume, // Add for automatic recalculation
          has_empty_truck_charge: false
        });
      
      if (pumpServiceError) throw pumpServiceError;
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
      clients!inner(business_name, client_code, email, phone),
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

  // Calculate concrete and pump volumes for each order
  const enrichedOrders = data?.map(order => {
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
      .select('id, volumen_fabricado, tipo_remision')
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
      // Calculate concrete volume delivered
      const concreteRemisiones = remisiones.filter(r => r.tipo_remision === 'CONCRETO');
      const totalConcreteDelivered = concreteRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
      
      // Update concrete items with proportional delivery
      const concreteItems = orderItems?.filter(item => 
        item.product_type !== 'SERVICIO DE BOMBEO' && 
        item.product_type !== 'VACÍO DE OLLA' &&
        !item.has_empty_truck_charge
      ) || [];
      
      if (concreteItems.length > 0 && totalConcreteDelivered > 0) {
        const totalConcreteOrdered = concreteItems.reduce((sum, item) => sum + (item.volume || 0), 0);
        const deliveryRatio = totalConcreteOrdered > 0 ? totalConcreteDelivered / totalConcreteOrdered : 0;
        
        for (const item of concreteItems) {
          const deliveredVolume = (item.volume || 0) * deliveryRatio;
          await supabase
            .from('order_items')
            .update({ concrete_volume_delivered: deliveredVolume })
            .eq('id', item.id);
        }
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
    
    // Calculate concrete amount (excluding empty truck charges)
    const concreteAmount = updatedItems
      ?.filter(item => 
        item.product_type !== 'VACÍO DE OLLA' && 
        item.product_type !== 'SERVICIO DE BOMBEO' &&
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
    const emptyTruckAmount = updatedItems
      ?.filter(item => 
        item.product_type === 'VACÍO DE OLLA' || 
        item.has_empty_truck_charge
      )
      .reduce((sum, item) => sum + ((item.empty_truck_price || 0) * (item.empty_truck_volume || 0)), 0) || 0;
    
    // Calculate additional products amount
    const { data: additionalProducts, error: additionalError } = await supabase
      .from('remision_productos_adicionales')
      .select('cantidad, precio_unitario')
      .in('remision_id', (remisiones || []).map(r => r.id));
    
    if (additionalError) throw additionalError;
    
    const additionalAmount = additionalProducts?.reduce((sum, product) => 
      sum + ((product.cantidad || 0) * (product.precio_unitario || 0)), 0) || 0;
    
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