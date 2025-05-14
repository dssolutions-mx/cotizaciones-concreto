import { supabase as browserClient } from './client';
import { handleError } from '@/utils/errorHandler';
import { clientService } from './clients'; // Import client service to get client data
import { SupabaseClient } from '@supabase/supabase-js';

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

// Add interface for payment data
interface PaymentData {
  client_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
  construction_site?: string | null;
}

// Add interface for payment response
interface PaymentResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

// New interface for the dashboard data
interface FinancialDashboardData {
  totalOutstandingBalance: number;
  paymentsLastThirtyDays: {
    totalAmount: number;
    count: number;
  };
  pendingCreditOrdersCount: number;
  overdueClientsCount: number;
}

// Function to get cached data - could be moved to a utils file
function getClientCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cachedData = localStorage.getItem(key);
    const cachedTimestamp = localStorage.getItem(`${key}_timestamp`);
    const now = Date.now();
    
    if (cachedData && cachedTimestamp && (now - parseInt(cachedTimestamp)) < 5 * 60 * 1000) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  
  return null;
}

// Function to set cached data
function setClientCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(`${key}_timestamp`, Date.now().toString());
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

/**
 * Service for financial data operations in Supabase
 */
export const financialService = {
  /**
   * Get all financial dashboard data in parallel to improve performance
   * @param startDate Start date for payments calculation
   * @param endDate End date for payments calculation
   * @param client Optional Supabase client instance
   * @param useCache Whether to use cached data (default: true)
   * @returns Combined financial dashboard data
   */
  async getFinancialDashboardData(
    startDate: string, 
    endDate: string, 
    client?: SupabaseClient<any>,
    useCache: boolean = true
  ): Promise<FinancialDashboardData> {
    try {
      // Try to get from cache first
      const cacheKey = `financial_dashboard_${startDate}`;
      const cachedData = useCache ? getClientCache<FinancialDashboardData>(cacheKey) : null;
      
      if (cachedData) {
        console.log('Using cached financial dashboard data');
        return cachedData;
      }
      
      console.log('Fetching fresh financial dashboard data');
      
      // Execute all queries in parallel using Promise.all with timeout protection
      const resultsPromise = Promise.all([
        this.getTotalOutstandingBalance(client),
        this.getTotalPaymentsReceived(startDate, endDate, client),
        this.getPendingCreditOrdersCount(client),
        this.getOverdueClientsCount(client)
      ]);
      
      // Add timeout of 2 seconds for dashboard metrics to prevent blocking page load
      const timeoutPromise = new Promise<any[]>((resolve) => {
        setTimeout(() => {
          resolve([0, {totalAmount: 0, count: 0}, 0, 0]);
        }, 2000);
      });
      
      // Use race to ensure we get either results or fallback values within 2 seconds
      const [
        totalOutstandingBalance,
        paymentsLastThirtyDays,
        pendingCreditOrdersCount,
        overdueClientsCount
      ] = await Promise.race([resultsPromise, timeoutPromise]);

      const result = {
        totalOutstandingBalance,
        paymentsLastThirtyDays,
        pendingCreditOrdersCount,
        overdueClientsCount
      };
      
      // Save to cache if we didn't hit the timeout
      if (useCache) {
        setClientCache(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      handleError(error, 'getFinancialDashboardData');
      // Return default values in case of error to prevent UI failures
      return {
        totalOutstandingBalance: 0,
        paymentsLastThirtyDays: { totalAmount: 0, count: 0 },
        pendingCreditOrdersCount: 0,
        overdueClientsCount: 0
      };
    }
  },

  /**
   * Register a new payment for a client and update their balance
   * @param paymentData Payment data containing client ID, amount, and other details
   * @param client Optional Supabase client instance
   * @returns Object indicating success/failure with message
   */
  async registerPayment(paymentData: PaymentData, client?: SupabaseClient<any>): Promise<PaymentResponse> {
    const supabase = client || browserClient;
    try {
      // Validate essential data
      if (!paymentData.client_id) {
        return { success: false, message: 'ID de cliente requerido' };
      }
      
      if (!paymentData.amount || paymentData.amount <= 0) {
        return { success: false, message: 'El monto del pago debe ser mayor que cero' };
      }
      
      // Get user ID for audit
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, message: 'No se pudo determinar el usuario actual. Por favor, inicie sesión nuevamente.' };
      }
      
      // Add the created_by field to payment data
      const paymentWithMetadata = {
        ...paymentData,
        created_by: user.id,
        construction_site: paymentData.construction_site || null
      };
      
      // Insert the payment record
      const { data: insertedPayment, error: insertError } = await supabase
        .from('client_payments')
        .insert(paymentWithMetadata)
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      // Call RPC to update balance automatically
      // This assumes balance update is handled by a trigger or separate function
      // If you need to manually update the balance, you would do it here
      
      return {
        success: true,
        message: 'Pago registrado exitosamente',
        data: insertedPayment
      };
    } catch (error) {
      const errorMessage = handleError(error, 'registerPayment');
      console.error('Error registering payment:', error);
      return {
        success: false,
        message: errorMessage,
        error
      };
    }
  },

  /**
   * Get the total outstanding balance across all clients
   * @param client Optional Supabase client instance (server or browser)
   * @returns The total outstanding balance
   */
  async getTotalOutstandingBalance(client?: SupabaseClient<any>) {
    const supabase = client || browserClient;
    try {
      // Optimized query - select only what we need
      const { data, error } = await supabase
        .from('client_balances')
        .select('current_balance')
        .is('construction_site', null)
        .limit(1000)  // Add a reasonable limit
        .abortSignal(AbortSignal.timeout(1800)); // 1.8s timeout
  
      if (error) throw error;
      
      // Sum up all balances
      const totalBalance = (data || []).reduce((sum, item) => sum + (item.current_balance || 0), 0);
      return totalBalance;
    } catch (error) {
      handleError(error, 'getTotalOutstandingBalance');
      return 0; // Return 0 instead of throwing to prevent component failure
    }
  },

  /**
   * Get the total payments received within a date range
   * @param startDate The start date of the range (typically 30 days ago)
   * @param endDate The end date of the range (optional, not used in the query)
   * @param client Optional Supabase client instance (server or browser)
   * @returns The total payment amount and count
   */
  async getTotalPaymentsReceived(startDate: string, endDate?: string, client?: SupabaseClient<any>) {
    const supabase = client || browserClient;
    try {
      // IMPORTANT: We must get all payments regardless of construction_site
      // This means construction_site can be null, empty string, or any value
      const { data, error } = await supabase
        .from('client_payments')
        .select('amount') // Only select the fields we need
        .gte('payment_date', startDate) // Get all payments since startDate
        .order('payment_date', { ascending: false })
        .limit(1000)
        .abortSignal(AbortSignal.timeout(1800)); // 1.8s timeout
        
      if (error) throw error;

      // IMPORTANT: We need to sum ALL payments regardless of construction_site value
      const totalAmount = (data || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
      
      return {
        totalAmount,
        count: data?.length || 0
      };
    } catch (error) {
      const errorMessage = handleError(error, `getTotalPaymentsReceived`);
      console.error('Error in getTotalPaymentsReceived:', error);
      return {
        totalAmount: 0,
        count: 0
      };
    }
  },

  /**
   * Get the count of orders pending credit approval
   * @param client Optional Supabase client instance (server or browser)
   * @returns The count of pending credit orders
   */
  async getPendingCreditOrdersCount(client?: SupabaseClient<any>) {
    const supabase = client || browserClient;
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('credit_status', 'pending')
        .abortSignal(AbortSignal.timeout(1800)); // 1.8s timeout

      if (error) throw error;
      return count || 0;
    } catch (error) {
      handleError(error, 'getPendingCreditOrdersCount');
      return 0; // Return 0 instead of throwing to prevent component failure
    }
  },

  /**
   * Get clients with potentially overdue balances (balance > 0)
   * @param client Optional Supabase client instance (server or browser)
   * @returns Count of clients with balances > 0
   */
  async getOverdueClientsCount(client?: SupabaseClient<any>) {
    const supabase = client || browserClient;
    try {
      // Optimized query
      const { count, error } = await supabase
        .from('client_balances')
        .select('*', { count: 'exact', head: true })
        .is('construction_site', null)
        .gt('current_balance', 0)
        .abortSignal(AbortSignal.timeout(1800)); // 1.8s timeout

      if (error) throw error;
      
      return count || 0;
    } catch (error) {
      handleError(error, 'getOverdueClientsCount');
      return 0; // Return 0 instead of throwing to prevent component failure
    }
  },

  /**
   * Get client balances with additional information for the table view
   * This is the main method that should be used by components
   * @param client Optional Supabase client instance (server or browser)
   * @returns An array of client balance data with extra information
   */
  async getClientBalancesForTable(client?: SupabaseClient<any>) {
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
        .is('construction_site', null); // Use .is() instead of .eq() for NULL values

      if (balanceError) throw balanceError;

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
      throw new Error(errorMessage);
    }
  },

  /**
   * Alternative method - kept for backward compatibility
   * Use getClientBalancesForTable() instead
   * @param client Optional Supabase client instance (server or browser)
   */
  async getClientBalancesForTableAlternative(client?: SupabaseClient<any>) {
    return this.getClientBalancesForTable(client);
  },

  /**
   * Get the client balance for a specific client
   * @param clientId The client ID
   * @param client Optional Supabase client instance (server or browser)
   * @returns The client's balance information
   */
  async getClientBalance(clientId: string, client?: SupabaseClient<any>) {
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
        .is('construction_site', null)  // Use .is() instead of .eq() for NULL values
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleError(error, `getClientBalance:${clientId}`));
    }
  },

  /**
   * Get all balances for a specific client including per-site balances
   * @param clientId The client ID
   * @param client Optional Supabase client instance (server or browser)
   * @returns An object containing general and site-specific balances
   */
  async getAllClientBalances(clientId: string, client?: SupabaseClient<any>) {
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
      throw new Error(handleError(error, `getAllClientBalances:${clientId}`));
    }
  },

  /**
   * Get client payment history
   * @param clientId The client ID
   * @param limit Optional limit on number of payments to return
   * @param client Optional Supabase client instance (server or browser)
   * @returns Array of payment records
   */
  async getClientPaymentHistory(clientId: string, limit?: number, client?: SupabaseClient<any>) {
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
      throw new Error(handleError(error, `getClientPaymentHistory:${clientId}`));
    }
  },

  /**
   * For debugging - create test balance records if none exist
   * @param client Optional Supabase client instance (server or browser)
   */
  async createTestBalanceRecords(client?: SupabaseClient<any>) {
    const supabase = client || browserClient;
    try {
      // First, check if there are any records
      const { data: existingRecords, error: checkError } = await supabase
        .from('client_balances')
        .select('id')
        .limit(1);
        
      if (checkError) {
        return { success: false, error: checkError };
      }
      
      // If records exist, don't create test data
      if (existingRecords && existingRecords.length > 0) {
        return { success: false, message: 'Records already exist' };
      }
      
      // Get some client IDs to use
      let clientsData; // Use a mutable variable
      const { data: initialClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, business_name')
        .limit(5);
        
      if (clientsError) {
        return { success: false, error: clientsError };
      }
      
      clientsData = initialClients || []; // Assign fetched clients
      
      if (clientsData.length === 0) {
        // Create a sample client
        const { data: sampleClient, error: sampleClientError } = await supabase
          .from('clients')
          .insert({
            business_name: 'Test Cliente',
            client_code: 'TEST-001',
            contact_name: 'Test Contact',
            phone: '123456789',
            email: 'test@example.com'
          })
          .select();
          
        if (sampleClientError) {
          return { success: false, error: sampleClientError };
        }
        
        clientsData = sampleClient || []; // Reassign with created client
      }
      
      if (clientsData.length === 0) {
        return { success: false, message: 'No clients found and could not create sample client' };
      }
      
      // Create balance records for each client
      const records = clientsData.map(client => ({
        client_id: client.id,
        construction_site: null, // General balance
        current_balance: Math.floor(Math.random() * 20000) + 5000, // Random amount between 5000-25000
        last_updated: new Date().toISOString()
      }));
      
      // Insert the records
      const { data: insertResult, error: insertError } = await supabase
        .from('client_balances')
        .insert(records)
        .select();
        
      if (insertError) {
        return { success: false, error: insertError };
      }
      
      return { success: true, data: insertResult };
    } catch (error) {
      const errorMessage = handleError(error, 'createTestBalanceRecords');
      return { success: false, error: errorMessage };
    }
  }
}; 