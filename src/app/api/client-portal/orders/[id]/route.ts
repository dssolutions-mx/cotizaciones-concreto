import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const orderId = params.id;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: clientData, error: clientError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (clientData.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json({ error: 'Access denied. This endpoint is for external clients only.' }, { status: 403 });
    }

    const clientId = user.id;

    // Get order details with order items and related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        construction_site,
        delivery_date,
        delivery_time,
        order_status,
        total_amount,
        special_requirements,
        requires_invoice,
        credit_status,
        rejection_reason,
        created_at,
        updated_at,
        client_id,
        quote_id,
        order_items (
          id,
          product_type,
          volume,
          unit_price,
          total_price,
          has_pump_service,
          pump_price,
          pump_volume,
          has_empty_truck_charge,
          empty_truck_volume,
          empty_truck_price
        )
      `)
      .eq('id', orderId)
      .eq('client_id', clientId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      console.error('Error fetching order:', orderError);
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }

    // Get related quote information if available
    let quoteInfo = null;
    if (order.quote_id) {
      const { data: quote } = await supabase
        .from('quotes')
        .select('quote_number, status, validity_date')
        .eq('id', order.quote_id)
        .single();

      quoteInfo = quote;
    }

    // Get remisiones (deliveries) for this order
    const { data: remisiones } = await supabase
      .from('remisiones')
      .select(`
        id,
        fecha,
        volumen_fabricado,
        tipo_remision,
        remision_number,
        hora_salida,
        hora_llegada,
        evidencia_url
      `)
      .eq('order_id', orderId)
      .order('fecha', { ascending: false });

    // Get quality tests (ensayos) for this order
    const { data: ensayos } = await supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        resistencia_calculada,
        porcentaje_cumplimiento,
        carga_kg,
        observaciones,
        tipo_ensayo,
        edad_muestra,
        muestra_id
      `)
      .eq('order_id', orderId)
      .order('fecha_ensayo', { ascending: false });

    return NextResponse.json({
      order,
      quote: quoteInfo,
      remisiones: remisiones || [],
      ensayos: ensayos || []
    });

  } catch (error) {
    console.error('Order detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
