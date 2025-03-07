import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Create array with last 6 months
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleString('es-MX', { month: 'short' }),
        year: date.getFullYear(),
        startDate: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
        endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString()
      };
    }).reverse();
    
    // Execute all queries in parallel for better performance
    const salesPromises = last6Months.map(async (monthData) => {
      const { data: monthlyOrders } = await supabase
        .from('order_history')
        .select('volume')
        .gte('created_at', monthData.startDate)
        .lt('created_at', monthData.endDate);
        
      const totalVolume = monthlyOrders ? 
        monthlyOrders.reduce((sum, order) => sum + (order.volume || 0), 0) : 0;
        
      return {
        name: monthData.month,
        value: Math.round(totalVolume)
      };
    });
    
    // Wait for all promises to resolve
    const salesData = await Promise.all(salesPromises);
    
    return NextResponse.json({ 
      salesData 
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' // Cache for 10 minutes, stale for 20
      }
    });
    
  } catch (error) {
    console.error('Error fetching sales data:', error);
    return NextResponse.json({ error: 'Error loading sales data' }, { status: 500 });
  }
} 