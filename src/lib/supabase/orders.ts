import { supabase as browserClient } from './client';
import { handleError } from '@/utils/errorHandler';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  OrderWithClient,
  // Removed unused OrderItem, Order, OrderWithDetails
} from '@/types/orders';

/**
 * Service for managing order-related operations
 */
export const orderService = {
  /**
   * Creates an order from a quote
   * @param quoteId - ID of the quote
   * @param deliveryDate - Date of delivery
   * @param deliveryTime - Time of delivery
   * @param requiresInvoice - Whether invoice is required
   * @param specialRequirements - Any special requirements
   * @param emptyTruckDetails - Optional empty truck charge details
   * @param client - Optional Supabase client instance (server or browser)
   */
  async createOrder(
    quoteId: string, 
    deliveryDate: string, 
    deliveryTime: string, 
    requiresInvoice: boolean, 
    specialRequirements?: string,
    emptyTruckDetails?: {
      hasEmptyTruckCharge: boolean,
      emptyTruckVolume: number,
      emptyTruckPrice: number
    },
    client?: SupabaseClient<Database>
  ) {
    const supabase = client || browserClient;
    try {
      let response;
      
      // If empty truck details are provided, use the create_order_with_details function
      if (emptyTruckDetails?.hasEmptyTruckCharge) {
        const { data, error } = await supabase
          .rpc('create_order_with_details', {
            quote_id: quoteId,
            delivery_date: deliveryDate,
            delivery_time: deliveryTime,
            requires_invoice: requiresInvoice,
            special_requirements: specialRequirements || null,
            empty_truck_volume: emptyTruckDetails.emptyTruckVolume,
            has_empty_truck_charge: emptyTruckDetails.hasEmptyTruckCharge,
            empty_truck_price: emptyTruckDetails.emptyTruckPrice
          });
          
        if (error) throw error;
        response = data;
      } else {
        // Otherwise, use the basic create_order_from_quote function
        const { data, error } = await supabase
          .rpc('create_order_from_quote', {
            quote_id: quoteId,
            delivery_date: deliveryDate,
            delivery_time: deliveryTime,
            requires_invoice: requiresInvoice,
            special_requirements: specialRequirements || null
          });
          
        if (error) throw error;
        response = data;
      }
      
      return { data: response, error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'createOrder');
      console.error(errorMessage);
      return { data: null, error: errorMessage };
    }
  },

  /**
   * Gets all orders with basic filtering
   * @param filters - Optional filters for status, etc.
   * @param client - Optional Supabase client instance (server or browser)
   */
  async getOrders(filters?: { 
    creditStatus?: string, 
    orderStatus?: string, 
    clientId?: string, 
    startDate?: string, 
    endDate?: string, 
    limit?: number 
  }, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      console.log('getOrders called with filters:', filters);
      
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          quote_id,
          requires_invoice,
          delivery_date,
          delivery_time,
          construction_site,
          special_requirements,
          preliminary_amount,
          final_amount,
          credit_status,
          order_status,
          created_at,
          clients (
            id,
            business_name,
            contact_name,
            phone
          )
        `);
      
      // Apply filters if provided
      if (filters?.creditStatus) {
        console.log(`Applying credit_status filter: ${filters.creditStatus}`);
        query = query.eq('credit_status', filters.creditStatus);
      }
      
      if (filters?.orderStatus) {
        console.log(`Applying order_status filter: ${filters.orderStatus}`);
        query = query.eq('order_status', filters.orderStatus);
      }
      
      if (filters?.clientId) {
        console.log(`Applying client_id filter: ${filters.clientId}`);
        query = query.eq('client_id', filters.clientId);
      }
      
      if (filters?.startDate) {
        console.log(`Applying start date filter: ${filters.startDate}`);
        query = query.gte('delivery_date', filters.startDate);
      }
      
      if (filters?.endDate) {
        console.log(`Applying end date filter: ${filters.endDate}`);
        query = query.lte('delivery_date', filters.endDate);
      }
      
      // Apply limit if provided
      if (filters?.limit) {
        console.log(`Applying limit: ${filters.limit}`);
        query = query.limit(filters.limit);
      }
      
      // Sort by created_at in descending order
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error in getOrders:', error);
        throw error;
      }
      
      console.log(`getOrders found ${data?.length || 0} records`);
      return { data: data || [], error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'getOrders');
      console.error(errorMessage);
      return { data: [], error: errorMessage };
    }
  },

  /**
   * Gets an order by ID with all details including items
   * @param orderId - ID of the order
   * @param client - Optional Supabase client instance (server or browser)
   */
  async getOrderById(orderId: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      // Get the order with all details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          quote_id,
          requires_invoice,
          delivery_date,
          delivery_time,
          construction_site,
          special_requirements,
          total_amount,
          preliminary_amount,
          final_amount,
          credit_status,
          credit_validated_by,
          credit_validation_date,
          order_status,
          created_at,
          updated_at,
          clients (
            id,
            business_name,
            client_code,
            rfc,
            requires_invoice,
            address,
            contact_name,
            email,
            phone,
            credit_status
          ),
          created_by
        `)
        .eq('id', orderId)
        .single();
      
      if (orderError) throw orderError;
      
      // Get the order items
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (itemsError) throw itemsError;
      
      return { 
        data: { ...order, items: items || [] }, 
        error: null 
      };
    } catch (error) {
      const errorMessage = handleError(error, 'getOrderById');
      console.error(errorMessage);
      return { data: null, error: errorMessage };
    }
  },

  /**
   * Approves credit for an order
   * @param orderId - ID of the order
   * @param client - Optional Supabase client instance (server or browser)
   */
  async approveCreditForOrder(orderId: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .rpc('approve_order_credit', {
          order_id: orderId
        });
      
      if (error) throw error;
      return { success: data, error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'approveCreditForOrder');
      console.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Rejects credit for an order
   * @param orderId - ID of the order
   * @param rejectionReason - Reason for rejection
   * @param client - Optional Supabase client instance (server or browser)
   */
  async rejectCreditForOrder(orderId: string, rejectionReason: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .rpc('reject_order_credit', {
          order_id: orderId,
          rejection_reason: rejectionReason
        });
      
      if (error) throw error;
      return { success: data, error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'rejectCreditForOrder');
      console.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Gets all orders pending credit validation
   * @param client - Optional Supabase client instance (server or browser)
   */
  async getOrdersPendingCreditValidation(client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          requires_invoice,
          delivery_date,
          delivery_time,
          total_amount,
          credit_status,
          created_at,
          clients (
            id,
            business_name,
            contact_name,
            phone,
            credit_status
          )
        `)
        .eq('credit_status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'getOrdersPendingCreditValidation');
      console.error(errorMessage);
      return { data: [], error: errorMessage };
    }
  },

  /**
   * Gets all scheduled orders for a specific date
   * @param date - Optional date to filter orders (defaults to today)
   * @param client - Optional Supabase client instance (server or browser)
   */
  async getScheduledOrders(date?: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          delivery_date,
          delivery_time,
          construction_site,
          special_requirements,
          total_amount,
          credit_status,
          order_status,
          clients (
            id,
            business_name,
            contact_name,
            phone
          )
        `)
        .eq('delivery_date', targetDate)
        .not('order_status', 'eq', 'CANCELLED')
        .order('delivery_time', { ascending: true });
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'getScheduledOrders');
      console.error(errorMessage);
      return { data: [], error: errorMessage };
    }
  }
};

// Define the type for an order item - Assuming basic structure
interface OrderItemBasic {
  id: string;
  product_type: string;
  volume: number;
  unit_price: number;
  total_price: number;
  has_pump_service?: boolean;
  pump_price?: number | null;
  pump_volume?: number | null;
}

// Define a simplified Order type for the context of this file
interface OrderBasic {
  id: string;
  order_number: string;
  delivery_date: string;
  delivery_time: string;
  client_id: string;
  order_status: string;
  total_amount?: number;
}

// Simplified OrderWithDetails
interface OrderWithDetailsBasic extends OrderBasic {
  clients: { business_name: string; client_code: string };
  order_items: OrderItemBasic[];
}

export async function getOrdersForDosificador() {
  // Fetch orders relevant for DOSIFICADOR role (read-only access)
  try {
    const { data, error } = await browserClient
      .from('orders')
      .select(`
        id, 
        order_number, 
        delivery_date, 
        delivery_time,
        order_status,
        clients:clients(business_name)
      `)
      // Add any specific filters for Dosificador if needed, e.g., status
      .in('order_status', ['scheduled', 'validated']) // Example: Show only scheduled or validated
      .order('delivery_date', { ascending: true });
    
    if (error) throw error;
    return data as unknown as OrderWithClient[]; // Return type remains the same
  } catch (err) {
    console.error('Error fetching orders for dosificador:', err);
    throw new Error('Error al obtener los pedidos.');
  }
}

export async function getOrderDetailsForDosificador(orderId: string) {
  // Fetch specific order details for DOSIFICADOR role
  try {
    const { data, error } = await browserClient
      .from('orders')
      .select(`
        id, 
        order_number, 
        delivery_date, 
        delivery_time, 
        order_status, 
        clients:clients(business_name, client_code),
        order_items(*)
      `)
      .eq('id', orderId)
      .single();
      
    if (error) throw error;
    return data as unknown as OrderWithDetailsBasic; // Use simplified type
  } catch (err) {
    console.error('Error fetching order details for dosificador:', err);
    throw new Error('Error al obtener los detalles del pedido.');
  }
}

// Debugging function to list all orders with their credit status
export async function debugGetAllOrdersWithCreditStatus() {
  try {
    const { data, error } = await browserClient
      .from('orders')
      .select('id, order_number, credit_status')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    console.log('All orders with credit status:', data);
    return data;
  } catch (err) {
    console.error('Error fetching all orders:', err);
    return [];
  }
} 