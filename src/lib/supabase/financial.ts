import { supabase as browserClient } from './client';
import { handleError } from '@/utils/errorHandler';
import { clientService } from './clients'; // Import client service to get client data
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Define a type for the client balance record with joined client data
interface ClientBalanceWithClient {
  id: string;
  client_id: string;
  current_balance: number;
  construction_site: string | null;
  last_updated: string;
  business_name?: string;
  credit_status?: string;
  client_code?: string;
}

// Define a type for client data matching the structure returned by getAllClients
interface ClientData {
  id: string;
  business_name: string;
  client_code: string;
  credit_status?: string;
}

interface BalanceDataResponse {
  id: string;
  client_id: string;
  current_balance: number;
  last_updated: string;
  clients: ClientData | ClientData[] | null;
}

interface ClientPayment {
  client_id: string;
  payment_date: string;
}

/**
 * Service for financial data operations in Supabase
 */
export const financialService = {
  /**
   * Get the total outstanding balance across all clients
   * @param client Optional Supabase client instance (server or browser)
   * @returns The total outstanding balance
   */
  async getTotalOutstandingBalance(client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .from('client_balances')
        .select('current_balance')
        .eq('construction_site', null);

      if (error) throw error;

      // Sum up all balances
      const totalBalance = data.reduce((sum, item) => sum + (item.current_balance || 0), 0);
      return totalBalance;
    } catch (error) {
      const errorMessage = handleError(error, 'getTotalOutstandingBalance');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get the total payments received within a date range
   * @param startDate The start date of the range
   * @param endDate The end date of the range
   * @param client Optional Supabase client instance (server or browser)
   * @returns The total payment amount and count
   */
  async getTotalPaymentsReceived(startDate: string, endDate: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .from('client_payments')
        .select('amount')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (error) throw error;

      const totalAmount = data.reduce((sum, payment) => sum + payment.amount, 0);
      return {
        totalAmount,
        count: data.length
      };
    } catch (error) {
      const errorMessage = handleError(error, `getTotalPaymentsReceived:${startDate}:${endDate}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get the count of orders pending credit approval
   * @param client Optional Supabase client instance (server or browser)
   * @returns The count of pending credit orders
   */
  async getPendingCreditOrdersCount(client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('credit_status', 'PENDING');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      const errorMessage = handleError(error, 'getPendingCreditOrdersCount');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get clients with potentially overdue balances (balance > 0)
   * @param client Optional Supabase client instance (server or browser)
   * @returns Count of clients with balances > 0
   */
  async getOverdueClientsCount(client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { count, error } = await supabase
        .from('client_balances')
        .select('*', { count: 'exact', head: true })
        .eq('construction_site', null)
        .gt('current_balance', 0);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      const errorMessage = handleError(error, 'getOverdueClientsCount');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get client balances with additional information for the table view
   * This is the main method that should be used by components
   * @param client Optional Supabase client instance (server or browser)
   * @returns An array of client balance data with extra information
   */
  async getClientBalancesForTable(client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      // Fetch client balances with proper join syntax for clients table
      const { data: balanceData, error: balanceError } = await supabase
        .from('client_balances')
        .select(`
          id,
          client_id,
          current_balance,
          last_updated,
          clients:clients(
            id,
            business_name,
            client_code,
            credit_status
          )
        `)
        .is('construction_site', null); // Ensure we only get general balances, not site-specific ones

      if (balanceError) {
        console.error("Error fetching client balances:", balanceError);
        throw balanceError;
      }

      if (!balanceData || balanceData.length === 0) {
        return [];
      }

      // Extract client IDs for payment lookup
      const clientIds = balanceData.map(balance => balance.client_id);

      // Get latest payment date for each client
      const { data: payments, error: paymentsError } = await supabase
        .from('client_payments')
        .select('client_id, payment_date')
        .in('client_id', clientIds)
        .order('payment_date', { ascending: false });

      if (paymentsError) {
        console.error("Error fetching latest payments:", paymentsError);
      }

      // Map of latest payment date by client ID
      const latestPaymentsByClient = new Map<string, string>();
      (payments as ClientPayment[] || []).forEach(payment => {
        if (!latestPaymentsByClient.has(payment.client_id)) {
          latestPaymentsByClient.set(payment.client_id, payment.payment_date);
        }
      });

      // Format the results using the properly joined client data
      const formattedBalances = (balanceData as BalanceDataResponse[]).map(balance => {
        // Safely handle clients data which could be array, single object, or null
        const clientData = balance.clients;
        const client = Array.isArray(clientData) ? clientData[0] : clientData;

        // Standardize credit status casing to match components
        let creditStatus = client?.credit_status || 'pending';
        creditStatus = creditStatus.toLowerCase();

        return {
          client_id: balance.client_id,
          business_name: client?.business_name || client?.client_code || 'Cliente Desconocido',
          current_balance: balance.current_balance || 0,
          last_payment_date: latestPaymentsByClient.get(balance.client_id) || null,
          credit_status: creditStatus,
          last_updated: balance.last_updated
        };
      });

      return formattedBalances;
    } catch (error) {
      const errorMessage = handleError(error, 'getClientBalancesForTable');
      console.error('Error fetching client balances:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Alternative method - kept for backward compatibility
   * Use getClientBalancesForTable() instead
   * @param client Optional Supabase client instance (server or browser)
   */
  async getClientBalancesForTableAlternative(client?: SupabaseClient<Database>) {
    return this.getClientBalancesForTable(client);
  },

  /**
   * Get the client balance for a specific client
   * @param clientId The client ID
   * @param client Optional Supabase client instance (server or browser)
   * @returns The client's balance information
   */
  async getClientBalance(clientId: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .from('client_balances')
        .select(`
          id,
          client_id,
          current_balance,
          construction_site,
          last_updated,
          clients (
            id,
            business_name,
            contact_name,
            phone
          )
        `)
        .eq('client_id', clientId)
        .is('construction_site', null)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `getClientBalance:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get all balances for a specific client including per-site balances
   * @param clientId The client ID
   * @param client Optional Supabase client instance (server or browser)
   * @returns An object containing general and site-specific balances
   */
  async getAllClientBalances(clientId: string, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      const { data, error } = await supabase
        .from('client_balances')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;

      // Split general and site-specific balances
      const generalBalance = data?.find(b => b.construction_site === null);
      const siteBalances = data?.filter(b => b.construction_site !== null);

      return { generalBalance, siteBalances };
    } catch (error) {
      const errorMessage = handleError(error, `getAllClientBalances:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get client payment history
   * @param clientId The client ID
   * @param limit Optional limit on number of payments to return
   * @param client Optional Supabase client instance (server or browser)
   * @returns Array of payment records
   */
  async getClientPaymentHistory(clientId: string, limit?: number, client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      let query = supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, `getClientPaymentHistory:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * For debugging - create test balance records if none exist
   * @param client Optional Supabase client instance (server or browser)
   */
  async createTestBalanceRecords(client?: SupabaseClient<Database>) {
    const supabase = client || browserClient;
    try {
      console.log('Checking for existing records...');
      
      // First, check if there are any records
      const { data: existingRecords, error: checkError } = await supabase
        .from('client_balances')
        .select('id')
        .limit(1);
        
      if (checkError) {
        console.error('Error checking for records:', checkError);
        throw checkError;
      }
      
      // If records exist, don't create test data
      if (existingRecords && existingRecords.length > 0) {
        console.log('Balance records already exist, not creating test data');
        return { success: false, message: 'Records already exist' };
      }
      
      console.log('No balance records found, creating test data...');
      
      // Get some client IDs to use
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, business_name')
        .limit(3);
        
      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        throw clientsError;
      }
      
      if (!clients || clients.length === 0) {
        console.log('No clients found to create test balances');
        return { success: false, message: 'No clients found' };
      }
      
      console.log('Found clients:', clients);
      
      // Create balance records for each client
      const records = clients.map(client => ({
        client_id: client.id,
        construction_site: null, // General balance
        current_balance: Math.floor(Math.random() * 20000) + 5000, // Random amount between 5000-25000
        last_updated: new Date().toISOString()
      }));
      
      console.log('Creating records:', records);
      
      // Insert the records
      const { data: insertResult, error: insertError } = await supabase
        .from('client_balances')
        .insert(records)
        .select();
        
      if (insertError) {
        console.error('Error inserting test balances:', insertError);
        throw insertError;
      }
      
      console.log('Test balances created successfully:', insertResult);
      return { success: true, data: insertResult };
    } catch (error) {
      const errorMessage = handleError(error, 'createTestBalanceRecords');
      console.error('Error creating test balances:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}; 