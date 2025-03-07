import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clientService } from '@/lib/supabase/clients';
import { recipeService } from '@/lib/supabase/recipes';

export async function GET() {
  try {
    // 1. Fetch quotes stats for current month and previous month
    const { count: monthlyQuotes } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setDate(1)).toISOString());
      
    const { count: previousMonthQuotes } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setMonth(new Date().getMonth() - 1, 1)).toISOString())
      .lt('created_at', new Date(new Date().setDate(1)).toISOString());
    
    // 2. Calculate monthly concrete volume
    const { data: currentMonthVolume } = await supabase
      .from('order_history')
      .select('volume')
      .gte('created_at', new Date(new Date().setDate(1)).toISOString());
      
    const totalCurrentMonthVolume = currentMonthVolume ? 
      currentMonthVolume.reduce((sum, order) => sum + (order.volume || 0), 0) : 0;
      
    const { data: previousMonthVolume } = await supabase
      .from('order_history')
      .select('volume')
      .gte('created_at', new Date(new Date().setMonth(new Date().getMonth() - 1, 1)).toISOString())
      .lt('created_at', new Date(new Date().setDate(1)).toISOString());
      
    const totalPreviousMonthVolume = previousMonthVolume ? 
      previousMonthVolume.reduce((sum, order) => sum + (order.volume || 0), 0) : 0;
    
    // 3. Get active clients count
    const clientsResponse = await clientService.getAllClients();
    const activeClientsCount = clientsResponse ? clientsResponse.length : 0;
    
    // 4. Get active recipes count
    const { data: recipes } = await recipeService.getRecipes();
    const activeRecipesCount = recipes ? recipes.length : 0;
    
    // 5. Get new notifications count (less than 1 hour old)
    const { data: recentNotifications } = await supabase
      .from('activity_log')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    const newNotificationsCount = recentNotifications ? recentNotifications.length : 0;
    
    // Calculate growth rates
    const monthlyQuotesValue = monthlyQuotes || 0;
    const previousMonthQuotesValue = previousMonthQuotes || 0;
    
    const quoteGrowth = previousMonthQuotesValue > 0 
      ? Math.round(((monthlyQuotesValue - previousMonthQuotesValue) / previousMonthQuotesValue) * 100) 
      : 0;
      
    const salesGrowth = totalPreviousMonthVolume > 0 
      ? Math.round(((totalCurrentMonthVolume - totalPreviousMonthVolume) / totalPreviousMonthVolume) * 100) 
      : 0;
    
    // Prepare dashboard metrics response
    const metrics = {
      monthlyQuotes: monthlyQuotesValue,
      monthlySales: Math.round(totalCurrentMonthVolume) || 0,
      activeClients: activeClientsCount,
      activeRecipes: activeRecipesCount,
      quoteGrowth,
      salesGrowth,
      clientGrowth: 5, // Hardcoded for now, would need historical data
    }
    
    return NextResponse.json({ 
      metrics,
      newNotificationsCount
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // Cache for 5 minutes, stale for 10
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Error loading dashboard data' }, { status: 500 });
  }
} 