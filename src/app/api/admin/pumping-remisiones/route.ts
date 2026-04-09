import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { batchFetchPumpingRemisionDocuments } from '@/lib/remisiones/batchPumpingRemisionDocuments';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client for server-side
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 });
    }

    if (!['EXECUTIVE', 'PLANT_MANAGER'].includes(profile.role)) {
      return NextResponse.json({ error: 'Acceso denegado. Se requieren permisos de administrador.' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const plantId = searchParams.get('plant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const hasEvidence = searchParams.get('has_evidence');

    // First, get all remisiones that match the basic filters (without pagination)
    let baseQuery = supabase
      .from('remisiones')
      .select(`
        id,
        remision_number,
        fecha,
        conductor,
        unidad,
        volumen_fabricado,
        plant_id,
        order_id,
        plants!plant_id!inner(name),
        orders!inner(
          id,
          order_number,
          client_id,
          construction_site,
          clients!inner(business_name)
        )
      `)
      .eq('tipo_remision', 'BOMBEO')
      .order('fecha', { ascending: false });

    // Apply basic filters
    if (plantId) {
      baseQuery = baseQuery.eq('plant_id', plantId);
    }

    if (dateFrom) {
      baseQuery = baseQuery.gte('fecha', dateFrom);
    }

    if (dateTo) {
      baseQuery = baseQuery.lte('fecha', dateTo);
    }

    // Get all matching remisiones first
    const { data: allRemisiones, error: remisionesError } = await baseQuery;

    if (remisionesError) {
      console.error('Error fetching pumping remisiones:', remisionesError);
      return NextResponse.json({ error: 'Error al obtener remisiones de bombeo' }, { status: 500 });
    }

    if (!allRemisiones || allRemisiones.length === 0) {
      return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const evidenceByRemision = await batchFetchPumpingRemisionDocuments(
      supabase,
      allRemisiones.map((r) => r.id)
    );

    const remisionesWithEvidence = allRemisiones.map((remision) => {
      const evidence = evidenceByRemision.get(remision.id) || [];
      return {
        ...remision,
        evidence,
        evidenceCount: evidence.length,
      };
    });

    // Filter by evidence if requested (this is now done before pagination)
    let filteredRemisiones = remisionesWithEvidence;
    if (hasEvidence === 'true') {
      filteredRemisiones = remisionesWithEvidence.filter(r => r.evidenceCount > 0);
    } else if (hasEvidence === 'false') {
      filteredRemisiones = remisionesWithEvidence.filter(r => r.evidenceCount === 0);
    }

    // Now apply pagination to the filtered results
    const total = filteredRemisiones.length;
    const totalPages = Math.ceil(total / limit);
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedRemisiones = filteredRemisiones.slice(from, to);

    return NextResponse.json({
      success: true,
      data: paginatedRemisiones,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error in admin pumping remisiones API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
