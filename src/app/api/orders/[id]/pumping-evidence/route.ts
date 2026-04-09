import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { batchFetchPumpingRemisionDocuments } from '@/lib/remisiones/batchPumpingRemisionDocuments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Create Supabase client for server-side
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Fetch pumping remisiones for this order with their evidence
    const { data: pumpingRemisiones, error: remisionesError } = await supabase
      .from('remisiones')
      .select(`
        id,
        remision_number,
        fecha,
        conductor,
        unidad,
        volumen_fabricado,
        plant_id,
        plants!plant_id!inner(name)
      `)
      .eq('order_id', orderId)
      .eq('tipo_remision', 'BOMBEO')
      .order('fecha', { ascending: false });

    if (remisionesError) {
      console.error('Error fetching pumping remisiones:', remisionesError);
      return NextResponse.json({ error: 'Error al obtener remisiones de bombeo' }, { status: 500 });
    }

    if (!pumpingRemisiones || pumpingRemisiones.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const evidenceByRemision = await batchFetchPumpingRemisionDocuments(
      supabase,
      pumpingRemisiones.map((r) => r.id)
    );

    const remisionesWithEvidence = pumpingRemisiones.map((remision) => ({
      ...remision,
      remision_documents: evidenceByRemision.get(remision.id) || [],
    }));

    return NextResponse.json({
      success: true,
      data: remisionesWithEvidence
    });

  } catch (error) {
    console.error('Error in pumping evidence API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
