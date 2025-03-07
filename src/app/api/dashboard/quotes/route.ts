import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Fetch quotes by status for the pie chart
    const { data: pendingQuotesCount } = await supabase
      .from('quotes')
      .select('id', { count: 'exact' })
      .eq('status', 'PENDING');
      
    const { data: approvedQuotesCount } = await supabase
      .from('quotes')
      .select('id', { count: 'exact' })
      .eq('status', 'APPROVED');
      
    const { data: rejectedQuotesCount } = await supabase
      .from('quotes')
      .select('id', { count: 'exact' })
      .eq('status', 'REJECTED');
    
    const quotesData = [
      { name: 'Pendientes', value: pendingQuotesCount ? pendingQuotesCount.length : 0 },
      { name: 'Aprobadas', value: approvedQuotesCount ? approvedQuotesCount.length : 0 },
      { name: 'Rechazadas', value: rejectedQuotesCount ? rejectedQuotesCount.length : 0 },
    ];
    
    // 2. Fetch recent pending quotes
    const { data: recentPendingQuotes } = await supabase
      .from('quotes')
      .select(`
        id, 
        quote_number, 
        clients:client_id(business_name), 
        created_at, 
        total_amount, 
        status, 
        construction_site
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(3);
      
    const pendingQuotes = recentPendingQuotes ? recentPendingQuotes.map(quote => ({
      id: quote.quote_number,
      client: quote.clients && typeof quote.clients === 'object' 
        ? (quote.clients as any).business_name || 'Cliente'
        : 'Cliente',
      date: new Date(quote.created_at).toISOString().split('T')[0],
      amount: `$${Number(quote.total_amount).toLocaleString('es-MX')}`,
      status: 'Pendiente',
      constructionSite: quote.construction_site
    })) : [];
    
    return NextResponse.json({ 
      quotesData,
      pendingQuotes
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' // Cache for 10 minutes, stale for 20
      }
    });
    
  } catch (error) {
    console.error('Error fetching quotes data:', error);
    return NextResponse.json({ error: 'Error loading quotes data' }, { status: 500 });
  }
} 