import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/production-control/remisiones-log
 * ?plant_id=xxx&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Returns ALL remisiones for a plant in a date range:
 *   - Regular remisiones (order_id != null, is_production_record = false)
 *   - Cross-plant production records (is_production_record = true)
 * Uses service role to resolve plant names across plants.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plant_id')
      .eq('id', user.id)
      .single();

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id') || profile?.plant_id || null;
    if (!plantId) return NextResponse.json({ regular: [], crossPlant: [] });

    const today = new Date().toISOString().split('T')[0];
    const dateFrom = searchParams.get('date_from') || today;
    const dateTo = searchParams.get('date_to') || today;

    const serviceClient = createServiceClient();

    const [regularResult, crossPlantResult] = await Promise.all([
      // Regular billing remisiones
      serviceClient
        .from('remisiones')
        .select(`
          id, remision_number, fecha, hora_carga, volumen_fabricado,
          conductor, unidad, plant_id,
          cross_plant_billing_plant_id, cross_plant_billing_remision_id,
          is_production_record, cancelled_reason,
          orders:order_id(
            id, construction_site,
            clients:client_id(business_name)
          )
        `)
        .eq('plant_id', plantId)
        .eq('is_production_record', false)
        .gte('fecha', dateFrom)
        .lte('fecha', dateTo)
        .order('fecha', { ascending: false })
        .order('hora_carga', { ascending: false })
        .limit(500),

      // Cross-plant production records
      serviceClient
        .from('remisiones')
        .select(`
          id, remision_number, fecha, hora_carga, volumen_fabricado,
          conductor, unidad, plant_id,
          cross_plant_billing_plant_id, cross_plant_billing_remision_id,
          is_production_record, cancelled_reason
        `)
        .eq('plant_id', plantId)
        .eq('is_production_record', true)
        .gte('fecha', dateFrom)
        .lte('fecha', dateTo)
        .order('fecha', { ascending: false })
        .order('hora_carga', { ascending: false })
        .limit(200),
    ]);

    // Resolve plant names for cross-plant records
    const plantIds = new Set<string>();
    (crossPlantResult.data || []).forEach(r => {
      if (r.cross_plant_billing_plant_id) plantIds.add(r.cross_plant_billing_plant_id);
    });
    (regularResult.data || []).forEach(r => {
      if (r.cross_plant_billing_plant_id) plantIds.add(r.cross_plant_billing_plant_id);
    });

    let plantNames: Record<string, string> = {};
    if (plantIds.size > 0) {
      const { data: plants } = await serviceClient
        .from('plants').select('id, name').in('id', Array.from(plantIds));
      (plants || []).forEach(p => { plantNames[p.id] = p.name; });
    }

    const regular = (regularResult.data || []).map((r: any) => {
      const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
      const client = order?.clients
        ? (Array.isArray(order.clients) ? order.clients[0] : order.clients)
        : null;
      return {
        id: r.id,
        remision_number: r.remision_number,
        fecha: r.fecha,
        hora_carga: r.hora_carga,
        volumen_fabricado: r.volumen_fabricado,
        conductor: r.conductor,
        unidad: r.unidad,
        order_id: order?.id ?? null,
        construction_site: order?.construction_site ?? null,
        client_name: client?.business_name ?? null,
        is_cross_plant_billing: !!r.cross_plant_billing_plant_id,
        producing_plant_name: r.cross_plant_billing_plant_id
          ? (plantNames[r.cross_plant_billing_plant_id] || 'Planta desconocida')
          : null,
        is_resolved: !!r.cross_plant_billing_remision_id,
      };
    });

    const crossPlant = (crossPlantResult.data || []).map((r: any) => ({
      id: r.id,
      remision_number: r.remision_number,
      fecha: r.fecha,
      hora_carga: r.hora_carga,
      volumen_fabricado: r.volumen_fabricado,
      conductor: r.conductor,
      unidad: r.unidad,
      billing_plant_name: r.cross_plant_billing_plant_id
        ? (plantNames[r.cross_plant_billing_plant_id] || 'Planta desconocida')
        : null,
      is_resolved: !!r.cross_plant_billing_remision_id,
    }));

    return NextResponse.json({
      regular,
      crossPlant,
      summary: {
        total_regular: regular.length,
        total_cross_plant: crossPlant.length,
        total_volume_regular: regular.reduce((s, r) => s + (r.volumen_fabricado || 0), 0),
        total_volume_cross_plant: crossPlant.reduce((s, r) => s + (r.volumen_fabricado || 0), 0),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
