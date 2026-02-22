import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

interface ActivityItem {
  id: string;
  text: string;
  user: string;
  time: string;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // Get plant_id from query parameters
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    
    // Create service client like finanzas pages do
    const serviceClient = createServiceClient();
    
    // Fetch recent orders and quotes for activity feed
    const [ordersResult, quotesResult] = await Promise.all([
      (async () => {
        let ordersQuery = serviceClient
          .from('orders')
          .select(`
            id,
            order_number,
            created_at,
            order_status,
            clients (
              business_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (plantId) {
          ordersQuery = ordersQuery.eq('plant_id', plantId);
        }
        
        return await ordersQuery;
      })(),
      
      (async () => {
        let quotesQuery = serviceClient
          .from('quotes')
          .select(`
            id,
            quote_number,
            status,
            created_at,
            clients:client_id (
              business_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (plantId) {
          quotesQuery = quotesQuery.eq('plant_id', plantId);
        }
        
        return await quotesQuery;
      })()
    ]);

    // Combine and format activity items
    const activities: ActivityItem[] = [];
    
    // Add order activities
    if (ordersResult.data) {
      ordersResult.data.forEach(order => {
        activities.push({
          id: `order-${order.id}`,
          text: `Nuevo pedido ${order.order_number} - ${(order.clients as any)?.business_name || 'Cliente desconocido'}`,
          user: 'Sistema',
          time: `${Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60))} min`
        });
      });
    }

    // Add quote activities
    if (quotesResult.data) {
      quotesResult.data.forEach(quote => {
        const statusText = quote.status === 'APPROVED' ? 'aprobada' : 
                          quote.status === 'REJECTED' ? 'rechazada' : 'creada';
        activities.push({
          id: `quote-${quote.id}`,
          text: `Cotización ${quote.quote_number} ${statusText} - ${(quote.clients as any)?.business_name || 'Cliente desconocido'}`,
          user: 'Sistema',
          time: `${Math.floor((Date.now() - new Date(quote.created_at).getTime()) / (1000 * 60))} min`
        });
      });
    }

    // Sort by time and limit to 8 most recent
    activities.sort((a, b) => parseInt(a.time) - parseInt(b.time));
    const recentActivity = activities.slice(0, 8);

    // Generate notifications
    const notifications = [];
    
    // Add pending quotes notification
    if (quotesResult.data) {
      const pendingQuotes = quotesResult.data.filter(q => q.status === 'PENDING_APPROVAL' || q.status === 'DRAFT');
      if (pendingQuotes.length > 0) {
        notifications.push({
          id: 'pending-quotes',
          text: `${pendingQuotes.length} cotización(es) pendiente(s) de revisión`,
          time: '2 min',
          isNew: true
        });
      }
    }

    // Add pending orders notification
    if (ordersResult.data) {
      const pendingOrders = ordersResult.data.filter(o => o.order_status === 'created' || o.order_status === 'pending');
      if (pendingOrders.length > 0) {
        notifications.push({
          id: 'pending-orders',
          text: `${pendingOrders.length} pedido(s) requiere(n) atención`,
          time: '5 min',
          isNew: true
        });
      }
    }

    // Add default notifications if no real data
    if (notifications.length === 0) {
      notifications.push(
        {
          id: 'welcome',
          text: 'Bienvenido al sistema de DC Concretos',
          time: '1 min',
          isNew: false
        },
        {
          id: 'system-ready',
          text: 'Sistema listo para operación',
          time: '5 min',
          isNew: false
        }
      );
    }

    console.log('Activity API response (using correct schema):', {
      activitiesCount: recentActivity.length,
      notificationsCount: notifications.length,
      ordersFound: ordersResult.data?.length || 0,
      quotesFound: quotesResult.data?.length || 0
    });

    return NextResponse.json(
      { recentActivity, notifications },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (error) {
    console.error('Error fetching activity data:', error);
    
    // Return fallback data
    return NextResponse.json({
      recentActivity: [
        {
          id: 'sample-1',
          text: 'Sistema iniciado correctamente',
          user: 'Sistema',
          time: '5 min'
        },
        {
          id: 'sample-2', 
          text: 'Dashboard cargado',
          user: 'Sistema',
          time: '1 min'
        }
      ],
      notifications: [
        {
          id: 'welcome',
          text: 'Bienvenido al sistema de DC Concretos',
          time: '1 min',
          isNew: false
        }
      ]
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
} 