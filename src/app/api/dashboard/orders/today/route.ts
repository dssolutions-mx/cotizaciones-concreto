import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { getAccessiblePlantsForUser } from '@/lib/dashboard/dashboard-access';
import { format } from 'date-fns';

export interface TodayOrderRow {
  id: string;
  orderNumber: string | null;
  clientName: string;
  constructionSite: string | null;
  deliveryTime: string | null;
  volumeM3: number;
  orderStatus: string;
  creditStatus: string | null;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedPlantId = searchParams.get('plant_id');

    const serviceClient = createServiceClient();
    const { plants, error: accessError } = await getAccessiblePlantsForUser(
      serviceClient,
      profile,
      requestedPlantId
    );

    if (accessError) {
      return NextResponse.json({ error: accessError }, { status: 403 });
    }

    if (plants.length === 0) {
      return NextResponse.json({ orders: [], date: format(new Date(), 'yyyy-MM-dd') });
    }

    const plantIds = plants.map((p) => p.id);
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: orders, error } = await serviceClient
      .from('orders')
      .select(
        `
        id,
        order_number,
        delivery_time,
        construction_site,
        order_status,
        credit_status,
        clients ( business_name ),
        order_items ( volume, product_type )
      `
      )
      .in('plant_id', plantIds)
      .eq('delivery_date', today)
      .not('order_status', 'eq', 'CANCELLED')
      .order('delivery_time', { ascending: true, nullsFirst: false });

    if (error) throw error;

    const rows: TodayOrderRow[] = (orders ?? []).map((order) => {
      const clientRel = order.clients as { business_name?: string } | { business_name?: string }[] | null;
      const clientName = Array.isArray(clientRel)
        ? clientRel[0]?.business_name
        : clientRel?.business_name;

      const items = (order.order_items ?? []) as { volume?: number; product_type?: string }[];
      const volumeM3 = items.reduce((sum, item) => {
        if (item.product_type === 'PRODUCTO ADICIONAL') return sum;
        return sum + (Number(item.volume) || 0);
      }, 0);

      return {
        id: order.id,
        orderNumber: order.order_number,
        clientName: clientName ?? 'Cliente',
        constructionSite: order.construction_site,
        deliveryTime: order.delivery_time,
        volumeM3: Math.round(volumeM3 * 100) / 100,
        orderStatus: order.order_status ?? '',
        creditStatus: order.credit_status,
      };
    });

    return NextResponse.json(
      { orders: rows, date: today, count: rows.length },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Error fetching today orders:', err);
    return NextResponse.json({ orders: [], date: format(new Date(), 'yyyy-MM-dd'), count: 0 });
  }
}
