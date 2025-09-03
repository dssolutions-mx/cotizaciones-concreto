import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
        plants!inner(name)
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

    // Fetch evidence for each pumping remision
    const remisionesWithEvidence = await Promise.all(
      pumpingRemisiones.map(async (remision) => {
        const { data: evidence, error: evidenceError } = await supabase
          .from('remision_documents')
          .select(`
            id,
            file_name,
            original_name,
            file_path,
            file_size,
            mime_type,
            document_type,
            document_category,
            uploaded_by,
            created_at
          `)
          .eq('remision_id', remision.id)
          .eq('document_category', 'pumping_remision')
          .order('created_at', { ascending: false });

        if (evidenceError) {
          console.warn(`Error fetching evidence for remision ${remision.id}:`, evidenceError);
        }

        return {
          ...remision,
          remision_documents: evidence || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: remisionesWithEvidence
    });

  } catch (error) {
    console.error('Error in pumping evidence API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
