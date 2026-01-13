import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const serviceClient = createServiceClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role and plant
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has production control permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para ver actividades' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const requestedPlantId = searchParams.get('plant_id');
    const plantId = requestedPlantId || profile.plant_id;

    // If no plant context, return empty
    if (!plantId) {
      return NextResponse.json({ success: true, activities: [], pagination: { limit, hasMore: false } });
    }

    // Fetch all activity types in parallel
    const [
      inventoryActivities,
      pumpingActivities,
      arkikActivities,
      orderActivities
    ] = await Promise.all([
      // Inventory activities
      supabase
        .from('vw_daily_inventory_activity')
        .select('*')
        .eq('plant_id', plantId)
        .order('activity_date', { ascending: false })
        .order('activity_time', { ascending: false })
        .limit(limit),

      // Pumping service activities (from remisiones table with tipo_remision = BOMBEO)
      serviceClient
        .from('remisiones')
        .select(`
          id,
          remision_number,
          created_at,
          conductor,
          volumen_fabricado,
          plant_id,
          orders!inner(
            clients:client_id(business_name)
          )
        `)
        .eq('plant_id', plantId)
        .eq('tipo_remision', 'BOMBEO')
        .order('created_at', { ascending: false })
        .limit(limit),

      // Arkik processing activities
      serviceClient
        .from('arkik_import_sessions')
        .select(`
          id,
          file_name,
          created_at,
          processing_status,
          total_rows,
          processed_rows,
          plant_id
        `)
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Recent orders (for context)
      serviceClient
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          order_status,
          clients:client_id (
            business_name
          )
        `)
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false })
        .limit(limit)
    ]);

    // Combine and format all activities
    const activities: any[] = [];

    // Process inventory activities
    if (inventoryActivities.data) {
      inventoryActivities.data.forEach(activity => {
        activities.push({
          id: `inventory-${activity.activity_date}-${activity.activity_time}`,
          type: 'inventory',
          action: `${activity.activity_type === 'ENTRY' ? 'Entrada' : 'Ajuste'} de ${activity.material_name}`,
          details: `${activity.quantity} unidades (${activity.inventory_before} → ${activity.inventory_after})`,
          user: activity.performed_by,
          timestamp: new Date(`${activity.activity_date}T${activity.activity_time}`).toISOString(),
          icon: activity.activity_type === 'ENTRY' ? 'Package' : 'TrendingDown',
          color: activity.activity_type === 'ENTRY' ? 'blue' : 'orange'
        });
      });
    }

    // Process pumping activities (from remisiones with tipo_remision = BOMBEO)
    if (pumpingActivities.data) {
      pumpingActivities.data.forEach(activity => {
        const clientName = (activity.orders as any)?.clients?.business_name || 'Cliente desconocido';
        activities.push({
          id: `pumping-${activity.id}`,
          type: 'pumping',
          action: `Servicio de bombeo ${activity.remision_number}`,
          details: `${clientName} - ${activity.volumen_fabricado} m³`,
          user: activity.conductor || 'Sistema',
          timestamp: activity.created_at,
          icon: 'Truck',
          color: 'cyan'
        });
      });
    }

    // Process arkik activities
    if (arkikActivities.data) {
      arkikActivities.data.forEach(activity => {
        activities.push({
          id: `arkik-${activity.id}`,
          type: 'arkik',
          action: `Archivo Arkik procesado`,
          details: `${activity.file_name} - ${activity.processed_rows}/${activity.total_rows} filas`,
          user: 'Sistema',
          timestamp: activity.created_at,
          icon: 'Upload',
          color: 'purple'
        });
      });
    }

    // Process order activities
    if (orderActivities.data) {
      orderActivities.data.forEach(activity => {
        activities.push({
          id: `order-${activity.id}`,
          type: 'order',
          action: `Pedido ${activity.order_number}`,
          details: `${(activity.clients as any)?.business_name || 'Cliente desconocido'} - ${activity.order_status}`,
          user: 'Sistema',
          timestamp: activity.created_at,
          icon: 'FileText',
          color: 'green'
        });
      });
    }

    // Sort by timestamp (most recent first) and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentActivities = activities.slice(0, limit);

    return NextResponse.json({
      success: true,
      activities: recentActivities,
      pagination: {
        limit,
        hasMore: activities.length > limit,
      },
    });

  } catch (error) {
    console.error('Error in production control activities GET:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
