import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build the base query - RLS will automatically filter by client_id
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        construction_site,
        delivery_date,
        order_status,
        elemento,
        created_at
      `)
      .order('delivery_date', { ascending: false });

    // Apply status filter if provided
    if (statusFilter && statusFilter !== 'all') {
      ordersQuery = ordersQuery.eq('order_status', statusFilter);
    }

    // Apply search filter if provided
    if (searchQuery) {
      ordersQuery = ordersQuery.or(
        `order_number.ilike.%${searchQuery}%,construction_site.ilike.%${searchQuery}%`
      );
    }

    // Apply date range filter if provided
    if (fromDate) {
      ordersQuery = ordersQuery.gte('delivery_date', fromDate);
    }
    if (toDate) {
      ordersQuery = ordersQuery.lte('delivery_date', toDate);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      totalCount: orders?.length || 0
    });

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user permissions - require create_orders permission
    const { data: association, error: assocError } = await supabase
      .from('client_portal_users')
      .select('role_within_client, permissions, client_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (assocError) {
      console.error('Error fetching user permissions:', assocError);
      return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }

    // Executives always have permission, regular users need explicit permission
    const isExecutive = association?.role_within_client === 'executive';
    const hasCreatePermission = isExecutive || association?.permissions?.create_orders === true;

    if (!hasCreatePermission) {
      return NextResponse.json(
        { error: 'No tienes permiso para crear pedidos. Contacta al administrador de tu organización.' },
        { status: 403 }
      );
    }

    // Resolve client by portal user
    const clientId = association?.client_id;
    if (!clientId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      construction_site,
      construction_site_id,
      delivery_date,
      delivery_time,
      requires_invoice,
      special_requirements,
      elemento,
      plant_id,
      quote_id,
      quote_detail_id,
      volume,
      unit_price
    } = body || {};

    // Minimal validation
    if (!delivery_date) {
      return NextResponse.json({ error: 'delivery_date is required (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!elemento || typeof elemento !== 'string' || elemento.trim().length === 0) {
      return NextResponse.json({ error: 'elemento es requerido' }, { status: 400 });
    }
    if (!construction_site && !construction_site_id) {
      return NextResponse.json({ error: 'construction_site o construction_site_id es requerido' }, { status: 400 });
    }

    // Reject past dates (YYYY-MM-DD)
    if (delivery_date && typeof delivery_date === 'string') {
      const today = new Date();
      const todayStr = today.toISOString().slice(0,10);
      if (delivery_date < todayStr) {
        return NextResponse.json({ error: 'La fecha no puede ser en el pasado' }, { status: 400 });
      }
    }

    // Generate order number
    const today = new Date();
    const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randomPart}`;

    // Insert order - rely on RLS for client access, but set client_id explicitly
    const totalAmount = (volume && unit_price) ? Number(volume) * Number(unit_price) : 0;

    // Validate construction_site_id is a valid UUID (if provided)
    // If it's not a UUID, it's likely a fallback site name, so set it to null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validSiteId = construction_site_id && uuidRegex.test(construction_site_id) ? construction_site_id : null;

    const insertPayload: Record<string, any> = {
      client_id: client.id,
      construction_site: construction_site ?? null,
      construction_site_id: validSiteId,
      order_number: orderNumber,
      delivery_date,
      delivery_time: delivery_time ?? null,
      requires_invoice: Boolean(requires_invoice),
      special_requirements: special_requirements ?? null,
      total_amount: totalAmount,
      order_status: 'created',
      credit_status: 'pending',
      elemento,
      plant_id: plant_id ?? null,
      quote_id: quote_id ?? null,
      // Default hidden site verification to green
      site_access_rating: 'green',
      // Set created_by to the portal user's ID
      created_by: user.id
    };

    const { data: created, error: insertError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating client-portal order:', insertError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Create order_item if quote_detail_id provided
    if (created?.id && quote_detail_id && volume) {
      // Fetch the quote_detail to get master_recipe info and product_type
      const { data: quoteDetail, error: quoteDetailError } = await supabase
        .from('quote_details')
        .select(`
          id,
          final_price,
          master_recipe_id,
          recipe_id,
          pump_service,
          master_recipes:master_recipe_id (
            id,
            master_code
          ),
          recipes:recipe_id (
            recipe_code
          )
        `)
        .eq('id', quote_detail_id)
        .single();

      if (quoteDetailError || !quoteDetail) {
        console.error('Error fetching quote detail for order item:', quoteDetailError);
        return NextResponse.json({ 
          error: 'No se pudo obtener información del producto',
          details: quoteDetailError 
        }, { status: 500 });
      }

      // Determine product_type (required NOT NULL field)
      // For client portal, we ONLY use master_recipes, NOT variant recipes
      let productType = 'CONCRETO'; // Default fallback
      if (quoteDetail.master_recipe_id && quoteDetail.master_recipes) {
        productType = quoteDetail.master_recipes.master_code || 'CONCRETO';
      } else if (quoteDetail.pump_service) {
        productType = 'SERVICIO DE BOMBEO';
      }

      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: created.id,
          quote_detail_id,
          recipe_id: null, // ALWAYS null for client portal orders - only use master recipes
          master_recipe_id: quoteDetail.master_recipe_id || null,
          product_type: productType,
          volume: Number(volume),
          unit_price: Number(unit_price || 0),
          total_price: totalAmount,
          has_pump_service: quoteDetail.pump_service || false,
          pump_price: quoteDetail.pump_service ? Number(unit_price || 0) : null,
          has_empty_truck_charge: false,
          pump_volume: null
        });

      if (itemError) {
        console.error('Error creating order item:', itemError);
        return NextResponse.json({ 
          error: 'Error al crear el ítem del pedido',
          details: itemError 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ id: created?.id }, { status: 201 });
  } catch (error) {
    console.error('Orders API POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
