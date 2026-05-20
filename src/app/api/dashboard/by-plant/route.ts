import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { getAccessiblePlantsForUser } from '@/lib/dashboard/dashboard-access';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface PlantDashboardRow {
  plantId: string;
  plantCode: string;
  plantName: string;
  monthlySales: number;
  todayOrders: number;
  pendingQuotes: number;
  pendingCreditOrders: number;
  monthlyQuotes: number;
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
      return NextResponse.json({ plants: [], totals: null, lastUpdated: new Date().toISOString() });
    }

    const plantIds = plants.map((p) => p.id);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const today = format(now, 'yyyy-MM-dd');
    const monthStart = format(currentMonthStart, 'yyyy-MM-dd');
    const monthEnd = format(currentMonthEnd, 'yyyy-MM-dd');

    const [remisionesRes, todayOrdersRes, pendingQuotesRes, pendingCreditRes, monthQuotesRes] =
      await Promise.all([
        serviceClient
          .from('remisiones')
          .select('plant_id, volumen_fabricado, tipo_remision')
          .in('plant_id', plantIds)
          .gte('fecha', monthStart)
          .lte('fecha', monthEnd)
          .eq('is_production_record', false),
        serviceClient
          .from('orders')
          .select('plant_id')
          .in('plant_id', plantIds)
          .eq('delivery_date', today)
          .not('order_status', 'eq', 'CANCELLED'),
        serviceClient
          .from('quotes')
          .select('plant_id')
          .in('plant_id', plantIds)
          .eq('is_active', true)
          .in('status', ['DRAFT', 'PENDING_APPROVAL']),
        serviceClient
          .from('orders')
          .select('plant_id')
          .in('plant_id', plantIds)
          .eq('credit_status', 'pending')
          .not('order_status', 'eq', 'CANCELLED'),
        serviceClient
          .from('quotes')
          .select('plant_id')
          .in('plant_id', plantIds)
          .eq('is_active', true)
          .gte('created_at', currentMonthStart.toISOString())
          .lte('created_at', currentMonthEnd.toISOString()),
      ]);

    const countByPlant = (rows: { plant_id?: string | null }[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows ?? []) {
        const id = row.plant_id;
        if (!id) continue;
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    };

    const volumeByPlant = new Map<string, number>();
    for (const r of remisionesRes.data ?? []) {
      if (r.tipo_remision === 'BOMBEO' || !r.plant_id) continue;
      const vol = Number(r.volumen_fabricado) || 0;
      volumeByPlant.set(r.plant_id, (volumeByPlant.get(r.plant_id) ?? 0) + vol);
    }

    const todayMap = countByPlant(todayOrdersRes.data);
    const pendingQuotesMap = countByPlant(pendingQuotesRes.data);
    const pendingCreditMap = countByPlant(pendingCreditRes.data);
    const monthQuotesMap = countByPlant(monthQuotesRes.data);

    const rows: PlantDashboardRow[] = plants.map((p) => ({
      plantId: p.id,
      plantCode: p.code,
      plantName: p.name,
      monthlySales: Math.round((volumeByPlant.get(p.id) ?? 0) * 100) / 100,
      todayOrders: todayMap.get(p.id) ?? 0,
      pendingQuotes: pendingQuotesMap.get(p.id) ?? 0,
      pendingCreditOrders: pendingCreditMap.get(p.id) ?? 0,
      monthlyQuotes: monthQuotesMap.get(p.id) ?? 0,
    }));

    const totals = rows.reduce(
      (acc, row) => ({
        monthlySales: acc.monthlySales + row.monthlySales,
        todayOrders: acc.todayOrders + row.todayOrders,
        pendingQuotes: acc.pendingQuotes + row.pendingQuotes,
        pendingCreditOrders: acc.pendingCreditOrders + row.pendingCreditOrders,
        monthlyQuotes: acc.monthlyQuotes + row.monthlyQuotes,
      }),
      {
        monthlySales: 0,
        todayOrders: 0,
        pendingQuotes: 0,
        pendingCreditOrders: 0,
        monthlyQuotes: 0,
      }
    );

    return NextResponse.json(
      {
        plants: rows,
        totals: {
          ...totals,
          monthlySales: Math.round(totals.monthlySales * 100) / 100,
        },
        scope: profile.business_unit_id
          ? 'BUSINESS_UNIT'
          : profile.plant_id
            ? 'PLANT'
            : 'GLOBAL',
        lastUpdated: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error fetching by-plant dashboard:', error);
    return NextResponse.json(
      { plants: [], totals: null, error: 'Error al cargar comparativo' },
      { status: 200 }
    );
  }
}
