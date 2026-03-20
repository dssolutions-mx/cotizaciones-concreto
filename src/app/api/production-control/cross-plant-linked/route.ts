import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/production-control/cross-plant-linked?order_id=xxx
 *
 * For Plant A's order detail view: given an order, fetches all Plant B production
 * records that are linked to the billing remisiones in that order.
 * Uses service role to bypass RLS (Plant B's records are invisible to Plant A via RLS).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    if (!orderId) return NextResponse.json({ linked: [] });

    // Step 1: Get billing remision IDs for this order (user-scoped, RLS applies)
    const { data: billingRemisiones, error: remError } = await supabase
      .from('remisiones')
      .select('id, remision_number, cross_plant_billing_plant_id, cross_plant_billing_remision_id')
      .eq('order_id', orderId)
      .eq('is_production_record', false);

    if (remError) throw remError;
    if (!billingRemisiones?.length) return NextResponse.json({ linked: [], billingCrossPlant: [] });

    // Billing remisiones that are cross-plant (have a producing plant set)
    const billingCrossPlant = billingRemisiones.filter(r => r.cross_plant_billing_plant_id);
    const billingIds = billingRemisiones.map(r => r.id);

    // Step 2: Fetch Plant B production records linked to any of these billing remisiones
    // Needs service role to read across RLS boundaries
    const serviceClient = createServiceClient();

    const { data: productionRecords, error: prodError } = await serviceClient
      .from('remisiones')
      .select('id, remision_number, fecha, volumen_fabricado, conductor, unidad, plant_id, cross_plant_billing_plant_id, cross_plant_billing_remision_id')
      .eq('is_production_record', true)
      .in('cross_plant_billing_remision_id', billingIds);

    if (prodError) throw prodError;

    // Step 3: Fetch plant names for all involved plants
    const plantIds = new Set<string>();
    (productionRecords || []).forEach(r => {
      if (r.plant_id) plantIds.add(r.plant_id);
      if (r.cross_plant_billing_plant_id) plantIds.add(r.cross_plant_billing_plant_id);
    });
    billingCrossPlant.forEach(r => {
      if (r.cross_plant_billing_plant_id) plantIds.add(r.cross_plant_billing_plant_id);
    });

    let plantNames: Record<string, string> = {};
    if (plantIds.size > 0) {
      const { data: plants } = await serviceClient
        .from('plants')
        .select('id, name')
        .in('id', Array.from(plantIds));
      (plants || []).forEach(p => { plantNames[p.id] = p.name; });
    }

    // Build billing remision lookup
    const billingRemisionById: Record<string, string> = {};
    billingRemisiones.forEach(r => { billingRemisionById[r.id] = r.remision_number; });

    const linked = (productionRecords || []).map(r => ({
      id: r.id,
      remision_number: r.remision_number,
      fecha: r.fecha,
      volumen_fabricado: r.volumen_fabricado,
      conductor: r.conductor,
      production_plant_name: r.plant_id ? (plantNames[r.plant_id] || 'Planta desconocida') : null,
      billing_remision_number: r.cross_plant_billing_remision_id
        ? (billingRemisionById[r.cross_plant_billing_remision_id] || null)
        : null,
      is_resolved: !!r.cross_plant_billing_remision_id,
    }));

    // Also return which billing remisiones are cross-plant (so the badge can show for pending ones)
    const billingCrossPlantInfo = billingCrossPlant.map(r => ({
      billing_remision_id: r.id,
      billing_remision_number: r.remision_number,
      producing_plant_name: r.cross_plant_billing_plant_id
        ? (plantNames[r.cross_plant_billing_plant_id] || 'Planta desconocida')
        : null,
      is_resolved: linked.some(l => l.billing_remision_number === r.remision_number),
    }));

    return NextResponse.json({ linked, billingCrossPlant: billingCrossPlantInfo });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
