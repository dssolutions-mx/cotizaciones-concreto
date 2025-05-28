import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface DashboardMetrics {
  // Core metrics
  monthlyQuotes: number;
  monthlySales: number;
  activeClients: number;
  
  // Growth metrics
  quoteGrowth: number;
  salesGrowth: number;
  clientGrowth: number;
  
  // Financial metrics
  totalOutstandingBalance: number;
  monthlyRevenue: number;
  pendingCreditOrders: number;
  
  // Operational metrics
  pendingQuotes: number;
  todayOrders: number;
}

export async function GET() {
  try {
    // Create service client like finanzas pages do
    const serviceClient = createServiceClient();
    
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));
    const today = format(now, 'yyyy-MM-dd');
    
    // Execute all queries in parallel using the same patterns as finanzas pages
    const [
      // Quotes data - using correct schema (no total_amount in quotes table)
      currentMonthQuotesResult,
      previousMonthQuotesResult,
      pendingQuotesResult,
      
      // Orders data - using exact same pattern as finanzas/ventas-diarias
      currentMonthOrdersResult,
      previousMonthOrdersResult,
      todayOrdersResult,
      
      // Remisiones for actual sales volume - using pattern from finanzas/ventas
      currentMonthRemisionesResult,
      previousMonthRemisionesResult,
      
      // Financial data using orders like finanzas pages
      currentMonthRevenueResult,
      
      // Credit orders for proper credit tracking
      creditOrdersResult
    ] = await Promise.all([
      // Quotes metrics - only get count and basic info
      serviceClient
        .from('quotes')
        .select('id, status, created_at', { count: 'exact' })
        .gte('created_at', currentMonthStart.toISOString())
        .lte('created_at', currentMonthEnd.toISOString()),
        
      serviceClient
        .from('quotes')
        .select('id, status, created_at', { count: 'exact' })
        .gte('created_at', previousMonthStart.toISOString())
        .lte('created_at', previousMonthEnd.toISOString()),
        
      serviceClient
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['DRAFT', 'PENDING_APPROVAL']),
        
      // Orders data - using exact same pattern as ventas-diarias page
      serviceClient
        .from('orders')
        .select('id, client_id, total_amount, final_amount, invoice_amount, delivery_date, requires_invoice, order_status')
        .gte('delivery_date', format(currentMonthStart, 'yyyy-MM-dd'))
        .lte('delivery_date', format(currentMonthEnd, 'yyyy-MM-dd'))
        .not('order_status', 'eq', 'CANCELLED'),
        
      serviceClient
        .from('orders')
        .select('id, client_id, total_amount, final_amount, invoice_amount, delivery_date, requires_invoice, order_status')
        .gte('delivery_date', format(previousMonthStart, 'yyyy-MM-dd'))
        .lte('delivery_date', format(previousMonthEnd, 'yyyy-MM-dd'))
        .not('order_status', 'eq', 'CANCELLED'),
        
      serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_date', today)
        .not('order_status', 'eq', 'CANCELLED'),
        
      // Remisiones for volume calculation - using exact pattern from ventas page
      serviceClient
        .from('remisiones')
        .select('volumen_fabricado, fecha, tipo_remision')
        .gte('fecha', format(currentMonthStart, 'yyyy-MM-dd'))
        .lte('fecha', format(currentMonthEnd, 'yyyy-MM-dd')),
        
      serviceClient
        .from('remisiones')
        .select('volumen_fabricado, fecha, tipo_remision')
        .gte('fecha', format(previousMonthStart, 'yyyy-MM-dd'))
        .lte('fecha', format(previousMonthEnd, 'yyyy-MM-dd')),
        
      // Revenue data using same pattern as finanzas/ventas-diarias
      serviceClient
        .from('orders')
        .select('total_amount, final_amount, invoice_amount, requires_invoice')
        .gte('delivery_date', format(currentMonthStart, 'yyyy-MM-dd'))
        .lte('delivery_date', format(currentMonthEnd, 'yyyy-MM-dd'))
        .not('order_status', 'eq', 'CANCELLED')
        .not('total_amount', 'is', null),
        
      // Credit orders pending approval - using same logic as finanzas pages (credit_status = 'pending')
      serviceClient
        .from('orders')
        .select('id, total_amount, final_amount, invoice_amount, client_id, order_status, credit_status', { count: 'exact' })
        .eq('credit_status', 'pending')
        .not('order_status', 'eq', 'CANCELLED')
    ]);

    // Process quotes data - using count since there's no total_amount in quotes table
    const monthlyQuotes = currentMonthQuotesResult.count || 0;
    const previousMonthQuotes = previousMonthQuotesResult.count || 0;
    const pendingQuotes = pendingQuotesResult.count || 0;
    
    // Process sales volume data from remisiones - same pattern as ventas page
    const currentMonthVolume = currentMonthRemisionesResult.data?.reduce(
      (sum: number, remision: { volumen_fabricado?: number | string; tipo_remision?: string }) => {
        // Exclude BOMBEO to avoid double counting, same as ventas page
        if (remision.tipo_remision !== 'BOMBEO') {
          return sum + (Number(remision.volumen_fabricado) || 0);
        }
        return sum;
      }, 0
    ) || 0;
    
    const previousMonthVolume = previousMonthRemisionesResult.data?.reduce(
      (sum: number, remision: { volumen_fabricado?: number | string; tipo_remision?: string }) => {
        if (remision.tipo_remision !== 'BOMBEO') {
          return sum + (Number(remision.volumen_fabricado) || 0);
        }
        return sum;
      }, 0
    ) || 0;
    
    const todayOrders = todayOrdersResult.count || 0;
    
    // Calculate actual revenue from delivered orders - same pattern as ventas-diarias
    const monthlyRevenue = currentMonthRevenueResult.data?.reduce(
      (sum: number, order: { total_amount?: number | string; final_amount?: number | string; invoice_amount?: number | string; requires_invoice?: boolean }) => {
        // Use invoice_amount if requires_invoice (credit/fiscal), otherwise final_amount or total_amount (cash/efectivo)
        let amount = 0;
        if (order.requires_invoice) {
          amount = Number(order.invoice_amount) || Number(order.final_amount) * 1.16 || Number(order.total_amount) * 1.16 || 0;
        } else {
          amount = Number(order.final_amount) || Number(order.total_amount) || 0;
        }
        return sum + amount;
      }, 0
    ) || 0;
    
    // Calculate active clients from current month orders - only clients with orders this month
    const uniqueClientIds = new Set(
      currentMonthOrdersResult.data?.map((order: { client_id: string }) => order.client_id) || []
    );
    const activeClients = uniqueClientIds.size;
    
    // Calculate growth rates
    const quoteGrowth = previousMonthQuotes > 0 
      ? Math.round(((monthlyQuotes - previousMonthQuotes) / previousMonthQuotes) * 100) 
      : 0;
      
    const salesGrowth = previousMonthVolume > 0 
      ? Math.round(((currentMonthVolume - previousMonthVolume) / previousMonthVolume) * 100) 
      : 0;
    
    // Client growth calculation - compare active clients this month vs last month
    const previousMonthUniqueClientIds = new Set(
      previousMonthOrdersResult.data?.map((order: { client_id: string }) => order.client_id) || []
    );
    const previousActiveClients = previousMonthUniqueClientIds.size;
    const clientGrowth = previousActiveClients > 0 
      ? Math.round(((activeClients - previousActiveClients) / previousActiveClients) * 100) 
      : 0;
    
    // Calculate outstanding balance and pending credit orders using correct logic
    // credit_status = 'pending' means orders waiting for credit approval
    const pendingCreditOrders = creditOrdersResult.count || 0;
    
    // For outstanding balance, we need to get actual credit orders that are delivered but unpaid
    // For now, let's use a simple approach - we'll improve this later if needed
    const totalOutstandingBalance = 0; // Placeholder - would need payment tracking
    
    // Prepare comprehensive dashboard metrics
    const metrics: DashboardMetrics = {
      // Core metrics (removed activeRecipes)
      monthlyQuotes,
      monthlySales: Math.round(currentMonthVolume * 100) / 100, // Round to 2 decimals
      activeClients, // Now only counts clients with orders this month
      
      // Growth metrics
      quoteGrowth,
      salesGrowth,
      clientGrowth,
      
      // Financial metrics (corrected credit logic)
      totalOutstandingBalance: Math.round(totalOutstandingBalance),
      monthlyRevenue: Math.round(monthlyRevenue),
      pendingCreditOrders, // Now correctly counts orders with requires_invoice = true
      
      // Operational metrics
      pendingQuotes,
      todayOrders
    };
    
    console.log('Dashboard metrics calculated (corrected version):', {
      monthlyQuotes,
      monthlySales: currentMonthVolume,
      monthlyRevenue,
      activeClients,
      todayOrders,
      pendingQuotes,
      pendingCreditOrders,
      totalOutstandingBalance,
      dateRange: {
        currentMonth: `${format(currentMonthStart, 'yyyy-MM-dd')} to ${format(currentMonthEnd, 'yyyy-MM-dd')}`,
        today
      },
      rawDataCounts: {
        quotesThisMonth: currentMonthQuotesResult.data?.length,
        quotesLastMonth: previousMonthQuotesResult.data?.length,
        ordersThisMonth: currentMonthOrdersResult.data?.length,
        remisionesThisMonth: currentMonthRemisionesResult.data?.length,
        revenueOrdersThisMonth: currentMonthRevenueResult.data?.length,
        pendingCreditOrdersCount: pendingCreditOrders,
        uniqueClientsThisMonth: activeClients
      }
    });
    
    return NextResponse.json({ 
      metrics,
      newNotificationsCount: Math.min(pendingQuotes + pendingCreditOrders, 10), // Simple notification count
      lastUpdated: new Date().toISOString()
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // Cache for 5 minutes
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    
    // Return safe fallback data to prevent UI failures
    const fallbackMetrics: DashboardMetrics = {
      monthlyQuotes: 0,
      monthlySales: 0,
      activeClients: 0,
      quoteGrowth: 0,
      salesGrowth: 0,
      clientGrowth: 0,
      totalOutstandingBalance: 0,
      monthlyRevenue: 0,
      pendingCreditOrders: 0,
      pendingQuotes: 0,
      todayOrders: 0
    };
    
    return NextResponse.json({ 
      metrics: fallbackMetrics,
      newNotificationsCount: 0,
      error: 'Error loading dashboard data',
      lastUpdated: new Date().toISOString()
    }, { status: 200 });
  }
} 