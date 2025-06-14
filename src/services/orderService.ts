// Remove createClientComponentClient import since we use the singleton client
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  // Removed unused Order
  OrderWithClient, 
  OrderWithDetails, 
  // Removed unused OrderItem
  EmptyTruckDetails 
} from '@/types/orders';
// Import the singleton Supabase client
import { supabase } from '@/lib/supabase';

export interface OrderCreationParams {
  quote_id: string;
  client_id: string;
  construction_site: string;
  construction_site_id?: string;
  delivery_date: string;
  delivery_time: string;
  requires_invoice: boolean;
  special_requirements: string | null;
  total_amount: number;
  order_status: string;
  credit_status: string;
  order_items?: Array<{
    quote_detail_id: string;
    volume: number;
    pump_volume?: number | null;
  }>;
}

export async function createOrder(orderData: OrderCreationParams, emptyTruckData?: EmptyTruckDetails | null) {
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
        console.log('Using authenticated user:', userId);
      } else {
        // Instead of using 'system' string which is not a valid UUID,
        // set to NULL and let the database handle the constraint
        console.warn('No active session found, using null for created_by');
      }
    } catch (authError) {
      console.warn('Could not get auth session, using null for created_by:', authError);
    }
    
    // Check if we have a valid user ID
    if (!userId) {
      throw new Error('Usuario no autenticado. Debe iniciar sesión para crear órdenes.');
    }
    
    // Start a transaction
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
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
      })
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
          recipes:recipe_id (
            recipe_code
          )
        `)
        .in('id', orderData.order_items.map(item => item.quote_detail_id));
      
      if (quoteDetailsError) throw quoteDetailsError;
      
      // Insert order items
      const orderItems = orderData.order_items.map((item: any) => {
        const quoteDetail = quoteDetails.find(qd => qd.id === item.quote_detail_id);
        // Use optional chaining and provide a fallback for recipe_code
        const recipeCode = quoteDetail?.recipes ? 
          (typeof quoteDetail.recipes === 'object' ? 
            (quoteDetail.recipes as any).recipe_code : 'Unknown') 
          : 'Unknown';
        
        // Now include pump_volume field since it exists in the database
        return {
          order_id: order.id,
          quote_detail_id: item.quote_detail_id,
          product_type: recipeCode,
          volume: item.volume,
          unit_price: quoteDetail?.final_price || 0,
          total_price: (quoteDetail?.final_price || 0) * item.volume,
          has_pump_service: quoteDetail?.pump_service || false,
          pump_price: quoteDetail?.pump_service ? quoteDetail?.pump_price : null,
          pump_volume: item.pump_volume // Now we can include this field
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

export async function getOrders(filterStatus?: string, maxItems?: number, dateRange?: { startDate?: string, endDate?: string }, creditStatusFilter?: string) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  let query = supabase
    .from('orders')
    .select(`
      *,
      clients:clients(business_name, client_code)
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
  
  if (error) throw error;
  
  // Filtrar manualmente los pedidos rechazados
  let filteredData = data;
  if (!filterStatus) {
    filteredData = data.filter(order => 
      order.credit_status !== 'rejected' && 
      order.credit_status !== 'rejected_by_validator'
    );
  }
  
  return filteredData as unknown as OrderWithClient[];
}

export async function getOrderById(id: string) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      clients:clients(business_name, client_code, email, phone),
      products:order_items(*, quote_details(recipe_id)) 
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  
  // Transform data to match the OrderWithDetails type and structure products
  if (data) {
    // Rename clients to client for consistency with OrderWithDetails
    const { clients, products, ...orderData } = data;
    
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
      products: structuredProducts // Use the transformed products
    } as unknown as OrderWithDetails;
  }
  
  return data as unknown as OrderWithDetails;
}

export async function getOrdersForCreditValidation() {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      clients:clients(business_name, client_code)
    `)
    .eq('credit_status', 'pending')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as unknown as OrderWithClient[];
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
export async function getOrdersForManagerValidation() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients:clients(business_name, client_code)
      `)
      .in('credit_status', ['pending', 'rejected_by_validator'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as unknown as OrderWithClient[];
  } catch (error) {
    console.error('Error fetching orders for manager validation:', error);
    throw error;
  }
}

// Add function to get rejected orders
export async function getRejectedOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients:clients(business_name, client_code)
      `)
      .in('credit_status', ['rejected', 'rejected_by_validator'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as unknown as OrderWithClient[];
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
    const { data, error } = await supabase
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
        clients:clients(id, business_name, client_code)
      `)
      // Use only active status orders
      .in('order_status', ['CREATED', 'VALIDATED', 'SCHEDULED']) 
      .order('delivery_date', { ascending: true });
    
    if (error) throw error;
    return data as unknown as OrderWithClient[];
  } catch (err) {
    console.error('Error fetching orders for dosificador:', err);
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
    
    // Get order details to know if it requires invoice
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('requires_invoice, client_id, construction_site')
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
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
    
    // Calculate total final amount
    const finalAmount = concreteAmount + pumpAmount + emptyTruckAmount + additionalAmount;
    const invoiceAmount = orderData.requires_invoice ? finalAmount * 1.16 : finalAmount;
    
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
    
    return { 
      success: true, 
      message: `Monto final recalculado: $${finalAmount.toFixed(2)}${orderData.requires_invoice ? ` (con IVA: $${invoiceAmount.toFixed(2)})` : ''}` 
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