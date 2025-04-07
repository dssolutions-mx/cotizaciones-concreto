// Remove createClientComponentClient import since we use the singleton client
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Order, 
  OrderWithClient, 
  OrderWithDetails, 
  OrderItem, 
  EmptyTruckDetails 
} from '@/types/orders';
// Import the singleton Supabase client
import { supabase } from '@/lib/supabase';

export interface OrderCreationParams {
  quote_id: string;
  client_id: string;
  construction_site: string;
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
      const orderItems = orderData.order_items.map(item => {
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

export async function getOrders(filterStatus?: string, maxItems?: number, dateRange?: { startDate?: string, endDate?: string }) {
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
  return data as unknown as OrderWithClient[];
}

export async function getOrderById(id: string) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      clients:clients(business_name, client_code, email, phone),
      products:order_items(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
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
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      credit_status: 'approved',
      order_status: 'validated'
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function rejectCreditForOrder(id: string, rejectionReason: string) {
  // Use singleton supabase client
  // const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .rpc('reject_order_credit', {
      order_id: id,
      rejection_reason: rejectionReason
    });
  
  if (error) throw error;
  return data;
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

const orderService = {
  createOrder,
  getOrders,
  getOrderById,
  getOrdersForCreditValidation,
  approveCreditForOrder,
  rejectCreditForOrder,
  updateOrderStatus,
  updateOrder,
  updateOrderItem
};

export default orderService; 