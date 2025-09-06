import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryDashboardService } from '@/services/inventoryDashboardService';
import { InventoryDashboardFilters } from '@/types/inventory';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role and permissions
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para acceder al dashboard de inventario' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const plantId = searchParams.get('plant_id');
    const materialIds = searchParams.get('material_ids')?.split(',').filter(Boolean);

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Parámetros requeridos: start_date y end_date' 
      }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json({ 
        error: 'Formato de fecha inválido. Use YYYY-MM-DD' 
      }, { status: 400 });
    }

    // Validate date range (max 90 days for performance)
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return NextResponse.json({ 
        error: 'La fecha de inicio no puede ser posterior a la fecha de fin' 
      }, { status: 400 });
    }

    const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > 90) {
      return NextResponse.json({ 
        error: 'El rango de fechas no puede exceder 90 días' 
      }, { status: 400 });
    }

    // Determine target plant ID based on user role and permissions
    let targetPlantId = profile.plant_id;
    
    // EXECUTIVE users can specify any plant_id or use their assigned one
    if (profile.role === 'EXECUTIVE') {
      if (plantId) {
        targetPlantId = plantId;
      } else if (!profile.plant_id) {
        // EXECUTIVE without assigned plant must specify one
        return NextResponse.json({ 
          error: 'Debe especificar una planta (plant_id)' 
        }, { status: 400 });
      }
    } else {
      // Non-EXECUTIVE users must have an assigned plant
      if (!profile.plant_id) {
        return NextResponse.json({ 
          error: 'Usuario sin planta asignada' 
        }, { status: 400 });
      }
      
      // Non-EXECUTIVE users cannot access other plants
      if (plantId && plantId !== profile.plant_id) {
        return NextResponse.json({ 
          error: 'Sin permisos para acceder a la planta especificada' 
        }, { status: 403 });
      }
    }

    // Final validation - ensure we have a plant ID
    if (!targetPlantId) {
      return NextResponse.json({ 
        error: 'No se pudo determinar la planta de acceso' 
      }, { status: 400 });
    }

    console.log('🔍 Processing inventory dashboard request:', {
      userId: user.id,
      userRole: profile.role,
      targetPlantId,
      dateRange: `${startDate} to ${endDate}`,
      materialIds: materialIds?.length || 'all materials'
    });

    // Prepare filters
    const filters: InventoryDashboardFilters = {
      plant_id: targetPlantId,
      start_date: startDate,
      end_date: endDate,
      material_ids: materialIds
    };

    // Create service and get dashboard data
    const dashboardService = new InventoryDashboardService(supabase);
    const dashboardData = await dashboardService.getDashboardData(filters, user.id);

    console.log('✅ Successfully processed dashboard request:', {
      materialsTracked: dashboardData.summary.total_materials_tracked,
      remisionesFound: dashboardData.summary.total_remisiones,
      movementsCount: dashboardData.movements.length,
      consumptionDetailsCount: dashboardData.consumption_details.length
    });

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error in inventory dashboard GET:', error);
    
    if (error instanceof Error) {
      // Handle known business logic errors
      if (error.message.includes('Usuario no encontrado') || 
          error.message.includes('Planta no encontrada') ||
          error.message.includes('sin acceso')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        );
      }

      if (error.message.includes('No se encontraron materiales')) {
        return NextResponse.json(
          { success: false, error: 'No hay materiales configurados para esta planta' },
          { status: 404 }
        );
      }

      // Handle Supabase/database errors
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        return NextResponse.json(
          { success: false, error: 'Error procesando datos del servidor' },
          { status: 500 }
        );
      }

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

export async function POST(request: NextRequest) {
  // For future export functionality
  return NextResponse.json(
    { success: false, error: 'Método no implementado' },
    { status: 501 }
  );
}
