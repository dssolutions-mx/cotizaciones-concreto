import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/production-control/cross-plant-status
 *
 * Returns two arrays for the current plant:
 *   billing   — remisiones billed here but produced at another plant (Plant A perspective)
 *   production — remisiones produced here but billed at another plant (Plant B perspective)
 *
 * Each record includes resolved vs pending status and the other plant's name.
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
      .select('plant_id, role')
      .eq('id', user.id)
      .single();

    const { searchParams } = new URL(request.url);
    // Query param takes precedence (executives pass the currently-selected plant)
    // Fall back to profile plant_id for plant-assigned users
    const plantId = searchParams.get('plant_id') || profile?.plant_id || null;

    if (!plantId) {
      return NextResponse.json({ billing: [], production: [], summary: { pending_billing: 0, pending_production: 0, total_pending: 0 } });
    }

    const serviceClient = createServiceClient();

    const [billingResult, productionResult] = await Promise.all([
      // Plant A perspective: billed here, produced elsewhere
      serviceClient
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          volumen_fabricado,
          cross_plant_billing_plant_id,
          cross_plant_billing_remision_id,
          orders:order_id(client_id, clients:client_id(business_name))
        `)
        .eq('plant_id', plantId)
        .eq('is_production_record', false)
        .not('cross_plant_billing_plant_id', 'is', null)
        .order('fecha', { ascending: false })
        .limit(100),

      // Plant B perspective: produced here, billed elsewhere
      serviceClient
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          volumen_fabricado,
          cross_plant_billing_plant_id,
          cross_plant_billing_remision_id
        `)
        .eq('plant_id', plantId)
        .eq('is_production_record', true)
        .order('fecha', { ascending: false })
        .limit(100),
    ]);

    // Collect all cross_plant_billing_plant_id values to fetch plant names in one query
    const allPlantIds = new Set<string>();
    (billingResult.data || []).forEach(r => {
      if (r.cross_plant_billing_plant_id) allPlantIds.add(r.cross_plant_billing_plant_id);
    });
    (productionResult.data || []).forEach(r => {
      if (r.cross_plant_billing_plant_id) allPlantIds.add(r.cross_plant_billing_plant_id);
    });

    let plantNames: Record<string, string> = {};
    if (allPlantIds.size > 0) {
      const { data: plants } = await serviceClient
        .from('plants')
        .select('id, name')
        .in('id', Array.from(allPlantIds));
      (plants || []).forEach(p => { plantNames[p.id] = p.name; });
    }

    // Collect all linked billing remision IDs to fetch their numbers
    const linkedRemisionIds = new Set<string>();
    (productionResult.data || []).forEach(r => {
      if (r.cross_plant_billing_remision_id) linkedRemisionIds.add(r.cross_plant_billing_remision_id);
    });

    let linkedRemisionNumbers: Record<string, string> = {};
    if (linkedRemisionIds.size > 0) {
      const { data: linkedRems } = await serviceClient
        .from('remisiones')
        .select('id, remision_number')
        .in('id', Array.from(linkedRemisionIds));
      (linkedRems || []).forEach(r => { linkedRemisionNumbers[r.id] = r.remision_number; });
    }

    const today = Date.now();

    const billing = (billingResult.data || []).map((r: any) => ({
      id: r.id,
      remision_number: r.remision_number,
      fecha: r.fecha,
      volumen_fabricado: r.volumen_fabricado,
      producing_plant_name: r.cross_plant_billing_plant_id ? (plantNames[r.cross_plant_billing_plant_id] || 'Planta desconocida') : null,
      linked_production_remision_id: r.cross_plant_billing_remision_id,
      is_resolved: !!r.cross_plant_billing_remision_id,
      days_pending: r.cross_plant_billing_remision_id
        ? 0
        : Math.floor((today - new Date(r.fecha).getTime()) / (1000 * 60 * 60 * 24)),
      client_name: (r.orders as any)?.clients?.business_name ?? null,
    }));

    const production = (productionResult.data || []).map((r: any) => ({
      id: r.id,
      remision_number: r.remision_number,
      fecha: r.fecha,
      volumen_fabricado: r.volumen_fabricado,
      billing_plant_name: r.cross_plant_billing_plant_id ? (plantNames[r.cross_plant_billing_plant_id] || 'Planta desconocida') : null,
      linked_billing_remision_number: r.cross_plant_billing_remision_id
        ? (linkedRemisionNumbers[r.cross_plant_billing_remision_id] || null)
        : null,
      is_resolved: !!r.cross_plant_billing_remision_id,
      days_pending: r.cross_plant_billing_remision_id
        ? 0
        : Math.floor((today - new Date(r.fecha).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const pendingBilling = billing.filter(r => !r.is_resolved).length;
    const pendingProduction = production.filter(r => !r.is_resolved).length;

    return NextResponse.json({
      billing,
      production,
      summary: {
        pending_billing: pendingBilling,
        pending_production: pendingProduction,
        total_pending: pendingBilling + pendingProduction,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
